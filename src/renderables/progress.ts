/**
 * Progress — displays continuously updated progress bars.
 */

import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { RichText } from "../core/text.js";
import { Console } from "../core/console.js";
import { ProgressBar } from "./progressBar.js";
import { Spinner } from "./spinner.js";
import { Live } from "./live.js";
import { Table } from "./table.js";
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

interface Task {
  id: number;
  description: string;
  total: number | undefined;
  completed: number;
  started: boolean;
  visible: boolean;
  startTime: number;
  elapsed: number;
}

// --- Progress Columns ---

export interface ProgressColumn extends Renderable {
  render(options: RenderOptions, task?: Task): Iterable<Segment>;
}

export class TextColumn implements ProgressColumn {
  readonly format: string;

  constructor(format?: string) {
    this.format = format ?? "{task.description}";
  }

  *render(_options: RenderOptions, task?: Task): Iterable<Segment> {
    const text = this.format.replace(/\{task\.description\}/g, task?.description ?? "");
    yield new Segment(text);
  }
}

export class BarColumn implements ProgressColumn {
  readonly barWidth: number;

  constructor(barWidth?: number) {
    this.barWidth = barWidth ?? 40;
  }

  *render(_options: RenderOptions, task?: Task): Iterable<Segment> {
    const bar = new ProgressBar({
      total: task?.total ?? 100,
      completed: task?.completed ?? 0,
      width: this.barWidth,
    });
    yield* bar.render(_options);
  }
}

export class TaskProgressColumn implements ProgressColumn {
  *render(_options: RenderOptions, task?: Task): Iterable<Segment> {
    const percent = task && task.total
      ? Math.min(100, Math.round((task.completed / task.total) * 100))
      : 0;
    yield new Segment(`${percent}%`, Style.parse("progress.percentage"));
  }
}

export class TimeRemainingColumn implements ProgressColumn {
  *render(_options: RenderOptions, task?: Task): Iterable<Segment> {
    if (!task || !task.total || !task.started || task.completed <= 0) {
      yield new Segment("-:--:--", Style.parse("progress.remaining"));
      return;
    }
    const elapsed = (Date.now() - task.startTime) / 1000;
    const rate = task.completed / elapsed;
    const remaining = (task.total - task.completed) / rate;
    yield new Segment(formatTime(remaining), Style.parse("progress.remaining"));
  }
}

export class TimeElapsedColumn implements ProgressColumn {
  *render(_options: RenderOptions, task?: Task): Iterable<Segment> {
    if (!task || !task.started) {
      yield new Segment("0:00:00", Style.parse("progress.elapsed"));
      return;
    }
    const elapsed = (Date.now() - task.startTime) / 1000;
    yield new Segment(formatTime(elapsed), Style.parse("progress.elapsed"));
  }
}

export class SpinnerColumn implements ProgressColumn {
  private _spinner: Spinner;

  constructor(spinnerName?: string) {
    this._spinner = new Spinner(spinnerName);
  }

  *render(options: RenderOptions, _task?: Task): Iterable<Segment> {
    yield* this._spinner.render(options);
  }
}

export class MofNCompleteColumn implements ProgressColumn {
  *render(_options: RenderOptions, task?: Task): Iterable<Segment> {
    const completed = task?.completed ?? 0;
    const total = task?.total ?? "?";
    yield new Segment(`${completed}/${total}`);
  }
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
}

export class Progress implements Renderable {
  private _columns: ProgressColumn[];
  private _tasks: Map<number, Task>;
  private _nextId: number;
  private _live: Live;
  private _console: Console;
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
    this._console = opts.console ?? new Console({ forceTerminal: true });
    this.expand = opts.expand ?? false;
    this._live = new Live(this, {
      console: this._console,
      refreshPerSecond: opts.refreshPerSecond ?? 10,
      autoRefresh: opts.autoRefresh,
      transient: opts.transient,
    });
  }

  get console(): Console {
    return this._console;
  }

  get finished(): boolean {
    for (const task of this._tasks.values()) {
      if (!task.started || (task.total !== undefined && task.completed < task.total)) {
        return false;
      }
    }
    return this._tasks.size > 0;
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
    const task: Task = {
      id,
      description,
      total: options?.total,
      completed: 0,
      started: options?.start !== false,
      visible: options?.visible !== false,
      startTime: Date.now(),
      elapsed: 0,
    };
    this._tasks.set(id, task);
    return id;
  }

  updateTask(taskId: number, options: TaskUpdateOptions): void {
    const task = this._tasks.get(taskId);
    if (!task) return;

    if (options.completed !== undefined) task.completed = options.completed;
    if (options.advance !== undefined) task.completed += options.advance;
    if (options.description !== undefined) task.description = options.description;
    if (options.visible !== undefined) task.visible = options.visible;

    if (options.refresh) {
      this._live.update(this, { refresh: true });
    }
  }

  startTask(taskId: number): void {
    const task = this._tasks.get(taskId);
    if (task) {
      task.started = true;
      task.startTime = Date.now();
    }
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
    const table = Table.grid({ expand: this.expand });
    for (const _col of this._columns) {
      table.addColumn();
    }

    for (const task of this._tasks.values()) {
      if (!task.visible) continue;
      const cells: unknown[] = this._columns.map((col) => {
        const segs = [...col.render(options, task)];
        // Build a RichText that preserves segment styles as spans
        const text = new RichText("", { end: "" });
        for (const seg of segs) {
          text.append(seg.text, seg.style);
        }
        return text;
      });
      table.addRow(...cells);
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
