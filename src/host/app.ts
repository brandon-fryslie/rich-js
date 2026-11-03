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
import { ColorDepth, resolveTerminal, type TerminalColors } from "../core/color.js";
import { Console, type ConsoleOptions } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { SurfaceRenderer, type Surface } from "../core/paint.js";
import { fitHeight, render, type HostFrame, type FrameHost, type Renderable } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import { Timeline } from "../core/timeline.js";
import { drawView, frameNow, hostView, undrawn, type FrameSays, type HostTime, type View } from "../core/view.js";
import { hostEnvironment } from "./host-environment.js";
import { InputParser, keyName, parseKeyName, type KeyEvent, type TerminalMouseEvent, type TerminalReply } from "./input.js";
import type { TerminalHost } from "./terminal-host.js";

/**
 * Where an app is in its life. `idle` has not run; `running` holds the
 * terminal and paints; `suspended` has handed it back until the host resumes
 * the program; `stopped` has handed it back for good.
 */
export type AppPhase = "idle" | "running" | "suspended" | "stopped";

// [LAW:one-source-of-truth] How a frame draws — its glyphs, the terminal its
// colors resolve on, the style names it knows, what happens to a style it
// cannot resolve, markup and highlighting — is the console's to say, so App takes those options as the
// console declares them. This list is both the type and what is copied: the
// host alone decides the console's size, colors and sink, so no other
// property of the options object reaches it, whatever the object carries.
const DRAW_OPTIONS = ["asciiOnly", "reducedMotion", "textOrder", "terminal", "theme", "onStyleError", "markup", "highlight", "highlighter"] as const;
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
   * What the app draws: a renderable, or a function asked for one once per
   * frame — so a view of the app's state is drawn from the state as it is at
   * that frame. What moves in it is an `Animation` placed there, drawn at the
   * frame's time on the app's `timeline`, which says when it changes, so the
   * app knows when to paint again.
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
   * How often the app paints while what it shows moves every moment — a
   * frame that says it moves. A frame held until a
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
export interface WheelEvent {
  readonly x: number;
  readonly y: number;
  readonly lines: number;
}

// The sideways wheel is not here: nothing scrolls by columns, inside an app or
// around it.
const WHEEL_LINES = { scroll_up: -1, scroll_down: 1 } as const;
type WheelTurn = Extract<TerminalMouseEvent, { type: keyof typeof WHEEL_LINES }>;

/** A pointer event `onMouse` hears: every one but the vertical wheel, which is `onWheel`'s. */
export type AppMouseEvent = Exclude<TerminalMouseEvent, WheelTurn>;

// Primary Device Attributes. Every VT100 descendant answers it, and a terminal
// answers in the order it was asked, so its reply, sent after an ask's queries,
// says every reply to them that is coming has come.
const DA1 = "\x1b[c";
const isDa1Reply = (reply: TerminalReply): boolean => reply.kind === "csi" && reply.body.startsWith("?") && reply.body.endsWith("c");

/**
 * How an ask ended, with the replies heard before it did. `answered`: the
 * terminal answered DA1, so a query with no reply among `replies` is one it
 * does not support. `timeout`: it answered nothing in time, DA1 included.
 * `left`: the app handed the terminal back first. `unasked`: the host writes
 * to no terminal, so nothing was asked.
 */
export interface Asked {
  readonly ended: "answered" | "timeout" | "left" | "unasked";
  readonly replies: readonly TerminalReply[];
}

export interface AskOptions {
  /** Seconds to wait for a terminal that answers nothing. Half a second, unless given. */
  readonly timeout?: number;
}

const DEFAULT_ASK_TIMEOUT = 0.5;

// The ask in flight: the replies heard so far, and how it ends.
interface Asking {
  readonly replies: TerminalReply[];
  finish(ended: Asked["ended"]): void;
}

const isWheelTurn = (event: TerminalMouseEvent): event is WheelTurn => event.type in WHEEL_LINES;

export class App implements FrameHost {
  private readonly host: TerminalHost;
  private readonly surface: Surface;
  private readonly view: Renderable;
  private readonly _clock: Clock;
  // The clock moment this app began: what its default timeline plays from,
  // and what a renderable view is drawn for the time since (`HostTime`).
  private readonly _epoch: number;
  private _timeline: Timeline;
  private _rate: FrameRate;
  // The timer painting frames, and the rate it was started at.
  private ticking: { readonly rate: FrameRate; readonly stop: Unsubscribe } | null = null;
  // What the frame on screen says about when it changes, on the clock.
  // Before a frame, nothing.
  private said: FrameSays = undrawn(0);
  // The one wait for the frame's `validUntil`, armed after each frame.
  private waking: Unsubscribe | null = null;
  // [LAW:one-source-of-truth] The host is the console's whole environment:
  // its size, its colors, where bytes go. Every frame renders with this
  // console's options and is encoded for its destination.
  private console: Console;
  private drawing: Pick<ConsoleOptions, DrawOption>;
  // [LAW:single-enforcer] One ask at a time, through the one input reader:
  // the next waits on the last, and `leave` ends the one in flight.
  private asking: Asking | null = null;
  private asked: Promise<unknown> = Promise.resolve();
  // DA1 replies still owed to asks that timed out. A terminal answers in the
  // order it was asked, so every reply before the last of them belongs to an
  // ask that has ended, and none reaches the ask after it.
  private owedDa1 = 0;

  private _phase: AppPhase = "idle";
  private _frame: readonly (readonly Segment[])[] = [];
  private readonly painter: SurfaceRenderer;
  private refreshQueued = false;
  private subscriptions: Unsubscribe[] = [];
  private readonly paintHandlers = new Set<(frame: readonly (readonly Segment[])[]) => void>();
  private readonly keyHandlers = new Set<(press: KeyEvent) => void>();
  private readonly mouseHandlers = new Set<(event: AppMouseEvent) => void>();
  private readonly wheelHandlers = new Set<(wheel: WheelEvent) => boolean>();
  private readonly quitKeys: ReadonlySet<string>;
  private readonly input: InputParser;
  private settle: (outcome: Outcome) => void = () => {};

  constructor(options: AppOptions) {
    this.host = options.host;
    this.input = new InputParser(
      { key: (press) => this.key(press), mouse: (event) => this.mouse(event), reply: (reply) => this.reply(reply) },
      options.host.inputChunks,
    );
    this.surface = options.surface;
    this.painter = new SurfaceRenderer(options.surface, (bytes) => this.host.write(bytes));
    this.view = hostView(options.view);
    this._clock = options.clock ?? systemClock();
    this._epoch = this._clock.now();
    this._timeline = options.timeline ?? Timeline.play(this._epoch);
    this._rate = options.rate ?? DEFAULT_RATE;
    this.quitKeys = new Set((options.quitKeys ?? DEFAULT_QUIT_KEYS).map(parseKeyName));
    this.drawing = drawOptions(options);
    this.console = this.drawingConsole();
  }

  /**
   * The terminal the app draws on: the colors a cell that sets none is drawn
   * in, and the sixteen an ANSI color names — as given, or as the color
   * depth assumes (`resolveTerminal`).
   */
  get terminal(): TerminalColors {
    return resolveTerminal(this.console.options.terminal, this.console.colorSystem ?? ColorDepth.TRUECOLOR);
  }

  /** Draw on `terminal` from the next frame on — what `terminalColors` learned, say. */
  set terminal(terminal: TerminalColors) {
    // [LAW:one-source-of-truth] The console is the one holder of how a frame
    // draws, so the terminal changes by a new console, not beside the old one.
    this.drawing = { ...this.drawing, terminal };
    this.console = this.drawingConsole();
    this.refresh();
  }

  /**
   * Ask the terminal: write `queries`, then DA1, and resolve with the replies
   * heard before DA1's, or before the timeout or the app handing the terminal
   * back. It rejects only when writing to the terminal throws. Asks run one
   * after another, and only while the app runs: it holds raw mode and reads
   * the input, so a reply reaches the ask and never a key handler. A reply no
   * ask is waiting for is dropped. `queries` must not ask for DA1 itself: its
   * reply would end the ask early.
   */
  ask(queries: readonly string[], options: AskOptions = {}): Promise<Asked> {
    // An ask before the app runs is a mistake in the program; one after it
    // stopped ends `left`, so the error that stopped it is the one heard.
    if (this._phase === "idle") throw new Error("App.ask: an app asks its terminal once it runs, and this one has not started");
    const timeout = options.timeout ?? DEFAULT_ASK_TIMEOUT;
    if (!(timeout > 0 && Number.isFinite(timeout))) throw new RangeError(`App.ask: a timeout is a positive, finite number of seconds, not ${timeout}`);
    const turn = this.asked.then(() => this.askNow(queries, timeout));
    // One ask's failure is its caller's; the asks queued after it still run.
    this.asked = turn.catch(() => undefined);
    return turn;
  }

  // The one way the app builds the console it draws with.
  private drawingConsole(): Console {
    return new Console({ ...this.drawing, environment: hostEnvironment(this.host) });
  }

  private askNow(queries: readonly string[], timeout: number): Promise<Asked> {
    return new Promise((resolve) => {
      if (this._phase !== "running") return resolve({ ended: "left", replies: [] });
      if (!this.host.writesToTerminal) return resolve({ ended: "unasked", replies: [] });
      // Written before the ask takes the input, so a write that throws leaves
      // no ask in flight and no timer armed.
      this.host.write(queries.join("") + DA1);
      const replies: TerminalReply[] = [];
      const timer = this._clock.at(this._clock.now() + timeout, () => {
        this.owedDa1++;
        asking.finish("timeout");
      });
      const asking: Asking = {
        replies,
        finish: (ended) => {
          timer();
          this.asking = null;
          // [LAW:single-enforcer] Every way an ask ends goes through here, so
          // what the parser held for its replies is settled on every one.
          this.input.awaitReplies(false);
          resolve({ ended, replies });
        },
      };
      this.asking = asking;
      this.input.awaitReplies(true);
    });
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
   * The frame this app draws now (`FrameHost`): the clock's now, through the
   * timeline, on a frame it is the host of. Its time is what a moment heard
   * between frames — a key — is stamped with, so it is on the clock the
   * frame is.
   */
  frameNow(): HostFrame {
    return frameNow(this, this._time());
  }

  private _time(): HostTime {
    return { now: this._clock.now(), epoch: this._epoch, timeline: this._timeline };
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
   * Hand the terminal to whatever launched the program, and take it back and
   * repaint when that resumes it. What sends the app here is the app's own —
   * in raw mode Ctrl+Z arrives as a key.
   */
  async suspend(): Promise<void> {
    if (this._phase !== "running") return;
    this._phase = "suspended";
    this.tick();
    // What is half-read belongs to no one once the terminal is handed back.
    this.input.reset();
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
   * Hear every key the app does not quit on, by the `KeyEvent` the terminal
   * reported; `keyName` names it. A handler that throws fails the app.
   */
  onKey(handler: (press: KeyEvent) => void): Unsubscribe {
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
  onWheel(handler: (wheel: WheelEvent) => boolean): Unsubscribe {
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
    this.asking?.finish("left");
    // Whatever answers the terminal sends from here reach whoever holds it next.
    this.owedDa1 = 0;
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

  private reply(reply: TerminalReply): void {
    if (this.owedDa1 > 0) {
      if (isDa1Reply(reply)) this.owedDa1--;
      return;
    }
    if (this.asking === null) return;
    if (isDa1Reply(reply)) return this.asking.finish("answered");
    this.asking.replies.push(reply);
  }

  private key(press: KeyEvent): void {
    if (this.quitKeys.has(keyName(press))) return this.stop();
    this.hear(this.keyHandlers, press);
  }

  // [LAW:dataflow-not-control-flow] One rule for every app: a wheel turn
  // nothing in the app moved with goes outward. The vertical wheel reaches the
  // program through `onWheel` alone, so moving something with it and claiming
  // the turn are one act, and an app that reads no wheel passes every turn.
  // [LAW:single-enforcer] Only a running app holds the terminal, so only a
  // running app is offered a turn or passes one on.
  private mouse(event: TerminalMouseEvent): void {
    if (!isWheelTurn(event)) return this.hear(this.mouseHandlers, event);
    if (this._phase !== "running") return;
    const lines = WHEEL_LINES[event.type];
    const wheel: WheelEvent = { x: event.x, y: event.y, lines };
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
  // phase, the rate and what the frame on screen says, and are brought in
  // line with them here alone, after every change to any — so a timer runs
  // exactly while a running app shows a frame that says it moves, at the
  // rate the app has now, a wake is armed exactly while a running app shows
  // a frame held until a moment, and none outlives the app.
  // [LAW:one-source-of-truth] What the frame draws is the only thing that
  // says whether the view moves.
  private tick(): void {
    const running = this._phase === "running";
    const { t, validUntil } = this.said;
    const wanted = running && validUntil === t;
    if (this.ticking !== null && (!wanted || this.ticking.rate.perSecond !== this._rate.perSecond)) {
      this.ticking.stop();
      this.ticking = null;
    }
    if (wanted && this.ticking === null) {
      this.ticking = { rate: this._rate, stop: this._clock.every(this._rate, () => this.paint()) };
    }
    this.waking?.();
    this.waking = running && t < validUntil && validUntil < Number.POSITIVE_INFINITY ? this._clock.at(validUntil, () => this.paint()) : null;
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
    const drawn = drawView(this.view, this._time(), this, { ...options, height }, (renderable, under) =>
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
