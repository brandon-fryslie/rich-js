/**
 * Live — animates a portion of the terminal by continuously re-rendering.
 *
 * Two modes, each painting every frame over the last in place
 * (`core/paint`):
 * - **Inline** (default): the frame starts at the cursor's line and keeps its
 *   own height. Good for spinners/progress bars below other output.
 * - **Alt-screen** (`altScreen: true`): enters the alternate screen buffer
 *   on start and restores the original buffer on stop. The screen is the
 *   frame's region, so a `Layout` fills it. Good for full-screen TUI apps.
 */

import { Console } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { Painter } from "../core/paint.js";
import { fitHeight, type Renderable } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";

export interface LiveOptions {
  refreshPerSecond?: number;
  autoRefresh?: boolean;
  transient?: boolean;
  console?: Console;
  verticalOverflow?: "crop" | "ellipsis" | "visible";
  /** When true, Live enters the alternate screen buffer on start() and
   *  restores the original on stop(). The screen is the frame's region, so
   *  a full-screen layout fills it. */
  altScreen?: boolean;
}

export class Live {
  private _renderable: Renderable | undefined;
  private _console: Console;
  private _refreshPerSecond: number;
  private _autoRefresh: boolean;
  private _transient: boolean;
  private _verticalOverflow: "crop" | "ellipsis" | "visible";
  private readonly _painter: Painter;
  private _timer: ReturnType<typeof setInterval> | undefined;
  // [LAW:one-source-of-truth] The console's live region, held from `start()`
  // to the hand-back — which is what "started" means, so there is no separate
  // flag to disagree with it.
  private _held: Unsubscribe | null;

  constructor(renderable?: Renderable, options?: LiveOptions) {
    this._renderable = renderable;
    this._console = options?.console ?? new Console({ forceTerminal: true });
    this._refreshPerSecond = options?.refreshPerSecond ?? 4;
    this._autoRefresh = options?.autoRefresh !== false;
    this._transient = options?.transient ?? false;
    this._verticalOverflow = options?.verticalOverflow ?? "ellipsis";
    this._painter = new Painter(options?.altScreen ? "alternate" : "inline", (bytes) =>
      this._console.file.write(bytes),
    );
    this._held = null;
  }

  /** The console to print through while this Live runs: what it prints lands above the frame. */
  get console(): Console {
    return this._console;
  }

  get renderable(): Renderable | undefined {
    return this._renderable;
  }

  start(): void {
    if (this._held !== null) return;
    // Claimed before a byte is written, so a console another Live is running
    // on refuses this one with the terminal untouched.
    const held = this._console.claimLiveRegion({ around: (write) => this._stepAround(write) });
    this._held = held;
    this._painter.take();

    if (this._autoRefresh) {
      const interval = Math.floor(1000 / this._refreshPerSecond);
      // No caller is on the stack to run `stop()` for a frame that throws
      // here, and in Node the throw ends the process — so the terminal is
      // handed back first, and the error then goes on to wherever an uncaught
      // one goes.
      this._timer = setInterval(() => {
        try {
          this.refresh();
        } catch (error) {
          this._release(held);
          throw error;
        }
      }, interval);
    }
  }

  stop(): void {
    const held = this._held;
    if (held === null) return;
    // [LAW:no-silent-failure] A final frame that throws still propagates, and
    // the terminal is handed back on the way out.
    try {
      if (this._transient) {
        this._paint([]);
      } else {
        this.refresh();
      }
    } finally {
      this._release(held);
    }
  }

  update(renderable?: Renderable, options?: { refresh?: boolean }): void {
    if (renderable !== undefined) {
      this._renderable = renderable;
    }
    if (options?.refresh) {
      this.refresh();
    }
  }

  refresh(): void {
    // A frame is drawn only while this Live holds the terminal, as in Rich:
    // before `start()` or after the hand-back it would land on a screen that
    // belongs to someone else — the main buffer, under the user's own output.
    if (this._held === null) return;
    this._paint(this._frame());
  }

  private _frame(): Segment[][] {
    if (!this._renderable) return [];
    // [LAW:dataflow-not-control-flow] Both modes render under the terminal's
    // rows and differ only in what those rows are: the alternate screen is a
    // region the frame stands in, and an inline frame keeps its natural height
    // under them as a ceiling. Live set the budget, so Live shapes what comes
    // back — its overflow policy, then `fitHeight`, which pads only a region.
    const options = this._console.options;
    const height = this._painter.height(options.height.rows);
    const lines = Segment.splitLines(this._renderable.render({ ...options, height }));
    return fitHeight(this._overflow(lines, height.rows), height);
  }

  // What the console writes goes where the frame was, and the frame is painted
  // again under it, as Rich's render hook does. The frame is rendered first,
  // so a render that throws leaves the terminal as it was.
  private _stepAround(write: () => void): void {
    const frame = this._frame();
    this._paint([]);
    write();
    this._paint(frame);
  }

  // [LAW:effects-at-boundaries] The frame is fully rendered before a byte
  // reaches the terminal, and whatever takes the last frame away goes out in
  // the same write as the new one — so a render that throws leaves the last
  // good frame showing.
  private _paint(frame: Segment[][]): void {
    const { height, maxWidth } = this._console.options;
    this._painter.paint(frame, { rows: height.rows, cols: maxWidth }, this._console.destination);
  }

  // Lines past `rows`: dropped, with the last kept row replaced by an ellipsis,
  // or left for the terminal to scroll.
  private _overflow(lines: Segment[][], rows: number): Segment[][] {
    if (this._verticalOverflow === "visible" || lines.length <= rows) return lines;
    const kept = lines.slice(0, rows);
    if (this._verticalOverflow === "ellipsis" && kept.length > 0) {
      kept[kept.length - 1] = [new Segment("...")];
    }
    return kept;
  }

  // [LAW:single-enforcer] The one way the terminal is handed back — the timer
  // stopped, the cursor shown, the alternate screen left — whether `stop()`
  // ran or a frame threw with no caller to run it.
  private _release(held: Unsubscribe): void {
    held();
    this._held = null;
    clearInterval(this._timer);
    this._timer = undefined;
    this._painter.handBack();
  }
}
