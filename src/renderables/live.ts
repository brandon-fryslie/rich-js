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
 *
 * On a console that is not interactive — a file, a pipe, a CI log — neither
 * mode paints: what is printed goes out plain, and the frame is written once,
 * when the display stops, as Rich's `Live` does.
 *
 * Live is not built on `App`, though both take a terminal, paint a frame over
 * the last and hand the terminal back. That much is the `Painter`'s, and both
 * hold one. The rest differs in who owns what. An `App` owns its terminal: it
 * starts and stops a `TerminalHost`, sets raw mode, reads keys and pointers,
 * suspends, and builds its own `Console` from the host. A `Live` owns none of
 * that. It draws into a `Console` its caller owns and goes on writing
 * through — a sink that may be a file, whose every other write has to step
 * around the frame (`Console.claimLiveRegion`) — and it reads no input. An
 * `App` over that console would need a host that cannot start, stop, read or
 * suspend, and a second owner of the console's writes.
 */

import { frameRate, systemClock, type Clock, type FrameRate } from "../core/clock.js";
import { Console } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { FinalFramePainter, SurfacePainter, type Painter, type Screen } from "../core/paint.js";
import { fitHeight, type Renderable } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";

export interface LiveOptions {
  /** Frames a second while auto-refreshing: positive and finite, fractional included. */
  refreshPerSecond?: number;
  /** What the auto-refresh ticks on. The platform's, unless given. */
  clock?: Clock;
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
  private readonly _rate: FrameRate;
  private readonly _clock: Clock;
  private _autoRefresh: boolean;
  private _transient: boolean;
  private _verticalOverflow: "crop" | "ellipsis" | "visible";
  private readonly _painter: Painter;
  private _stopTicking: Unsubscribe | undefined;
  // [LAW:one-source-of-truth] The console's live region, held from `start()`
  // to the hand-back — which is what "started" means, so there is no separate
  // flag to disagree with it.
  private _held: Unsubscribe | null;

  constructor(renderable?: Renderable, options?: LiveOptions) {
    this._renderable = renderable;
    this._console = options?.console ?? new Console({ forceTerminal: true });
    // [LAW:parse-dont-validate] Parsed whether or not it auto-refreshes, so a
    // rate that could never tick is refused where it is given.
    this._rate = frameRate(options?.refreshPerSecond ?? 4);
    this._clock = options?.clock ?? systemClock();
    this._autoRefresh = options?.autoRefresh !== false;
    this._transient = options?.transient ?? false;
    this._verticalOverflow = options?.verticalOverflow ?? "ellipsis";
    const write = (bytes: string): void => void this._console.file.write(bytes);
    // [LAW:dataflow-not-control-flow] What the console is decides which
    // painter Live holds; every frame then takes the same path through it.
    this._painter = this._console.isInteractive
      ? new SurfacePainter(options?.altScreen ? "alternate" : "inline", write)
      : new FinalFramePainter(write);
    this._held = null;
  }

  /**
   * The console to print through while this Live runs: what it prints lands
   * above an inline frame. The alternate screen is all frame, and paints over it.
   */
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
    const held = this._console.claimLiveRegion({ around: (text) => this._stepAround(text) });
    this._held = held;
    this._painter.take();

    if (this._autoRefresh) {
      // No caller is on the stack to run `stop()` for a frame that throws
      // here, and in Node the throw ends the process — so the terminal is
      // handed back first, and the error then goes on to wherever an uncaught
      // one goes.
      this._stopTicking = this._clock.every(this._rate, () => {
        try {
          this.refresh();
        } catch (error) {
          this._release(held);
          throw error;
        }
      });
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
  // again under it, as Rich's render hook does — in the bytes the console
  // writes, so a render that throws writes nothing.
  private _stepAround(text: string): string {
    return this._painter.around(text, this._frame(), this._screen(), this._console.destination);
  }

  // [LAW:effects-at-boundaries] The frame is fully rendered before a byte
  // reaches the terminal, and whatever takes the last frame away goes out in
  // the same write as the new one — so a render that throws leaves the last
  // good frame showing.
  private _paint(frame: Segment[][]): void {
    this._painter.paint(frame, this._screen(), this._console.destination);
  }

  private _screen(): Screen {
    const { height, maxWidth } = this._console.options;
    return { rows: height.rows, cols: maxWidth };
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
    this._stopTicking?.();
    this._stopTicking = undefined;
    this._painter.handBack();
  }
}
