/**
 * App — the runtime a terminal application runs in: it takes the terminal,
 * paints one renderable on it every frame, and hands the terminal back on
 * every path out.
 *
 * [LAW:single-enforcer] Every change this runtime makes to the terminal —
 * the alternate screen, pointer reporting, the hidden cursor, raw mode — is
 * made by `enter` and
 * undone by `leave`, and nothing else touches them. Stopping, suspending, an
 * error in a frame and the program ending by a signal or a crash all hand the
 * terminal back through `leave`, so there is one list of what to undo and no
 * exit path can hold a shorter one.
 *
 * [LAW:one-source-of-truth] The frame on screen is one value: the rows last
 * painted, carrying on every cell where its owner drew it (`core/anchor`).
 * Nothing about it is cached beside it, so a resize invalidates nothing — it
 * is input to the next frame, which replaces the rows and their anchors at
 * once. An event arriving before that repaint lands on the frame on screen,
 * which is the one the user pointed at.
 *
 * [LAW:locality-or-seam] The terminal's bytes are identical under every host
 * and live here: entering and leaving the alternate screen, the cursor, the
 * frame's encoding. What differs per host — whether the program can end
 * under us, how it is suspended — is the `TerminalHost`'s, so the same app
 * runs in node and in a browser with no path of its own for either.
 */

import { frameRate, systemClock, type Clock, type FrameRate } from "../core/clock.js";
import { Console, type ConsoleOptions } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { Painter, type Surface } from "../core/paint.js";
import { fitHeight, type Renderable } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import { hostEnvironment } from "./host-environment.js";
import type { TerminalHost } from "./terminal-host.js";

/**
 * Where an app is in its life. `idle` has not run; `running` holds the
 * terminal and paints; `suspended` has handed it back until the host resumes
 * the program; `stopped` has handed it back for good.
 */
export type AppPhase = "idle" | "running" | "suspended" | "stopped";

// [LAW:one-source-of-truth] How a frame draws — its glyphs, the style names
// it knows, what happens to a style it cannot resolve, markup and
// highlighting — is the console's to say, so App takes those options as the
// console declares them. This list is both the type and what is copied: the
// host alone decides the console's size, colours and sink, so no other
// property of the options object reaches it, whatever the object carries.
const DRAW_OPTIONS = ["asciiOnly", "theme", "onStyleError", "markup", "highlight", "highlighter"] as const;
type DrawOption = (typeof DRAW_OPTIONS)[number];
type DrawOptions = Readonly<Pick<ConsoleOptions, DrawOption>>;

function drawOptions(options: DrawOptions): Pick<ConsoleOptions, DrawOption> {
  const picked: Pick<ConsoleOptions, DrawOption> = {};
  const copy = <K extends DrawOption>(key: K): void => {
    picked[key] = options[key];
  };
  DRAW_OPTIONS.forEach(copy);
  return picked;
}

export interface AppOptions extends DrawOptions {
  /** The terminal the app runs on. The app starts and stops it. */
  readonly host: TerminalHost;
  readonly surface: Surface;
  /**
   * The app's root renderable, asked for once per frame, so a view of the
   * app's state is drawn from the state as it is at that frame. `t` is the
   * frame's time in seconds on the app's `clock`, which is what an effect is
   * sampled at.
   */
  readonly view: (t: number) => Renderable;
  /** What the app reads the time from and ticks on. The platform's, unless given. */
  readonly clock?: Clock;
  /** How often the app paints while something is animating. 30 frames a second, unless given. */
  readonly rate?: FrameRate;
}

const DEFAULT_RATE = frameRate(30);

// Button presses, motion and the wheel, in the SGR encoding: coordinates as
// decimal numbers, so a terminal wider than 223 columns still reports them.
// The terminal reports a pointer by its row on the screen, and an inline
// frame does not know which row of the screen it starts on, so only the
// alternate surface gets them.
const POINTER: Record<Surface, { readonly on: string; readonly off: string }> = {
  alternate: { on: "\x1b[?1006h\x1b[?1000h\x1b[?1003h", off: "\x1b[?1003l\x1b[?1000l\x1b[?1006l" },
  inline: { on: "", off: "" },
};

export class App {
  private readonly host: TerminalHost;
  private readonly surface: Surface;
  private readonly view: (t: number) => Renderable;
  private readonly clock: Clock;
  private readonly rate: FrameRate;
  // What is animating now: one token per `animate()` not yet released.
  private readonly animations = new Set<object>();
  private stopTicking: Unsubscribe | null = null;
  // [LAW:one-source-of-truth] The host is the console's whole environment:
  // its size, its colours, where bytes go. Every frame renders with this
  // console's options and is encoded for its destination.
  private readonly console: Console;

  private _phase: AppPhase = "idle";
  private _frame: readonly (readonly Segment[])[] = [];
  private readonly painter: Painter;
  private refreshQueued = false;
  private subscriptions: Unsubscribe[] = [];
  private readonly paintHandlers = new Set<(frame: readonly (readonly Segment[])[]) => void>();
  private settle: (outcome: Outcome) => void = () => {};

  constructor(options: AppOptions) {
    this.host = options.host;
    this.surface = options.surface;
    this.painter = new Painter(options.surface, (bytes) => this.host.write(bytes));
    this.view = options.view;
    this.clock = options.clock ?? systemClock();
    this.rate = options.rate ?? DEFAULT_RATE;
    this.console = new Console({ ...drawOptions(options), environment: hostEnvironment(options.host) });
  }

  get phase(): AppPhase {
    return this._phase;
  }

  /** The rows on screen now, as painted: what a pointer event lands on. */
  get frame(): readonly (readonly Segment[])[] {
    return this._frame;
  }

  /**
   * Take the terminal, paint the first frame, and resolve when the app stops
   * — or reject with the error a frame threw or `fail` was given, the terminal
   * handed back first.
   * When the program ends under the app, `run` does not settle: nothing after
   * it runs, as nothing after it would have without the app. An app runs once.
   */
  run(): Promise<void> {
    if (this._phase !== "idle") {
      return Promise.reject(new Error(`App.run: an app runs once, and this one is ${this._phase}`));
    }
    return new Promise<void>((resolve, reject) => {
      this.settle = (outcome) => {
        switch (outcome.kind) {
          case "stopped":
            return resolve();
          case "failed":
            return reject(outcome.error);
          // The rest of a crash — its report, then its exit — is still
          // running, and code resumed after `run` would run inside it.
          case "ended":
            return;
        }
      };
      this._phase = "running";
      this.host.start();
      this.subscriptions = [
        this.host.onResize(() => this.refresh()),
        // The program is ending under the app — by a signal, a crash, or an
        // exit the app's own code never saw. Ending hands the terminal back,
        // and the program then ends as it was going to.
        this.host.onExit(() => this.end({ kind: "ended" })),
      ];
      this.enter();
      this.paint();
      this.tick();
    });
  }

  /**
   * Paint a new frame from the view, once, in a later task: every change made
   * before then lands in the one frame.
   *
   * [LAW:no-ambient-temporal-coupling] A task, not a microtask. Input is read
   * between tasks, so a view whose every frame asks for another still hears
   * its keys — Ctrl+C included — where a microtask chain would starve them
   * for as long as it ran.
   */
  refresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    setTimeout(() => {
      this.refreshQueued = false;
      // [LAW:types-are-the-program] Only a running app holds the terminal; a
      // suspended one repaints when it resumes, and a stopped one never does.
      if (this._phase === "running") this.paint();
    });
  }

  /**
   * Paint at the app's `rate` until the returned function is called: what an
   * effect sampled at the frame's time asks for while it moves. The app ticks
   * while anything is animating and it holds the terminal, and stops when
   * nothing is, so a still app paints only when asked.
   */
  animate(): Unsubscribe {
    const animation = {};
    this.animations.add(animation);
    this.tick();
    return () => {
      this.animations.delete(animation);
      this.tick();
    };
  }

  /**
   * Hand the terminal to whatever launched the program, and take it back and
   * repaint when that resumes it. What sends the app here is the app's own —
   * in raw mode Ctrl+Z arrives as a key.
   */
  async suspend(): Promise<void> {
    if (this._phase !== "running") return;
    this._phase = "suspended";
    this.tick();
    this.leave();
    await this.host.suspend();
    // Stopped while suspended — by a signal, say: the terminal is already
    // handed back for good.
    if (this._phase !== "suspended") return;
    this._phase = "running";
    this.enter();
    this.paint();
    this.tick();
  }

  /**
   * Hear each frame once it is on screen — what `frame` now returns. A
   * handler that throws fails the app as a frame that throws does.
   */
  onPaint(handler: (frame: readonly (readonly Segment[])[]) => void): Unsubscribe {
    this.paintHandlers.add(handler);
    return () => this.paintHandlers.delete(handler);
  }

  /** Hand the terminal back for good; `run` resolves. */
  stop(): void {
    this.end({ kind: "stopped" });
  }

  /**
   * Hand the terminal back for good; `run` rejects with `error`. For an error
   * thrown where the app's own code runs outside a frame — a key handler, a
   * timer — which would otherwise reach neither `run`'s caller nor the
   * terminal's hand-back.
   */
  fail(error: unknown): void {
    this.end({ kind: "failed", error });
  }

  // --- the terminal ---

  private enter(): void {
    this.host.setRawMode(true);
    this.painter.take();
    this.host.write(POINTER[this.surface].on);
  }

  private leave(): void {
    this.host.write(POINTER[this.surface].off);
    this.painter.handBack();
    this.host.setRawMode(false);
  }

  private end(outcome: Outcome): void {
    const phase = this._phase;
    if (phase === "idle" || phase === "stopped") return;
    this._phase = "stopped";
    this.tick();
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    // A suspended app handed the terminal back when it suspended.
    if (phase === "running") this.leave();
    this.host.stop();
    this.settle(outcome);
  }

  // [LAW:single-enforcer] Whether the clock is ticking follows from the
  // phase and what is animating, and is brought in line with them here
  // alone, after every change to either — so a timer runs exactly while a
  // running app has something animating, and none outlives the app.
  private tick(): void {
    const wanted = this._phase === "running" && this.animations.size > 0;
    const ticking = this.stopTicking;
    if (ticking === null) {
      if (wanted) this.stopTicking = this.clock.every(this.rate, () => this.paint());
    } else if (!wanted) {
      ticking();
      this.stopTicking = null;
    }
  }

  // [LAW:no-silent-failure] A frame that throws ends the app with that
  // error: the terminal is handed back, and `run` rejects with it.
  private paint(): void {
    try {
      this.draw();
    } catch (error) {
      this.end({ kind: "failed", error });
    }
  }

  private draw(): void {
    const options = this.console.options;
    const height = this.painter.height(options.height.rows);
    // [LAW:no-ambient-temporal-coupling] The frame owner reads the clock,
    // once a frame; the view is handed the time as data.
    const lines = Segment.splitLines(this.view(this.clock.now()).render({ ...options, height }));
    // The app set the budget, so the app shapes what comes back: no deeper
    // than the terminal — a taller frame would scroll the rows the painter
    // goes back over — and, as a region, exactly that deep.
    const frame = this.painter.paint(
      fitHeight(lines.slice(0, height.rows), height),
      { rows: height.rows, cols: options.maxWidth },
      this.console.destination,
    );
    this._frame = frame;
    for (const handler of [...this.paintHandlers]) handler(frame);
  }
}

/** How an app ended: stopped, failed, or ended by the program. */
type Outcome =
  | { readonly kind: "stopped" }
  | { readonly kind: "failed"; readonly error: unknown }
  | { readonly kind: "ended" };
