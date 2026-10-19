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
import { FinalFramePainter, SurfacePainter, type FrameSource, type Painter, type Screen } from "../core/paint.js";
import { fitHeight, render, type Renderable } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import { Timeline } from "../core/timeline.js";
import { drawView, hostView, undrawn, type DrawnView, type FrameSays, type HostView, type View } from "../core/view.js";

// Nothing: what a Live made with no view draws until `update` gives it one.
const NOTHING: Renderable = { render: () => [] };

export interface LiveOptions {
  /**
   * How often the auto-refresh draws on its own, in frames a second:
   * positive and finite, fractional included. The next frame comes a frame
   * interval after the last one drawn, a `refresh()` of your own included,
   * or sooner when that frame's content says it changes sooner
   * (`Segment.nextChange`).
   */
  refreshPerSecond?: number;
  /** What the auto-refresh waits on. The platform's, unless given. */
  clock?: Clock;
  /**
   * The map from the clock to the time the view is drawn for (`Timeline`).
   * Playing from 0 when the host is made, at the clock's pace, unless given
   * — so a tween in the view starts when the host is made, not when the clock
   * began; `live.timeline` reads and replaces it.
   */
  timeline?: Timeline;
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
  private _view: HostView;
  private _console: Console;
  private readonly _rate: FrameRate;
  private readonly _clock: Clock;
  private _timeline: Timeline;
  private _autoRefresh: boolean;
  private _transient: boolean;
  private _verticalOverflow: "crop" | "ellipsis" | "visible";
  private readonly _painter: Painter;
  // The one wait for the next auto-refresh frame, armed after each frame, and
  // the clock moment it is due at.
  private _waking: { readonly at: number; readonly stop: Unsubscribe } | undefined;
  // [LAW:one-source-of-truth] The console's live region, held from `start()`
  // to the hand-back — which is what "started" means, so there is no separate
  // flag to disagree with it.
  private _held: Unsubscribe | null;

  constructor(view?: View, options?: LiveOptions) {
    this._view = hostView(view ?? NOTHING);
    this._console = options?.console ?? new Console();
    // [LAW:parse-dont-validate] Parsed whether or not it auto-refreshes, so a
    // rate that could never tick is refused where it is given.
    this._rate = frameRate(options?.refreshPerSecond ?? 4);
    this._clock = options?.clock ?? systemClock();
    this._timeline = options?.timeline ?? Timeline.play(this._clock.now());
    this._autoRefresh = options?.autoRefresh !== false;
    this._transient = options?.transient ?? false;
    this._verticalOverflow = options?.verticalOverflow ?? "ellipsis";
    // [LAW:dataflow-not-control-flow] What the console is decides which
    // painter Live holds; every frame then takes the same path through it.
    // The final frame is a print, as in Rich, so a recording or a capture
    // holds it with everything else the console wrote.
    this._painter = this._console.isInteractive
      ? new SurfacePainter(options?.altScreen ? "alternate" : "inline", (bytes) => void this._console.file.write(bytes))
      : new FinalFramePainter((frame) => this._console.print(linesOf(frame)));
    this._held = null;
  }

  /**
   * The console to print through while this Live runs: what it prints lands
   * above an inline frame. The alternate screen is all frame, and paints over it.
   */
  get console(): Console {
    return this._console;
  }

  /** The clock the auto-refresh waits on: where the host time a `Timeline` operation takes is read. */
  get clock(): Clock {
    return this._clock;
  }

  /** The map from the clock to the time the view is drawn for. */
  get timeline(): Timeline {
    return this._timeline;
  }

  /**
   * Replace the timeline and draw the frame for the time it now maps the
   * clock's now to, so a seek shows where it sought, once. Paused, the frame
   * then holds — the auto-refresh waits on nothing until the timeline plays
   * again — while `refresh()` and `update(…, { refresh: true })` still draw.
   */
  set timeline(timeline: Timeline) {
    this._timeline = timeline;
    this.refresh();
  }

  start(): void {
    if (this._held !== null) return;
    // Claimed before a byte is written, so a console another Live is running
    // on refuses this one with the terminal untouched.
    const held = this._console.claimLiveRegion({ around: (text) => this._stepAround(text) });
    this._held = held;
    this._painter.take();
    // Nothing is drawn yet, so nothing has said when it changes: the first
    // auto-refresh frame comes at the rate, from now.
    this._wake(held, undrawn(this._clock.now()));
  }

  stop(): void {
    const held = this._held;
    if (held === null) return;
    // [LAW:no-silent-failure] A final frame that throws still propagates, and
    // the terminal is handed back on the way out.
    try {
      if (this._transient) {
        this._paint(() => []);
      } else {
        this.refresh();
      }
    } finally {
      this._release(held);
    }
  }

  update(view?: View, options?: { refresh?: boolean }): void {
    if (view !== undefined) {
      this._view = hostView(view);
    }
    if (options?.refresh) {
      this.refresh();
    } else if (view !== undefined && this._held !== null) {
      // The last wake was armed for what the old view said; a new view has
      // said nothing yet, so the auto-refresh draws it by the rate's next
      // frame from now — sooner if the wake already armed is, and never
      // later, so updates faster than the rate do not put the frame off.
      const now = this._clock.now();
      if (this._waking === undefined || this._waking.at > now + this._rate.interval) this._wake(this._held, undrawn(now));
    }
  }

  refresh(): void {
    // A frame is drawn only while this Live holds the terminal, as in Rich:
    // before `start()` or after the hand-back it would land on a screen that
    // belongs to someone else — the main buffer, under the user's own output.
    const held = this._held;
    if (held === null) return;
    // [LAW:no-ambient-temporal-coupling] The frame says when what it shows
    // next changes; the next auto-refresh frame is then, or at the rate,
    // whichever is sooner. The painter decides whether this frame is drawn
    // now — a final-frame painter draws nothing before the hand-back — and a
    // frame not drawn has said nothing.
    let said: FrameSays | undefined;
    this._paint(() => {
      const drawn = this._frame();
      said = drawn;
      return drawn.lines;
    });
    this._wake(held, said ?? undrawn(this._clock.now()));
  }

  // Arm the one wait for the next auto-refresh frame while `held`, from what
  // the frame says: at the rate while it moves; at its `nextChange` when it
  // holds until a moment, or at the rate if that is sooner and the frame is
  // silent — drawn from state that may change without saying so, which the
  // auto-refresh polls, as Rich's does. A frame from an animation that holds
  // for good — arrived, or drawn for a paused timeline's held time — waits
  // on nothing until a caller draws. Every moment is measured from the
  // frame's own `t`, never from a second reading of the clock, so the rate
  // does not stretch by what a frame cost to draw, and a change that fell
  // due while it was drawn is drawn at once (`Clock.at` fires now for a time
  // already past).
  private _wake(held: Unsubscribe, { t, nextChange, silent }: FrameSays): void {
    this._waking?.stop();
    this._waking = undefined;
    const rate = t + this._rate.interval;
    const at = nextChange <= t ? rate : Math.min(nextChange, silent ? rate : Number.POSITIVE_INFINITY);
    if (!this._autoRefresh || at === Number.POSITIVE_INFINITY) return;
    // No caller is on the stack to run `stop()` for a frame that throws
    // here, and in Node the throw ends the process — so the terminal is
    // handed back first, and the error then goes on to wherever an uncaught
    // one goes.
    const stop = this._clock.at(at, () => {
      try {
        this.refresh();
      } catch (error) {
        this._release(held);
        throw error;
      }
    });
    this._waking = { at, stop };
  }

  // The frame at the clock's now, drawn for the time the timeline maps it to,
  // with when it next changes on the clock: what the next wake is measured from.
  private _frame(): DrawnView {
    // [LAW:effects-at-boundaries] One read of the clock a frame, handed to
    // the view as the frame's time.
    // [LAW:dataflow-not-control-flow] Both modes render under the terminal's
    // rows and differ only in what those rows are: the alternate screen is a
    // region the frame stands in, and an inline frame keeps its natural height
    // under them as a ceiling. Live set the budget, so Live shapes what comes
    // back — its overflow policy, then `fitHeight`, which pads only a region.
    const options = this._console.options;
    const height = this._painter.height(options.height.rows);
    return drawView(this._view, this._timeline, this._clock.now(), (renderable) => {
      const lines = Segment.splitLines(render(renderable, { ...options, height }));
      return fitHeight(this._overflow(lines, height.rows), height);
    });
  }

  // What the console writes goes where the frame was, and the frame is painted
  // again under it, as Rich's render hook does — in the bytes the console
  // writes, so a render that throws writes nothing.
  private _stepAround(text: string): string {
    return this._painter.around(text, () => this._frame().lines, this._screen(), this._console.destination);
  }

  // [LAW:effects-at-boundaries] The frame is fully rendered before a byte
  // reaches the terminal, and whatever takes the last frame away goes out in
  // the same write as the new one — so a render that throws leaves the last
  // good frame showing.
  private _paint(frame: FrameSource): void {
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
    this._waking?.stop();
    this._waking = undefined;
    this._painter.handBack();
  }
}

// A drawn frame as a renderable, each row a line, for the console to print.
function linesOf(frame: Segment[][]): Renderable {
  return { render: () => frame.flatMap((row) => [...row, Segment.line()]) };
}
