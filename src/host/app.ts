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

import { Console } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { segmentsToString } from "../core/render.js";
import { fitHeight, type Height, type Renderable } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import { hostEnvironment } from "./host-environment.js";
import type { TerminalHost } from "./terminal-host.js";

/**
 * Where the frame is painted. `alternate` is the whole terminal, in the
 * alternate screen buffer, so the rows the program printed before it are
 * there again when it stops; the terminal reports the pointer on it. `inline`
 * starts at the cursor's line, as tall as the frame, and stays on the
 * terminal when the app stops. It gets no pointer events: the terminal
 * reports a pointer by its row on the screen, and the app does not know
 * which row of the screen its frame starts on.
 */
export type Surface = "alternate" | "inline";

/**
 * Where an app is in its life. `idle` has not run; `running` holds the
 * terminal and paints; `suspended` has handed it back until the host resumes
 * the program; `stopped` has handed it back for good.
 */
export type AppPhase = "idle" | "running" | "suspended" | "stopped";

export interface AppOptions {
  /** The terminal the app runs on. The app starts and stops it. */
  readonly host: TerminalHost;
  readonly surface: Surface;
  /**
   * The app's root renderable, asked for once per frame, so a view of the
   * app's state is drawn from the state as it is at that frame.
   */
  readonly view: () => Renderable;
}

/**
 * What a surface is, as the bytes that take it, find its first cell and hand
 * it back, and the kind of height it gives the frame.
 *
 * [LAW:dataflow-not-control-flow] The two surfaces differ only in these
 * values; `App` runs the same steps on both.
 */
interface SurfaceBytes {
  /** A region the frame fills, or a ceiling it keeps its own height under. */
  readonly exact: boolean;
  readonly enter: string;
  /** Bytes handing the surface back, the last frame `rows` tall. */
  leave(rows: number): string;
  /** Bytes to the frame's first cell, the last frame `rows` tall. */
  home(rows: number): string;
  /** The rows this frame paints, so a shorter one overwrites the last. */
  painted(frameRows: number, lastRows: number): number;
}

// Button presses, motion and the wheel, in the SGR encoding: coordinates as
// decimal numbers, so a terminal wider than 223 columns still reports them.
const POINTER_ON = "\x1b[?1006h\x1b[?1000h\x1b[?1003h";
const POINTER_OFF = "\x1b[?1003l\x1b[?1000l\x1b[?1006l";

const SURFACES: Record<Surface, SurfaceBytes> = {
  alternate: {
    exact: true,
    enter: "\x1b[?1049h" + POINTER_ON,
    leave: () => POINTER_OFF + "\x1b[?1049l",
    home: () => "\x1b[H",
    // The frame is every row of the screen, so there is nothing left under it
    // — and after the terminal shrinks, painting the old count would scroll.
    painted: (frameRows) => frameRows,
  },
  inline: {
    exact: false,
    enter: "",
    // Below the frame, where the program's next line belongs.
    leave: (rows) => (rows > 0 ? "\n" : ""),
    // After N rows written with N-1 newlines between them, the cursor is on
    // the last. `ESC[0A` still moves a row on some terminals, so a one-row
    // frame is returned to with the carriage return alone.
    home: (rows) => (rows > 1 ? `\x1b[${rows - 1}A\r` : "\r"),
    // A shorter frame blanks the rows the last one left below it.
    painted: (frameRows, lastRows) => Math.max(frameRows, lastRows),
  },
};

const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const RESET_STYLE = "\x1b[0m";
const ERASE_LINE = "\x1b[2K";

export class App {
  private readonly host: TerminalHost;
  private readonly surface: SurfaceBytes;
  private readonly view: () => Renderable;
  // [LAW:one-source-of-truth] The host is the console's whole environment:
  // its size, its colours, where bytes go. Every frame renders with this
  // console's options and is encoded for its destination.
  private readonly console: Console;

  private _phase: AppPhase = "idle";
  private _frame: readonly (readonly Segment[])[] = [];
  // The last frame's own rows on the terminal — what `home` rewinds.
  private rows = 0;
  private refreshQueued = false;
  private subscriptions: Unsubscribe[] = [];
  private readonly paintHandlers = new Set<(frame: readonly (readonly Segment[])[]) => void>();
  private settle: (outcome: Outcome) => void = () => {};

  constructor(options: AppOptions) {
    this.host = options.host;
    this.surface = SURFACES[options.surface];
    this.view = options.view;
    this.console = new Console({ environment: hostEnvironment(options.host) });
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
   * — or reject with the error a frame threw, the terminal handed back first.
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
   * Hand the terminal to whatever launched the program, and take it back and
   * repaint when that resumes it. What sends the app here is the app's own —
   * in raw mode Ctrl+Z arrives as a key.
   */
  async suspend(): Promise<void> {
    if (this._phase !== "running") return;
    this._phase = "suspended";
    this.leave();
    await this.host.suspend();
    // Stopped while suspended — by a signal, say: the terminal is already
    // handed back for good.
    if (this._phase !== "suspended") return;
    this._phase = "running";
    // What the last frame occupied is gone under whatever ran meanwhile, so
    // the next one starts where the cursor is.
    this.rows = 0;
    this.enter();
    this.paint();
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

  // --- the terminal ---

  private enter(): void {
    this.host.setRawMode(true);
    this.host.write(this.surface.enter + HIDE_CURSOR);
  }

  private leave(): void {
    this.host.write(RESET_STYLE + SHOW_CURSOR + this.surface.leave(this.rows));
    this.host.setRawMode(false);
  }

  private end(outcome: Outcome): void {
    const phase = this._phase;
    if (phase === "idle" || phase === "stopped") return;
    this._phase = "stopped";
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    // A suspended app handed the terminal back when it suspended.
    if (phase === "running") this.leave();
    this.host.stop();
    this.settle(outcome);
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
    const { maxWidth: cols } = options;
    const height: Height = { rows: options.height.rows, exact: this.surface.exact };
    const lines = Segment.splitLines(this.view().render({ ...options, height }));
    // The app set the budget, so the app shapes what comes back: no deeper
    // than the terminal — a taller frame would scroll the rows `home` counts
    // back over — and, as a region, exactly that deep. No row wider than the
    // terminal either: one that soft-wrapped would push every row below it
    // down a row the frame does not know about.
    const frame = fitHeight(lines.slice(0, height.rows), height).map((line) =>
      Segment.adjustLineLength(line, cols, undefined, false),
    );
    const painted = Math.min(this.surface.painted(frame.length, this.rows), height.rows);

    // Each row is erased as it is reached rather than the frame cleared
    // first, so no blank screen shows between two frames. The erase leads
    // its row: after a row that fills the width, the cursor sits on its last
    // cell, and an erase there would take it.
    const destination = this.console.destination;
    const body = Array.from({ length: painted }, (_, row) =>
      ERASE_LINE + segmentsToString(frame[row] ?? [], destination),
    ).join("\n");
    // Rows blanked below the frame are not the frame's: the cursor goes back
    // up to its last row, so the next frame and the program's next line start
    // from the frame's own height.
    const blanked = painted - Math.max(frame.length, 1);
    const back = blanked > 0 ? `\x1b[${blanked}A` : "";
    this.host.write(this.surface.home(this.rows) + body + back);
    this._frame = frame;
    this.rows = frame.length;
    for (const handler of [...this.paintHandlers]) handler(frame);
  }
}

/** How an app ended: stopped, failed by a frame, or ended by the program. */
type Outcome =
  | { readonly kind: "stopped" }
  | { readonly kind: "failed"; readonly error: unknown }
  | { readonly kind: "ended" };
