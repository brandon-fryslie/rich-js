/**
 * Progress — displays continuously updated progress bars.
 */

import type { Segment } from "../core/segment.js";
import { RichText } from "../core/text.js";
import { Console } from "../core/console.js";
import { escape as escapeMarkup, readStr, renderStr } from "../core/markup.js";
import type { Style } from "../core/style.js";
import { ProgressBar } from "./progressBar.js";
import { Spinner } from "./spinner.js";
import { Live } from "./live.js";
import type { Clock } from "../core/clock.js";
import { Table, type ColumnOptions } from "./table.js";
import type { Composite, FrameHost, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Animation } from "../core/animation.js";
import type { Timing } from "../core/easing.js";
import { Timeline } from "../core/timeline.js";
import { tween } from "../core/tween.js";
import { frameAt } from "./frames.js";

// --- Task ---

export interface TaskOptions {
  total?: number;
  start?: boolean;
  visible?: boolean;
}

export interface TaskUpdateOptions {
  completed?: number;
  advance?: number;
  description?: string;
  visible?: boolean;
  refresh?: boolean;
}

export interface Task {
  id: number;
  description: string;
  total: number | undefined;
  completed: number;
  /**
   * The count a bar shows, over its `Progress`'s clock: `completed` itself,
   * or moving to it after each update when the `Progress` was given a `fill`
   * timing. `completed` stays the count; only the bar draws this.
   */
  fill: Animation<number>;
  visible: boolean;
  /** When the task started, in seconds on its `Progress`'s host's time; undefined until it has, as of the frame being drawn. */
  startTime: number | undefined;
  /**
   * Rich's `Task.get_time()`: the moment the frame being drawn is drawn at, in
   * seconds on its `Progress`'s host's time, so a column animates without reading a clock.
   */
  time: number;
  /**
   * Rich's `Task.elapsed`: seconds since the task started, as of the frame
   * being drawn — `Progress` takes the time once a frame and hands columns
   * the result, so no column reads a clock. Undefined until the task starts.
   */
  elapsed: number | undefined;
  /**
   * Rich's `Task.finished_time`: the elapsed time the first time an update
   * finds a started task at its total, kept from then on, so a finished task
   * stays finished however its count moves after.
   */
  finishedTime: number | undefined;
  /**
   * Rich's `Task.speed`: steps a second over the updates that moved the task
   * in the `SPEED_ESTIMATE_PERIOD` before its latest update — measured back from
   * that update, not from now, so a task that stops being updated keeps the
   * speed it had. Undefined until the task has started and two such updates lie
   * apart in time.
   */
  speed: number | undefined;
}

/** Rich's `ProgressSample`: how far one update moved a task, and when. */
interface ProgressSample {
  readonly timestamp: number;
  readonly completed: number;
}

/**
 * Rich's defaults for `speed_estimate_period` and its sample deque's
 * `maxlen`: an update forgets samples older than the period, and the newest
 * thousand are all a task keeps.
 */
const SPEED_ESTIMATE_PERIOD = 30;
const MAX_SAMPLES = 1000;

/**
 * What `Progress` keeps of a task between frames: everything but what a frame
 * derives — `elapsed` from the clock, `speed` from the samples.
 */
type TaskState = Omit<Task, "time" | "elapsed" | "speed"> & { readonly samples: ProgressSample[] };

/**
 * Rich's `Progress.update` bookkeeping on its sample deque, in place: drop the
 * samples older than the period as of `now`, then add this update's if it
 * moved the task forward, keeping the newest `MAX_SAMPLES`. The samples are in
 * the order the updates came, which is time order unless the host's timeline
 * ran back between them, so the stale ones are found by time, not position.
 */
function recordSample(samples: ProgressSample[], now: number, moved: number): void {
  const fresh = samples.filter((sample) => sample.timestamp >= now - SPEED_ESTIMATE_PERIOD);
  if (moved > 0) fresh.push({ timestamp: now, completed: moved });
  samples.splice(0, samples.length, ...fresh.slice(-MAX_SAMPLES));
}

/**
 * Rich's `Task.speed` over a started task's samples: everything moved after
 * the earliest sample, over the time from the earliest to the latest — Rich's
 * first and last, when time only ran forward, and never negative when it ran
 * back. No samples, or none apart in time, is no speed.
 */
function sampleSpeed(samples: readonly ProgressSample[]): number | undefined {
  if (samples.length === 0) return undefined;
  const times = samples.map((sample) => sample.timestamp);
  const earliest = Math.min(...times);
  const span = Math.max(...times) - earliest;
  if (span === 0) return undefined;
  const moved = samples.reduce((sum, sample) => sum + sample.completed, 0) - samples[times.indexOf(earliest)]!.completed;
  return moved / span;
}

/**
 * A count as a task takes it in. [LAW:single-enforcer] `addTask` and
 * `updateTask` are where counts enter, so a NaN or an Infinity is refused there,
 * with the caller's stack, rather than drawn as `NaN%` by one column and thrown
 * on a refresh tick by another.
 */
function finiteCount(field: "total" | "completed" | "advance" | "completed + advance", value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`progress task ${field} must be a finite number, got ${value}`);
  return value;
}

/** Rich's `Task.finished`. [LAW:one-source-of-truth] The one predicate every reader of "finished" asks. */
/**
 * When `task` started, if it has by `time`: a host whose timeline runs back
 * draws moments before a start that was stamped later, and a task drawn for
 * a moment before its start has not started.
 */
function startedBy(task: Pick<TaskState, "startTime">, time: number): number | undefined {
  const { startTime } = task;
  return startTime !== undefined && time >= startTime ? startTime : undefined;
}

function finished<T extends Pick<TaskState, "finishedTime">>(task: T): task is T & { finishedTime: number } {
  return task.finishedTime !== undefined;
}

// --- Progress Columns ---

/**
 * One cell of a `Progress` row, made for the task on that row. Not a
 * `Renderable`: a column has nothing to draw without a task, as the
 * reference's `ProgressColumn` is a callable of one. What it returns is the
 * cell's content, which the progress grid lays out like any table cell's —
 * width, wrapping and justify are decided once, in the cell, as Rich's
 * `make_tasks_table` decides them. [LAW:single-enforcer]
 */
export interface ProgressColumn {
  /**
   * The grid column this one is laid out in, Rich's `get_table_column()`:
   * whether its cell may wrap, how it justifies, its share of the width.
   */
  readonly tableColumn: ColumnOptions;
  render(task: Task): Renderable;
}

export class TextColumn implements ProgressColumn {
  readonly format: string;
  /** Text is cut, never wrapped, as Rich's `TextColumn` defaults to `Column(no_wrap=True)`. */
  readonly tableColumn: ColumnOptions = { noWrap: true };

  constructor(format?: string) {
    this.format = format ?? "{task.description}";
  }

  render(task: Task): RichText {
    // [LAW:single-enforcer] Format strings flow through the markup parser so
    // tags like `[progress.description]` become Style spans, not literal text.
    // Task descriptions are escaped first to prevent injection of stray tags.
    const description = escapeMarkup(task.description);
    // Use a callback so `$&`/`$1`/`$$` in the task description aren't
    // reinterpreted by String.replace as replacement patterns.
    const formatted = this.format.replace(/\{task\.description\}/g, () => description);
    // Markup whatever the console says, and never highlighted: Rich's
    // `TextColumn` reads its format as markup on its own `markup=True` and
    // highlights only with a highlighter it was given, not the console's.
    return renderStr(formatted, { markup: true });
  }
}

export class BarColumn implements ProgressColumn {
  readonly barWidth: number;
  readonly tableColumn: ColumnOptions = {};

  constructor(barWidth?: number) {
    this.barWidth = barWidth ?? 40;
  }

  /**
   * Rich's `BarColumn`: a task not yet started, or with no total to fill
   * toward, pulses, and a pulse draws no fill. Otherwise the bar is the
   * task's `fill` drawn at the frame's time, every cell stamped with when the
   * fill next moves, so a host draws while it eases and the bar asks for
   * nothing once it lands. Its colour is the task's: an ease that overshoots
   * the total does not finish the bar, and one that dips back does not
   * unfinish it.
   */
  render(task: Task): Renderable {
    const total = task.total ?? 100;
    if (task.startTime === undefined || task.total === undefined) {
      return new ProgressBar({ total, completed: task.completed, width: this.barWidth, pulse: { t: task.time } });
    }
    const done = task.completed >= total;
    const bars = Animation.map(task.fill, (completed) => new ProgressBar({ total, completed, width: this.barWidth, finished: done }));
    return frameAt(bars, task.time);
  }
}

/**
 * Rich's `{task.percentage:>3.0f}%`: the percentage right-aligned in three
 * cells, so the column is four wide from 0% to 100% and the row does not
 * shift as it counts. A task with no total shows nothing, Rich's
 * `text_format_no_percentage`.
 */
export class TaskProgressColumn implements ProgressColumn {
  /** A `TextColumn` in Rich, and laid out as one. */
  readonly tableColumn: ColumnOptions = { noWrap: true };

  render(task: Task): RichText {
    const text =
      task.total === undefined ? "" : `${String(roundHalfEven(percentage(task))).padStart(3)}%`;
    return new RichText(text, { style: "progress.percentage" });
  }
}

/** Rich's `Task.percentage`: 0 without a total, and clamped to [0, 100]. */
function percentage(task: Task): number {
  return task.total ? Math.min(100, Math.max(0, (task.completed / task.total) * 100)) : 0;
}

/**
 * Python's `format(x, ".0f")`: the nearest integer to the double's exact
 * value, a tie going to the even one. `Math.round` is exact too but sends a
 * tie up, so only a tie is corrected.
 */
function roundHalfEven(x: number): number {
  const up = Math.round(x);
  return up - x === 0.5 && up % 2 !== 0 ? up - 1 : up;
}

export interface TimeRemainingColumnOptions {
  /**
   * Once the task is finished, draw the time it took, styled
   * `progress.elapsed`, in place of the zero left to go: Rich's
   * `elapsed_when_finished`. Defaults to false.
   */
  elapsedWhenFinished?: boolean;
}

export class TimeRemainingColumn implements ProgressColumn {
  readonly tableColumn: ColumnOptions = {};
  readonly elapsedWhenFinished: boolean;

  constructor(options?: TimeRemainingColumnOptions) {
    this.elapsedWhenFinished = options?.elapsedWhenFinished ?? false;
  }

  render(task: Task): RichText {
    const took = this.elapsedWhenFinished && finished(task) ? task.finishedTime : undefined;
    const time = took ?? timeRemaining(task);
    const style = took === undefined ? "progress.remaining" : "progress.elapsed";
    // A task with no total has no time to estimate, and Rich draws its cell empty.
    return new RichText(task.total === undefined ? "" : clockFace(time), { style });
  }
}

/**
 * Rich's `Task.time_remaining`: nothing left once the task is finished,
 * however long ago that was, unknown until it has a speed against a total,
 * and otherwise whole seconds, rounded up.
 */
function timeRemaining(task: Task): number | undefined {
  if (finished(task)) return 0;
  if (!task.speed || task.total === undefined) return undefined;
  return Math.ceil((task.total - task.completed) / task.speed);
}

export class TimeElapsedColumn implements ProgressColumn {
  readonly tableColumn: ColumnOptions = {};

  render(task: Task): RichText {
    // Rich's `finished_time if finished else elapsed`: a finished task's clock
    // holds where it stopped, and one never started has no time to show.
    const time = finished(task) ? task.finishedTime : task.elapsed;
    return new RichText(clockFace(time), { style: "progress.elapsed" });
  }
}

/** A time as the time columns draw it, `-:--:--` when there is none to draw. */
function clockFace(seconds: number | undefined): string {
  return seconds === undefined ? "-:--:--" : formatTime(seconds);
}

export interface SpinnerColumnOptions {
  /** The frame's style. Defaults to `progress.spinner`, a name its console's theme resolves. */
  style?: string | Style;
  /** Multiplies the spinner's frame rate. Defaults to 1. */
  speed?: number;
  /** Drawn in place of the frame once the task reaches its total; a string is markup. Defaults to `" "`. */
  finishedText?: string | RichText;
}

export class SpinnerColumn implements ProgressColumn {
  readonly tableColumn: ColumnOptions = {};
  private readonly _spinner: Spinner;
  private _finishedText: RichText;

  constructor(spinnerName?: string, options?: SpinnerColumnOptions) {
    this._spinner = new Spinner(spinnerName, "", {
      style: options?.style ?? "progress.spinner",
      speed: options?.speed,
    });
    // Markup whatever the console says, as Rich's `Text.from_markup`. A
    // `RichText` is copied, since the caller still holds it.
    const finishedText = options?.finishedText ?? " ";
    this._finishedText = typeof finishedText === "string" ? readStr(finishedText, true) : finishedText.copy();
  }

  // Rich's `self.spinner.render(task.get_time())`: the frame for the time the
  // task is drawn at, which `Progress` read off its clock once for the frame.
  render(task: Task): Renderable {
    return finished(task) ? this._finishedText : this._spinner.drawnAt(task.time);
  }
}

export interface MofNCompleteColumnOptions {
  /** Drawn between the two counts: Rich's `separator`. Defaults to `"/"`. */
  separator?: string;
}

/**
 * Rich's `MofNCompleteColumn`: both counts as whole numbers, the completed one
 * padded to the total's width so the column holds still as it counts up to its
 * total, styled `progress.download`.
 */
export class MofNCompleteColumn implements ProgressColumn {
  readonly tableColumn: ColumnOptions = {};
  readonly separator: string;

  constructor(options?: MofNCompleteColumnOptions) {
    this.separator = options?.separator ?? "/";
  }

  render(task: Task): RichText {
    const total = task.total === undefined ? "?" : wholeNumber(task.total);
    const completed = wholeNumber(task.completed).padStart(total.length);
    return new RichText(`${completed}${this.separator}${total}`, { style: "progress.download" });
  }
}

/**
 * Python's `str(int(x))`: truncated toward zero and written out in full,
 * never in exponent form. `Progress` admits only finite counts, so `BigInt`
 * has nothing here to refuse.
 */
function wholeNumber(x: number): string {
  return BigInt(Math.trunc(x)).toString();
}

/**
 * Rich's clock face: `int()` the seconds, then Python's floor `divmod` by 60
 * twice, so a negative estimate — a task past its total — reads as Rich's
 * does, `-3` as `-1:59:57`.
 */
function formatTime(seconds: number): string {
  const whole = Math.trunc(seconds);
  const minutes = Math.floor(whole / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes - h * 60;
  const s = whole - minutes * 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// --- Progress ---

/**
 * How a `Progress` is set up. It is drawn by one host, and every time it
 * keeps or draws at is that host's `frameTime`: by its own `Live`, which the
 * options for that `Live` configure, or, given `drawnBy`, by another host —
 * which then does all the drawing, so none of them apply.
 */
export type ProgressOptions = ProgressDisplayOptions & (OwnLiveOptions | DrawnByOptions);

interface ProgressDisplayOptions {
  expand?: boolean;
  console?: Console;
  /**
   * How a bar's fill moves to a task's new count: eased over this timing
   * from wherever it is when the count changes, so a bar advancing in bursts
   * reads as motion. Unset, the bar jumps to the count, as Rich's does.
   */
  fill?: Timing;
}

interface OwnLiveOptions {
  drawnBy?: undefined;
  refreshPerSecond?: number;
  autoRefresh?: boolean;
  transient?: boolean;
  /**
   * What its own `Live` ticks on, and so what tasks are timed by — Rich's
   * `get_time`; defaults to the platform's monotonic clock.
   */
  clock?: Clock;
}

interface DrawnByOptions {
  /**
   * The host — a `Live`, an `App` — whose frames this `Progress` is drawn in:
   * tasks are timed by its `frameTime`, so they hold while its timeline is
   * paused and run back while it is reversed. Drawn in any other host's
   * frame, the `Progress` throws.
   */
  drawnBy: FrameHost;
  refreshPerSecond?: never;
  autoRefresh?: never;
  transient?: never;
  clock?: never;
}

export class Progress implements Renderable, Composite {
  private _columns: ProgressColumn[];
  private _tasks: Map<number, TaskState>;
  private _nextId: number;
  // [LAW:types-are-the-program] Its own Live, or none: a Progress another
  // host draws has nothing of its own to start.
  private readonly _live: Live | undefined;
  private _console: Console;
  // [LAW:one-source-of-truth] The one source of every time this display
  // keeps or draws at, so a task's stamps and the frames it is drawn in are
  // readings of one host.
  private readonly _host: FrameHost;
  /** A task's fill after its count changes at `now`, from the value it shows then. */
  private readonly _refill: (from: number, to: number, now: number) => Animation<number>;
  readonly expand: boolean;

  constructor(...columns: (ProgressColumn | ProgressOptions)[]) {
    // Last arg might be options
    let opts: ProgressOptions = {};
    const cols: ProgressColumn[] = [];

    for (const arg of columns) {
      if ("render" in arg) {
        cols.push(arg);
      } else {
        opts = arg;
      }
    }

    if (cols.length === 0) {
      cols.push(
        new TextColumn("[progress.description]{task.description}"),
        new BarColumn(),
        new TaskProgressColumn(),
        new TimeRemainingColumn(),
      );
    }

    this._columns = cols;
    this._tasks = new Map();
    this._nextId = 1;
    this._console = opts.console ?? new Console();
    this.expand = opts.expand ?? false;
    // [LAW:dataflow-not-control-flow] The option picks the rule once; an
    // update always refills through it. Eased, the tween starts at the
    // update's moment, and the fill it replaces is never asked for again, so
    // a task keeps one animation, not its history: a frame drawn for a
    // moment before the update — a timeline run back — finds the new tween
    // not yet begun, at the value the old one showed.
    const timing = opts.fill;
    this._refill = timing === undefined ? (_from, to) => Animation.constant(to) : (from, to, now) => Timeline.run(Timeline.play(now), tween(from, to, timing));
    if (opts.drawnBy === undefined) {
      this._live = new Live(this, {
        console: this._console,
        clock: opts.clock,
        refreshPerSecond: opts.refreshPerSecond ?? 10,
        autoRefresh: opts.autoRefresh,
        transient: opts.transient,
      });
      this._host = this._live;
    } else {
      this._live = undefined;
      this._host = opts.drawnBy;
    }
  }

  get console(): Console {
    return this._console;
  }

  /** Rich's `Progress.finished`: every task finished, and so true with none. */
  get finished(): boolean {
    return [...this._tasks.values()].every(finished);
  }

  static getDefaultColumns(): ProgressColumn[] {
    return [
      new TextColumn("[progress.description]{task.description}"),
      new BarColumn(),
      new TaskProgressColumn(),
      new TimeRemainingColumn(),
    ];
  }

  addTask(description: string, options?: TaskOptions): number {
    const id = this._nextId++;
    const task: TaskState = {
      id,
      description,
      total: options?.total === undefined ? undefined : finiteCount("total", options.total),
      completed: 0,
      fill: Animation.constant(0),
      visible: options?.visible !== false,
      startTime: options?.start === false ? undefined : this._host.frameTime,
      finishedTime: undefined,
      samples: [],
    };
    this._tasks.set(id, task);
    return id;
  }

  updateTask(taskId: number, options: TaskUpdateOptions): void {
    const task = this._tasks.get(taskId);
    if (!task) return;

    // Rich's order: `advance` is added, then a given `completed` overwrites it,
    // so `completed` wins when both come. Checked whole before any field is
    // written, so a refused update leaves the task as it was.
    const advance = finiteCount("advance", options.advance ?? 0);
    const completed =
      options.completed === undefined
        ? finiteCount("completed + advance", task.completed + advance)
        : finiteCount("completed", options.completed);
    const now = this._host.frameTime;
    recordSample(task.samples, now, completed - task.completed);
    // A retarget is a change of count: an update that leaves it alone leaves
    // the ease running as it was, rather than restarting it from where it is.
    if (completed !== task.completed) task.fill = this._refill(task.fill.at(now), completed, now);
    task.completed = completed;
    if (options.description !== undefined) task.description = options.description;
    if (options.visible !== undefined) task.visible = options.visible;
    const startTime = startedBy(task, now);
    if (!finished(task) && startTime !== undefined && task.total !== undefined && task.completed >= task.total) {
      task.finishedTime = now - startTime;
    }

    if (options.refresh) {
      this.refresh();
    }
  }

  startTask(taskId: number): void {
    const task = this._tasks.get(taskId);
    // Rich's `start_task`: a task already running keeps the time it started.
    if (task) task.startTime ??= this._host.frameTime;
  }

  start(): void {
    this._ownLive("start").start();
  }

  /**
   * The final frame shows every bar at its count: what stays on the screen
   * after the hand-back is where the work got to, not a bar caught mid-ease.
   */
  stop(): void {
    const live = this._ownLive("stop");
    for (const task of this._tasks.values()) task.fill = Animation.constant(task.completed);
    live.stop();
  }

  refresh(): void {
    this._ownLive("refresh").refresh();
  }

  private _ownLive(asked: "start" | "stop" | "refresh"): Live {
    if (this._live === undefined) {
      throw new Error(`Progress.${asked}: this Progress is drawn by the host it was given (drawnBy); ${asked} that host instead`);
    }
    return this._live;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* render(this._drawn(options), options);
  }

  // What each column renders for each task is what the table holds, and so is
  // all a progress display holds.
  *contents(options: RenderOptions): Iterable<Renderable> {
    yield this._drawn(options);
  }

  // Inside a frame, the time its host read for it: a second read here would
  // land a moving bar's stamp a hair after the frame, a moment the host takes
  // for one still to come. A frame is only ever this display's host's,
  // because the tasks were stamped on that host's time and a frame of any
  // other is drawn for a moment on a different clock. A print is drawn for no
  // moment, so it is drawn for the one the program asks at, read as
  // `updateTask` reads it.
  private _drawn(options: RenderOptions): Table {
    const { frame } = options;
    if (frame !== undefined && frame.host !== this._host) {
      throw new Error("a Progress was drawn in a frame of a host other than its own; give it that host as `drawnBy`");
    }
    return this._table(frame?.time ?? this._host.frameTime);
  }

  // Rich's `make_tasks_table`: each column laid out as it says, at `now` on
  // this display's clock.
  private _table(now: number): Table {
    const table = Table.grid({ expand: this.expand });
    for (const col of this._columns) {
      table.addColumn(undefined, col.tableColumn);
    }

    // [LAW:effects-at-boundaries] One moment a frame, handed to every column
    // as the task's `time` and `elapsed`.
    for (const { samples, ...state } of this._tasks.values()) {
      if (!state.visible) continue;
      const startTime = startedBy(state, now);
      const started = startTime !== undefined;
      const task: Task = {
        ...state,
        startTime,
        time: now,
        elapsed: started ? now - startTime : undefined,
        speed: started ? sampleSpeed(samples) : undefined,
      };
      table.addRow(...this._columns.map((col) => col.render(task)));
    }
    return table;
  }
}

// --- track ---

export function* track<T>(
  iterable: Iterable<T>,
  options?: { description?: string; total?: number; console?: Console },
): Iterable<T> {
  const items = [...iterable];
  const total = options?.total ?? items.length;
  const progress = new Progress({ console: options?.console });
  const taskId = progress.addTask(options?.description ?? "Working...", { total });
  progress.start();

  try {
    for (let i = 0; i < items.length; i++) {
      yield items[i]!;
      progress.updateTask(taskId, { completed: i + 1 });
    }
  } finally {
    progress.stop();
  }
}
