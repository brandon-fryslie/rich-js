/// <reference lib="dom" />
/**
 * A live terminal: an xterm.js terminal in a page element, running one bundled
 * program under the simulated process, with what is typed at it reaching the
 * program as `process.stdin`.
 *
 * Nothing here knows about docs pages. The docs' live examples, the playground
 * and the landing hero each decide when to run a program, how big the terminal
 * is and which theme it wears, and hand those in; this owns the terminal and
 * the one program running in it.
 *
 * [LAW:effects-at-boundaries] The program runs in a Web Worker, one per run,
 * made inside a hidden frame sandboxed to an opaque origin. The worker is what
 * makes a program stoppable: removing the frame ends it, so a stopped
 * `Progress` leaves no timer behind and a loop that never yields takes nothing
 * from the page. The alternative, running in the page, can start a program but
 * never stop one: nothing outside a program can cancel the timers it set. The
 * frame is what keeps the program off the site: a worker the page made itself
 * would share the site's origin, its storage and its credentials, which a
 * program a visitor pasted into the playground must not reach. A program in
 * the frame has no origin of its own to share, and nothing to reach but the
 * one message port the page gave it.
 *
 * [LAW:single-enforcer] Bytes and keys cross between the worker and xterm
 * through `BrowserTerminalHost`, the library's own host for an xterm terminal,
 * so a program's newlines reach the screen the way a tty delivers them.
 */
import { BrowserTerminalHost, type XtermDisposable, type XtermTerminal } from "../../../src/host/index.js";
import type { TerminalTheme } from "../../../src/index.js";
import { XTERM } from "../../../examples/_browser-shell/xterm.js";

/** The terminal a program sees: everything about it but where its bytes go. */
export interface TerminalSpec {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string>>;
}

/** What the page sends the worker running a program. */
export type ToWorker =
  | { readonly kind: "run"; readonly script: string; readonly terminal: TerminalSpec }
  | { readonly kind: "input"; readonly chunk: string | Uint8Array }
  /** Answered with a `mark` at once; see that message. */
  | { readonly kind: "mark" };

/** What the worker running a program sends the page. */
export type FromWorker =
  | { readonly kind: "output"; readonly chunk: string | Uint8Array }
  | { readonly kind: "exit"; readonly code: number }
  /**
   * The program's body has returned and every job it queued has run. A
   * program with timers or listeners still set runs on after this.
   */
  | { readonly kind: "settled" }
  /**
   * The program failed: its body threw, or something it set running did. The
   * report is what a terminal shows for it, as Node reports an uncaught error.
   */
  | { readonly kind: "crashed"; readonly report: string }
  /**
   * The answer to a `mark`, sent between two of the program's tasks. Every
   * output message before it was written before it, and a frame the program
   * draws in one task (an inline Live erases its last frame and writes the
   * next in one refresh) is wholly before it or wholly after.
   */
  | { readonly kind: "mark" };

/**
 * How a run shows its program: `live`, as it runs; or `still`, one frame drawn
 * at once and then left alone, for a reader who asked for no motion. The frame
 * is the screen as it stands once the program's body has settled, or
 * `STILL_AFTER_MS` after the program first drew, whichever comes first, and
 * the program is ended there.
 */
export type RunMode = "live" | "still";

/**
 * How long a still frame waits after the program first draws. Waiting for the
 * body alone leaves three kinds of example blank: one that loops until
 * stopped, a prompt waiting on an answer nothing on screen asks for, and one
 * whose body ends by leaving Live's alt screen or clearing a transient region,
 * so the screen it settles on no longer shows what the example is about.
 */
const STILL_AFTER_MS = 1000;

/** What the terminal is showing. */
export type LiveState =
  | { readonly kind: "idle" }
  | { readonly kind: "running" }
  | { readonly kind: "still" }
  | { readonly kind: "stopped" }
  | { readonly kind: "exited"; readonly code: number };

export interface LiveTerminalOptions {
  /** The worker's script, the default export of `LIVE_RUNTIME_MODULE` (example-runner.ts). */
  readonly runtime: string;
  readonly terminal: TerminalSpec;
  readonly theme: TerminalTheme;
  readonly font: { readonly family: string; readonly size: number };
}

/**
 * The font static output is drawn in, as `LiveTerminalOptions` takes it:
 * custom.css gives a live terminal's element `--rich-fragment-font`, and xterm
 * takes it as numbers.
 *
 * [LAW:one-source-of-truth] The line height is not among them. xterm makes a
 * row its measured character height times its `lineHeight` option, rounded to
 * device pixels, so no factor handed in from here lands on the element's line
 * height. `loadXterm` instead has xterm measure its character at the line
 * custom.css derives that line height from, and the option stays 1: a row is
 * then the element's line height.
 */
export function elementFont(element: HTMLElement): LiveTerminalOptions["font"] {
  const style = getComputedStyle(element);
  return { family: style.fontFamily, size: parseFloat(style.fontSize) };
}

/** xterm's colour options, from the theme a program's output is drawn in everywhere else. */
function xtermTheme(theme: TerminalTheme): Record<string, string> {
  const names = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
  const ansi = Object.fromEntries(
    [...names, ...names.map((n) => `bright${n[0]!.toUpperCase()}${n.slice(1)}`)].map((name, i) => [name, theme.ansiColors.get(i).hex]),
  );
  const background = theme.backgroundColor.hex;
  const foreground = theme.foregroundColor.hex;
  return { ...ansi, background, foreground, cursor: foreground, cursorAccent: background };
}

/** The part of xterm.js's `Terminal` this uses, beyond what the host does. */
interface Xterm extends XtermTerminal {
  readonly element: HTMLElement | undefined;
  readonly buffer: {
    readonly active: {
      readonly cursorY: number;
      getLine(y: number): { translateToString(trimRight: boolean): string } | undefined;
    };
  };
  open(element: HTMLElement): void;
  reset(): void;
  dispose(): void;
  onWriteParsed(handler: () => void): XtermDisposable;
  options: { theme: Record<string, string>; fontFamily: string; fontSize: number };
}

type XtermConstructor = new (options: Record<string, unknown>) => Xterm;

let xterm: Promise<XtermConstructor> | undefined;

/** xterm.js, from the site's one pin, added to the page the first time a terminal is made. */
function loadXterm(): Promise<XtermConstructor> {
  xterm ??= new Promise<XtermConstructor>((resolve, reject) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", crossOrigin: "anonymous", ...XTERM.stylesheet });
    // xterm makes a row the height it measures a character at, in whole CSS
    // pixels rounded up to whole device pixels, and measures it at
    // line-height: normal. Measured at the element's --rich-fragment-line, a
    // whole CSS pixel, a row is the line height custom.css derives from it the
    // same way (`elementFont`).
    const measure = Object.assign(document.createElement("style"), {
      textContent: ".xterm .xterm-char-measure-element { line-height: var(--rich-fragment-line, normal); }",
    });
    const script = Object.assign(document.createElement("script"), { crossOrigin: "anonymous", ...XTERM.script });
    script.onload = () => resolve((globalThis as unknown as { Terminal: XtermConstructor }).Terminal);
    script.onerror = () => {
      // Forgotten, so the next terminal made tries again rather than reusing a failure.
      xterm = undefined;
      link.remove();
      measure.remove();
      script.remove();
      reject(new Error(`xterm.js did not load from ${XTERM.script.src}`));
    };
    document.head.append(link, measure, script);
  });
  return xterm;
}

/** One run's frame and its worker, as the page sees them. */
interface Sandbox {
  post(message: ToWorker): void;
  /** Remove the frame, which ends its worker and whatever the worker was running. */
  end(): void;
}

/**
 * A hidden frame in `parent`, sandboxed to an opaque origin, running `runtime`
 * as a worker whose every message reaches `receive`. The page and the worker
 * talk over one message port, and messages posted before the frame has loaded
 * wait in that port.
 */
function sandbox(parent: HTMLElement, runtime: string, receive: (message: FromWorker) => void): Sandbox {
  const frame = Object.assign(document.createElement("iframe"), { srcdoc: `<script>(${relay})()</script>` });
  // Hidden by its own style, which no stylesheet overrides: VitePress styles
  // every iframe `display: block`, which undoes the `hidden` attribute and
  // leaves an invisible frame over the terminal taking its clicks.
  frame.style.display = "none";
  // Scripts, and nothing else: no same origin, no forms, no popups, no navigating the page.
  frame.sandbox.add("allow-scripts");
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = ({ data }: MessageEvent<FromWorker>) => receive(data);
  // An opaque origin cannot be named, so the target is "*"; the runtime is no secret.
  frame.addEventListener("load", () => frame.contentWindow!.postMessage(runtime, "*", [port2]), { once: true });
  parent.append(frame);
  return {
    post: (message) => port1.postMessage(message),
    end: () => {
      port1.close();
      frame.remove();
    },
  };
}

/**
 * The frame's one script, written into it as source: it may use nothing but
 * its own names and the frame's globals. It starts the worker from the text
 * of its first message and joins the worker to the port that came with it.
 */
function relay(): void {
  addEventListener(
    "message",
    ({ data, ports }: MessageEvent<string>) => {
      const port = ports[0]!;
      const crashed = (report: string) => port.postMessage({ kind: "crashed", report } satisfies FromWorker);
      // [LAW:no-silent-failure] An engine that refuses this frame a worker
      // throws here, where only the port can carry it to the page.
      try {
        const worker = new Worker(URL.createObjectURL(new Blob([data], { type: "text/javascript" })));
        port.onmessage = (event) => worker.postMessage(event.data);
        worker.onmessage = (event) => port.postMessage(event.data);
        // live-worker.ts reports every failure of a program itself. What reaches
        // here is the worker failing before it could: a script that threw reads
        // "Uncaught …", and one that never loaded fires a bare `Event`, whatever
        // lib.dom's `ErrorEvent` says.
        worker.onerror = (event: ErrorEvent | Event) => {
          event.preventDefault();
          crashed(event instanceof ErrorEvent ? event.message : "The live terminal's worker did not load.");
        };
      } catch (error) {
        crashed(`The live terminal's worker did not start: ${String(error)}`);
      }
    },
    { once: true },
  );
}

export class LiveTerminal {
  private sandbox: Sandbox | null = null;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private state: LiveState = { kind: "idle" };
  private readonly listeners = new Set<(state: LiveState) => void>();
  private readonly host: BrowserTerminalHost;
  private readonly fit: () => void;

  /** A terminal in `element`, once xterm.js has loaded. */
  static async create(element: HTMLElement, options: LiveTerminalOptions): Promise<LiveTerminal> {
    const Terminal = await loadXterm();
    const screen = new Terminal({
      cols: options.terminal.columns,
      rows: options.terminal.rows,
      fontFamily: options.font.family,
      fontSize: options.font.size,
      // Nothing scrolls back: the page scrolls, not the terminal under the pointer.
      scrollback: 0,
      // A program that picks its own colours picks them for a background it
      // cannot see: `[white]` is white on white in the light theme. The
      // terminal keeps every colour readable against its background (WCAG AA),
      // as several desktop terminals can.
      minimumContrastRatio: 4.5,
      cursorBlink: false,
    });
    return new LiveTerminal(element, screen, options);
  }

  private constructor(
    private readonly element: HTMLElement,
    private readonly screen: Xterm,
    private readonly options: LiveTerminalOptions,
  ) {
    this.host = new BrowserTerminalHost({ terminal: screen });
    // The rows are clipped by an element that clips and cannot scroll: a
    // scrollable one would scroll to show xterm's input field wherever the
    // cursor is, and move the drawn rows out of sight.
    const clip = Object.assign(document.createElement("div"), { style: "overflow: clip; width: max-content" });
    element.append(clip);
    screen.open(clip);
    this.setTheme(options.theme);
    // The element shows the rows a program has reached, not all of them: a
    // one-line progress bar is not drawn above twenty-three blank rows. A row
    // is reached when the cursor stands on it or something is drawn on it (a
    // screen that repaints returns the cursor to its top). The program still
    // sees every row. The height only grows, so a restart does not move the
    // page under the reader.
    const { rows } = options.terminal;
    const drawn = (y: number) => screen.buffer.active.getLine(y)?.translateToString(true) !== "";
    let reached = 1;
    this.fit = () => {
      const lowest = Array.from({ length: rows }, (_, y) => y).filter(drawn).pop() ?? 0;
      reached = Math.max(reached, lowest + 1, screen.buffer.active.cursorY + 1);
      // Measured each time: the cell height changes when a web font arrives or the page zooms.
      clip.style.height = `${(reached * screen.element!.offsetHeight) / rows}px`;
    };
    this.fit();
    screen.onWriteParsed(this.fit);
    // A key xterm takes as input it also stops, so a page shortcut on the same
    // key (VitePress's `/` and Ctrl+K) never sees it while the terminal has
    // focus; unfocused, every shortcut is the page's.
    this.host.onData((chunk) => this.post({ kind: "input", chunk }));
  }

  /** Run `script` from a clear screen, ending whatever ran before. */
  run(script: string, mode: RunMode): void {
    this.stop();
    this.screen.reset();
    // A still frame is drawn in one write when it freezes: until then the bytes
    // wait here, so no motion reaches the screen.
    const held: (string | Uint8Array)[] = [];
    const flush = () => held.splice(0).forEach((chunk) => this.host.write(chunk));
    // A message still queued from a run that has since ended belongs to no run.
    const current = () => this.sandbox === run;
    // The cursor is hidden: the program has ended, and a frame showing one
    // would invite typing at a prompt nothing is reading any more.
    const freeze = () => {
      flush();
      this.host.write("\x1b[?25l");
      this.end({ kind: "still" });
    };
    // The deadline asks the worker for a mark rather than freezing where it
    // fires, which can fall between two writes of one frame.
    const show =
      mode === "live"
        ? (chunk: string | Uint8Array) => this.host.write(chunk)
        : (chunk: string | Uint8Array) => {
            held.push(chunk);
            this.deadline ??= setTimeout(() => this.post({ kind: "mark" }), STILL_AFTER_MS);
          };
    const run = sandbox(this.element, this.options.runtime, (data) => {
      if (!current()) return;
      switch (data.kind) {
        case "output":
          return show(data.chunk);
        case "exit":
          flush();
          return this.end({ kind: "exited", code: data.code });
        case "settled":
          if (mode === "still") freeze();
          return;
        // A failure ends the program, as an uncaught exception ends a Node
        // process, and is shown red, on lines of its own.
        case "crashed":
          flush();
          this.host.write(`\n\x1b[31m${data.report}\x1b[0m\n`);
          return this.end({ kind: "exited", code: 1 });
        case "mark":
          return freeze();
      }
    });
    this.sandbox = run;
    this.post({ kind: "run", script, terminal: this.options.terminal });
    this.setState({ kind: "running" });
  }

  /** End the running program, if one runs; what it drew stays on screen. */
  stop(): void {
    if (this.sandbox === null) return;
    this.end({ kind: "stopped" });
  }

  /** Draw in `font` from now on, as when the page resizes the element the font is read from. */
  setFont(font: LiveTerminalOptions["font"]): void {
    const { options } = this.screen;
    if (options.fontFamily === font.family && options.fontSize === font.size) return;
    Object.assign(options, { fontFamily: font.family, fontSize: font.size });
    this.fit();
  }

  setTheme(theme: TerminalTheme): void {
    this.screen.options.theme = xtermTheme(theme);
    this.element.style.background = theme.backgroundColor.hex;
  }

  onState(listener: (state: LiveState) => void): void {
    this.listeners.add(listener);
    listener(this.state);
  }

  dispose(): void {
    this.stop();
    this.host.stop();
    this.screen.dispose();
  }

  private post(message: ToWorker): void {
    this.sandbox?.post(message);
  }

  private end(state: LiveState): void {
    clearTimeout(this.deadline);
    this.deadline = undefined;
    this.sandbox?.end();
    this.sandbox = null;
    this.setState(state);
  }

  private setState(state: LiveState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
