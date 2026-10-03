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
import { systemClock, type Clock } from "../core/clock.js";
import { Table, type ColumnOptions } from "./table.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";

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
  visible: boolean;
  /** When the task started, in seconds on its `Progress`'s clock; undefined until it has. */
  startTime: number | undefined;
  /**
   * Rich's `Task.elapsed`: seconds since the task started, as of the frame
   * being drawn — `Progress` reads its clock once a frame and hands columns
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
   * Rich's `Task.speed`: steps a second over the task's recent updates, as of
   * the last one. Undefined until the task has started and two updates that
   * moved it lie apart in time within the last `SPEED_ESTIMATE_PERIOD`.
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
type TaskState = Omit<Task, "elapsed" | "speed"> & { samples: readonly ProgressSample[] };

/**
 * Rich's `Progress.update` bookkeeping: the samples still inside the period
 * as of `now`, plus this update's if it moved the task forward.
 */
function recordSample(samples: readonly ProgressSample[], now: number, moved: number): ProgressSample[] {
  const fresh = samples.filter((sample) => sample.timestamp >= now - SPEED_ESTIMATE_PERIOD);
  const added = moved > 0 ? [{ timestamp: now, completed: moved }] : [];
  return [...fresh, ...added].slice(-MAX_SAMPLES);
}

/**
 * Rich's `Task.speed` over a started task's samples: everything moved after
 * the first sample, over the time from the first to the last. No samples, or
 * none apart in time, is no speed.
 */
function sampleSpeed(samples: readonly ProgressSample[]): number | undefined {
  const span = (samples.at(-1)?.timestamp ?? 0) - (samples[0]?.timestamp ?? 0);
  if (span === 0) return undefined;
  return samples.slice(1).reduce((sum, sample) => sum + sample.completed, 0) / span;
}

/**
 * A count as a task takes it in. [LAW:single-enforcer] `addTask` and
 * `updateTask` are where counts enter, so a NaN or an Infinity is refused there,
 * with the caller's stack, rather than drawn as `NaN%` by one column and thrown
 * on a refresh tick by another.
 */
function finiteCount(field: "total" | "completed" | "advance", value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`progress task ${field} must be a finite number, got ${value}`);
  return value;
}

/** Rich's `Task.finished`. [LAW:one-source-of-truth] The one predicate every reader of "finished" asks. */
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

  render(task: Task): ProgressBar {
    return new ProgressBar({
      total: task.total ?? 100,
      completed: task.completed,
      width: this.barWidth,
    });
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
  private _spinner: Spinner;
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

  render(task: Task): Renderable {
    return finished(task) ? this._finishedText : this._spinner;
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

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// --- Progress ---

export interface ProgressOptions {
  refreshPerSecond?: number;
  autoRefresh?: boolean;
  transient?: boolean;
  expand?: boolean;
  console?: Console;
  /**
   * What tasks are timed by and frames are drawn on, Rich's `get_time`;
   * defaults to the platform's monotonic clock. Handed on to the `Live`.
   */
  clock?: Clock;
}

export class Progress implements Renderable {
  private _columns: ProgressColumn[];
  private _tasks: Map<number, TaskState>;
  private _nextId: number;
  private _live: Live;
  private _console: Console;
  private readonly _clock: Clock;
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
    this._clock = opts.clock ?? systemClock();
    this._live = new Live(this, {
      console: this._console,
      clock: this._clock,
      refreshPerSecond: opts.refreshPerSecond ?? 10,
      autoRefresh: opts.autoRefresh,
      transient: opts.transient,
    });
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
      visible: options?.visible !== false,
      startTime: options?.start === false ? undefined : this._clock.now(),
      finishedTime: undefined,
      samples: [],
    };
    this._tasks.set(id, task);
    return id;
  }

  updateTask(taskId: number, options: TaskUpdateOptions): void {
    const task = this._tasks.get(taskId);
    if (!task) return;

    // Rich's order, `completed` then `advance`, checked whole before any field
    // is written, so a refused update leaves the task as it was.
    const advance = finiteCount("advance", options.advance ?? 0);
    const completed = finiteCount("completed", (options.completed ?? task.completed) + advance);
    const now = this._clock.now();
    task.samples = recordSample(task.samples, now, completed - task.completed);
    task.completed = completed;
    if (options.description !== undefined) task.description = options.description;
    if (options.visible !== undefined) task.visible = options.visible;
    if (
      !finished(task) &&
      task.startTime !== undefined &&
      task.total !== undefined &&
      task.completed >= task.total
    ) {
      task.finishedTime = now - task.startTime;
    }

    if (options.refresh) {
      this._live.update(this, { refresh: true });
    }
  }

  startTask(taskId: number): void {
    const task = this._tasks.get(taskId);
    // Rich's `start_task`: a task already running keeps the time it started.
    if (task) task.startTime ??= this._clock.now();
  }

  start(): void {
    this._live.start();
  }

  stop(): void {
    this._live.stop();
  }

  refresh(): void {
    this._live.refresh();
  }

  *render(options: RenderOptions): Iterable<Segment> {
    // Rich's `make_tasks_table`: each column laid out as it says.
    const table = Table.grid({ expand: this.expand });
    for (const col of this._columns) {
      table.addColumn(undefined, col.tableColumn);
    }

    // [LAW:effects-at-boundaries] One read of the clock a frame, handed to
    // every column as the task's `elapsed`.
    const now = this._clock.now();
    for (const { samples, ...state } of this._tasks.values()) {
      if (!state.visible) continue;
      const { startTime } = state;
      const started = startTime !== undefined;
      const task: Task = {
        ...state,
        elapsed: started ? now - startTime : undefined,
        speed: started ? sampleSpeed(samples) : undefined,
      };
      table.addRow(...this._columns.map((col) => col.render(task)));
    }

    yield* table.render(options);
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
