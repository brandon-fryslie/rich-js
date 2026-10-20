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
 *
 * [LAW:single-enforcer] Input has one reader: the app subscribes to its
 * host's bytes once and parses them (`host/input`), so a program hears keys
 * and the pointer as events and never decodes a byte. The quit keys are
 * checked here, before any handler hears the key, so nothing a program binds
 * — a focused field in a `WidgetApp` included — can swallow them.
 */

import { frameRate, systemClock, type Clock, type FrameRate } from "../core/clock.js";
import { Console, type ConsoleOptions } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { SurfacePainter, type Surface } from "../core/paint.js";
import { fitHeight, render, type FrameHost } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import { Timeline } from "../core/timeline.js";
import { drawView, frameTime, hostView, undrawn, type FrameSays, type HostView, type View } from "../core/view.js";
import { hostEnvironment } from "./host-environment.js";
import { InputParser, keyName, parseKeyName, type KeyPress, type ScreenMouseEvent } from "./input.js";
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
const DRAW_OPTIONS = ["asciiOnly", "reducedMotion", "theme", "onStyleError", "markup", "highlight", "highlighter"] as const;
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
   * What the app draws: a renderable, a function asked for one once per
   * frame — so a view of the app's state is drawn from the state as it is at
   * that frame — or an `Animation` of one, which says when what it draws
   * changes, so the app knows when to paint again. `t` is the frame's time in
   * seconds on the app's `timeline`, which is what an effect is sampled at.
   */
  readonly view: View;
  /** What the app reads the time from and ticks on. The platform's, unless given. */
  readonly clock?: Clock;
  /**
   * The map from the clock to the time the view is drawn for (`Timeline`).
   * Playing from 0 when the host is made, at the clock's pace, unless given
   * — so a tween in the view starts when the host is made, not when the clock
   * began; `app.timeline` reads and replaces it.
   */
  readonly timeline?: Timeline;
  /**
   * How often the app paints while what it shows moves every moment — an
   * `animate()` held, or a frame that says it moves. A frame held until a
   * moment is painted at that moment, whatever the rate. 30 frames a second,
   * unless given.
   */
  readonly rate?: FrameRate;
  /**
   * The keys that stop the app, by `keyName`, heard before any `onKey`
   * handler. `["ctrl+c"]` unless given; `[]` leaves every key to the program.
   * A name no key goes by throws here.
   */
  readonly quitKeys?: readonly string[];
}

const DEFAULT_RATE = frameRate(30);
const DEFAULT_QUIT_KEYS: readonly string[] = ["ctrl+c"];

// Button presses, motion and the wheel, in the SGR encoding: coordinates as
// decimal numbers, so a terminal wider than 223 columns still reports them.
// The terminal reports a pointer by its row on the screen, and an inline
// frame does not know which row of the screen it starts on, so only the
// alternate surface gets them.
const POINTER: Record<Surface, { readonly on: string; readonly off: string }> = {
  alternate: { on: "\x1b[?1006h\x1b[?1000h\x1b[?1003h", off: "\x1b[?1003l\x1b[?1000l\x1b[?1006l" },
  inline: { on: "", off: "" },
};

/**
 * A turn of the wheel, where the pointer was when it turned: `lines` is
 * positive towards the end of the content, a line a notch.
 */
export interface Wheel {
  readonly x: number;
  readonly y: number;
  readonly lines: number;
}

// The sideways wheel is not here: nothing scrolls by columns, inside an app or
// around it.
const WHEEL_LINES = { scroll_up: -1, scroll_down: 1 } as const;
type WheelTurn = Extract<ScreenMouseEvent, { type: keyof typeof WHEEL_LINES }>;

/** A pointer event `onMouse` hears: every one but the vertical wheel, which is `onWheel`'s. */
export type AppMouseEvent = Exclude<ScreenMouseEvent, WheelTurn>;

const isWheelTurn = (event: ScreenMouseEvent): event is WheelTurn => event.type in WHEEL_LINES;

export class App implements FrameHost {
  private readonly host: TerminalHost;
  private readonly surface: Surface;
  private readonly view: HostView;
  private readonly _clock: Clock;
  private _timeline: Timeline;
  private _rate: FrameRate;
  // What is animating now: one token per `animate()` not yet released.
  private readonly animations = new Set<object>();
  // The timer painting frames, and the rate it was started at.
  private ticking: { readonly rate: FrameRate; readonly stop: Unsubscribe } | null = null;
  // What the frame on screen says about when it changes, on the clock.
  // Before a frame, nothing.
  private said: FrameSays = undrawn(0);
  // The one wait for the frame's `nextChange`, armed after each frame.
  private waking: Unsubscribe | null = null;
  // [LAW:one-source-of-truth] The host is the console's whole environment:
  // its size, its colours, where bytes go. Every frame renders with this
  // console's options and is encoded for its destination.
  private readonly console: Console;

  private _phase: AppPhase = "idle";
  private _frame: readonly (readonly Segment[])[] = [];
  private readonly painter: SurfacePainter;
  private refreshQueued = false;
  private subscriptions: Unsubscribe[] = [];
  private readonly paintHandlers = new Set<(frame: readonly (readonly Segment[])[]) => void>();
  private readonly keyHandlers = new Set<(press: KeyPress) => void>();
  private readonly mouseHandlers = new Set<(event: AppMouseEvent) => void>();
  private readonly wheelHandlers = new Set<(wheel: Wheel) => boolean>();
  private readonly quitKeys: ReadonlySet<string>;
  private readonly input: InputParser;
  private settle: (outcome: Outcome) => void = () => {};

  constructor(options: AppOptions) {
    this.host = options.host;
    this.input = new InputParser(
      { key: (press) => this.key(press), mouse: (event) => this.mouse(event) },
      options.host.inputChunks,
    );
    this.surface = options.surface;
    this.painter = new SurfacePainter(options.surface, (bytes) => this.host.write(bytes));
    this.view = hostView(options.view);
    this._clock = options.clock ?? systemClock();
    this._timeline = options.timeline ?? Timeline.play(this._clock.now());
    this._rate = options.rate ?? DEFAULT_RATE;
    this.quitKeys = new Set((options.quitKeys ?? DEFAULT_QUIT_KEYS).map(parseKeyName));
    this.console = new Console({ ...drawOptions(options), environment: hostEnvironment(options.host) });
  }

  get phase(): AppPhase {
    return this._phase;
  }

  /** The clock the app reads the time from: where the host time a `Timeline` operation takes is read. */
  get clock(): Clock {
    return this._clock;
  }

  /** The map from the clock to the time the view is drawn for. */
  get timeline(): Timeline {
    return this._timeline;
  }

  /**
   * Replace the timeline and paint the frame for the time it now maps the
   * clock's now to, so a seek shows where it sought, once. Paused, the frame
   * then holds: nothing drawn for a held time changes, so the app waits on
   * nothing until the timeline plays again, and paints when asked.
   */
  set timeline(timeline: Timeline) {
    this._timeline = timeline;
    this.refresh();
  }

  /** How often the app paints while what it shows moves every moment. */
  get rate(): FrameRate {
    return this._rate;
  }

  /**
   * Set how often the app paints: an animation under way goes on at the new
   * rate from its next frame, without a frame lost or one painted twice.
   */
  set rate(rate: FrameRate) {
    this._rate = rate;
    this.tick();
  }

  /** The rows on screen now, as painted: what a pointer event lands on. */
  get frame(): readonly (readonly Segment[])[] {
    return this._frame;
  }

  /**
   * The time a frame drawn now is drawn for (`RenderOptions.frame`): the
   * clock's now, through the timeline for a view on it. What a moment heard
   * between frames — a key — is stamped with, so it is on the clock the
   * frame is.
   */
  get frameTime(): number {
    return frameTime(this.view, this._timeline, this._clock.now());
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
        this.host.onData((chunk) => this.input.feed(chunk)),
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
      // A frame painted since it was asked for — a tick — drew every change
      // made before it, so there is nothing left to paint.
      if (!this.refreshQueued) return;
      this.refreshQueued = false;
      // [LAW:types-are-the-program] Only a running app holds the terminal; a
      // suspended one repaints when it resumes, and a stopped one never does.
      if (this._phase === "running") this.paint();
    });
  }

  /**
   * Paint at the app's `rate` until the returned function is called: what a
   * view that moves without saying so asks for — one computing from `t` what
   * no animation stamps. A view that does say so needs none of this: the app
   * ticks at its rate while the frame says it moves (`nextChange` at the
   * frame's own time), wakes once when the frame says it holds until a
   * moment, and paints only when asked once it says it never changes. The
   * app ticks while anything is animating and it holds the terminal, and
   * stops when nothing is. The animation's first frame does not wait out an
   * interval: at one frame every two seconds, that would hold its start off
   * screen for two.
   */
  animate(): Unsubscribe {
    const animation = {};
    this.animations.add(animation);
    this.tick();
    this.refresh();
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

  /**
   * Hear every key the app does not quit on, by the `KeyPress` the terminal
   * reported; `keyName` names it. A handler that throws fails the app.
   */
  onKey(handler: (press: KeyPress) => void): Unsubscribe {
    this.keyHandlers.add(handler);
    return () => this.keyHandlers.delete(handler);
  }

  /**
   * Hear every pointer event but the vertical wheel, which is `onWheel`'s,
   * in terminal cells. Only the alternate surface reports the pointer. A
   * handler that throws fails the app.
   */
  onMouse(handler: (event: AppMouseEvent) => void): Unsubscribe {
    this.mouseHandlers.add(handler);
    return () => this.mouseHandlers.delete(handler);
  }

  /**
   * Offer every wheel turn to `handler`, which returns whether it moved
   * something. A turn no handler moves anything with is passed outward to the
   * host (`TerminalHost.passWheel`), so the page or terminal around the app
   * scrolls instead. Handlers are offered a turn in the order they subscribed,
   * and the first that moves something takes it. A handler that throws fails
   * the app.
   */
  onWheel(handler: (wheel: Wheel) => boolean): Unsubscribe {
    this.wheelHandlers.add(handler);
    return () => this.wheelHandlers.delete(handler);
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
    // [LAW:no-silent-failure] An error after the app ended has no `run` left
    // to reject, so it is thrown to whoever raised it instead of dropped.
    if (phase === "idle" || phase === "stopped") {
      if (outcome.kind === "failed") throw outcome.error;
      return;
    }
    this._phase = "stopped";
    this.tick();
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    this.input.reset();
    // A suspended app handed the terminal back when it suspended.
    if (phase === "running") this.leave();
    this.host.stop();
    this.settle(outcome);
  }

  // --- input ---

  private key(press: KeyPress): void {
    if (this.quitKeys.has(keyName(press))) return this.stop();
    this.hear(this.keyHandlers, press);
  }

  // [LAW:dataflow-not-control-flow] One rule for every app: a wheel turn
  // nothing in the app moved with goes outward. The vertical wheel reaches the
  // program through `onWheel` alone, so moving something with it and claiming
  // the turn are one act, and an app that reads no wheel passes every turn.
  // [LAW:single-enforcer] Only a running app holds the terminal, so only a
  // running app is offered a turn or passes one on.
  private mouse(event: ScreenMouseEvent): void {
    if (!isWheelTurn(event)) return this.hear(this.mouseHandlers, event);
    if (this._phase !== "running") return;
    const lines = WHEEL_LINES[event.type];
    const wheel: Wheel = { x: event.x, y: event.y, lines };
    try {
      const moved = [...this.wheelHandlers].some((handler) => this._phase === "running" && handler(wheel));
      if (!moved && this._phase === "running") this.host.passWheel(lines);
    } catch (error) {
      this.fail(error);
    }
  }

  // [LAW:no-silent-failure] The host calls these handlers, not the program,
  // so one that throws ends the app with its error, as a frame that throws
  // does. A handler that stops the app is the last to hear the event.
  private hear<E>(handlers: ReadonlySet<(event: E) => void>, event: E): void {
    try {
      for (const handler of [...handlers]) if (this._phase !== "stopped") handler(event);
    } catch (error) {
      this.fail(error);
    }
  }

  // [LAW:single-enforcer] Whether the clock is ticking, and at what rate,
  // and whether a wake is armed for the frame's next change, follow from the
  // phase, what is animating, the rate and what the frame on screen says,
  // and are brought in line with them here alone, after every change to any
  // — so a timer runs exactly while a running app has something moving — a
  // frame that says it moves, or an `animate()` its frame was not drawn for
  // a paused timeline's held time under — at the rate the app has now, a wake is armed exactly while a running app
  // shows a frame held until a moment, and none outlives the app.
  private tick(): void {
    const running = this._phase === "running";
    const { t, nextChange, held } = this.said;
    const wanted = running && ((this.animations.size > 0 && !held) || nextChange === t);
    if (this.ticking !== null && (!wanted || this.ticking.rate.perSecond !== this._rate.perSecond)) {
      this.ticking.stop();
      this.ticking = null;
    }
    if (wanted && this.ticking === null) {
      this.ticking = { rate: this._rate, stop: this._clock.every(this._rate, () => this.paint()) };
    }
    this.waking?.();
    this.waking = running && t < nextChange && nextChange < Number.POSITIVE_INFINITY ? this._clock.at(nextChange, () => this.paint()) : null;
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
    // This frame draws every change made before it, a queued refresh's included.
    this.refreshQueued = false;
    const options = this.console.options;
    const height = this.painter.height(options.height.rows);
    // [LAW:no-ambient-temporal-coupling] The frame owner reads the clock,
    // once a frame; the view is handed the time the timeline maps it to, as
    // data, and what the frame says about when it changes comes back on the
    // clock. The app set the budget, so the app shapes what comes back: no
    // deeper than the terminal — a taller frame would scroll the rows the
    // painter goes back over — and, as a region, exactly that deep.
    const drawn = drawView(this.view, this._timeline, this._clock.now(), this, { ...options, height }, (renderable, under) =>
      fitHeight(Segment.splitLines(render(renderable, under)).slice(0, height.rows), height),
    );
    const frame = this.painter.paint(() => drawn.lines, { rows: height.rows, cols: options.maxWidth }, this.console.destination);
    this._frame = frame;
    this.said = drawn;
    this.tick();
    for (const handler of [...this.paintHandlers]) handler(frame);
  }
}

/** How an app ended: stopped, failed, or ended by the program. */
type Outcome =
  | { readonly kind: "stopped" }
  | { readonly kind: "failed"; readonly error: unknown }
  | { readonly kind: "ended" };
