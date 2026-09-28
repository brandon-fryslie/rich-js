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
 * [LAW:effects-at-boundaries] The program runs in a Web Worker, one per run.
 * Stopping it is terminating the worker, so a stopped `Progress` leaves no
 * timer behind, and two terminals on one page cannot reach each other's
 * programs. The alternative, running in the page, can start a program but never
 * stop one: nothing outside a program can cancel the timers it set.
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
  | { readonly kind: "input"; readonly chunk: string | Uint8Array };

/** What the worker running a program sends the page. */
export type FromWorker =
  | { readonly kind: "output"; readonly chunk: string | Uint8Array }
  | { readonly kind: "exit"; readonly code: number }
  /**
   * The program's body has returned, or thrown, and every job it queued has
   * run. A program with timers or listeners still set runs on after this.
   */
  | { readonly kind: "settled"; readonly error: string | null };

/**
 * How a run shows its program: `live`, as it runs; or `still`, one frame, the
 * screen as it stands once the program's body has settled, drawn at once and
 * then left alone, for a reader who asked for no motion.
 */
export type RunMode = "live" | "still";

/** What the terminal is showing. */
export type LiveState =
  | { readonly kind: "idle" }
  | { readonly kind: "running" }
  | { readonly kind: "still" }
  | { readonly kind: "stopped" }
  | { readonly kind: "exited"; readonly code: number };

export interface LiveTerminalOptions {
  readonly terminal: TerminalSpec;
  readonly theme: TerminalTheme;
  readonly font: { readonly family: string; readonly size: number; readonly lineHeight: number };
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
  options: { theme: Record<string, string> };
}

type XtermConstructor = new (options: Record<string, unknown>) => Xterm;

let xterm: Promise<XtermConstructor> | undefined;

/** xterm.js, from the site's one pin, added to the page the first time a terminal is made. */
function loadXterm(): Promise<XtermConstructor> {
  xterm ??= new Promise<XtermConstructor>((resolve, reject) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", crossOrigin: "anonymous", ...XTERM.stylesheet });
    const script = Object.assign(document.createElement("script"), { crossOrigin: "anonymous", ...XTERM.script });
    script.onload = () => resolve((globalThis as unknown as { Terminal: XtermConstructor }).Terminal);
    script.onerror = () => {
      // Forgotten, so the next terminal made tries again rather than reusing a failure.
      xterm = undefined;
      link.remove();
      script.remove();
      reject(new Error(`xterm.js did not load from ${XTERM.script.src}`));
    };
    document.head.append(link, script);
  });
  return xterm;
}

export class LiveTerminal {
  private worker: Worker | null = null;
  private state: LiveState = { kind: "idle" };
  private readonly listeners = new Set<(state: LiveState) => void>();
  private readonly host: BrowserTerminalHost;

  /** A terminal in `element`, once xterm.js has loaded. */
  static async create(element: HTMLElement, options: LiveTerminalOptions): Promise<LiveTerminal> {
    const Terminal = await loadXterm();
    const screen = new Terminal({
      cols: options.terminal.columns,
      rows: options.terminal.rows,
      fontFamily: options.font.family,
      fontSize: options.font.size,
      lineHeight: options.font.lineHeight,
      // Nothing scrolls back: the page scrolls, not the terminal under the pointer.
      scrollback: 0,
      // A program that picks its own colours picks them for a background it
      // cannot see: the widgets' default palette is drawn for a dark terminal,
      // and would be white on white in the light theme. The terminal keeps
      // every colour readable against its background (WCAG AA), as several
      // desktop terminals can.
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
    const fit = () => {
      const lowest = Array.from({ length: rows }, (_, y) => y).filter(drawn).pop() ?? 0;
      reached = Math.max(reached, lowest + 1, screen.buffer.active.cursorY + 1);
      // Measured each time: the cell height changes when a web font arrives or the page zooms.
      clip.style.height = `${(reached * screen.element!.offsetHeight) / rows}px`;
    };
    fit();
    screen.onWriteParsed(fit);
    // A key xterm takes as input it also stops, so a page shortcut on the same
    // key (VitePress's `/` and Ctrl+K) never sees it while the terminal has
    // focus; unfocused, every shortcut is the page's.
    this.host.onData((chunk) => this.post({ kind: "input", chunk }));
  }

  /** Run `script` from a clear screen, ending whatever ran before. */
  run(script: string, mode: RunMode): void {
    this.stop();
    this.screen.reset();
    const worker = new Worker(new URL("./live-worker.ts", import.meta.url), { type: "module" });
    // A still frame is drawn in one write once the body settles: until then the
    // bytes wait here, so no motion reaches the screen.
    const held: (string | Uint8Array)[] = [];
    const show = mode === "live" ? (chunk: string | Uint8Array) => this.host.write(chunk) : (chunk: string | Uint8Array) => held.push(chunk);
    const flush = () => held.splice(0).forEach((chunk) => this.host.write(chunk));
    const failed = (message: string) => {
      flush();
      // Red, on a line of its own, as a terminal shows a program's crash.
      this.host.write(`\n\x1b[31m${message}\x1b[0m\n`);
      this.end({ kind: "exited", code: 1 });
    };
    // A message still queued from a run that has since ended belongs to no run.
    const current = () => this.worker === worker;
    worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
      if (!current()) return;
      switch (data.kind) {
        case "output":
          return show(data.chunk);
        case "exit":
          flush();
          return this.end({ kind: "exited", code: data.code });
        case "settled":
          if (data.error !== null) return failed(`Uncaught ${data.error}`);
          if (mode === "still") {
            flush();
            this.end({ kind: "still" });
          }
          return;
      }
    };
    // An error thrown outside the body — in a key handler, a timer — ends the
    // program, as an uncaught exception ends a Node process.
    worker.onerror = (event) => {
      event.preventDefault();
      if (current()) failed(event.message);
    };
    this.worker = worker;
    this.post({ kind: "run", script, terminal: this.options.terminal });
    this.setState({ kind: "running" });
  }

  /** End the running program, if one runs; what it drew stays on screen. */
  stop(): void {
    if (this.worker === null) return;
    this.end({ kind: "stopped" });
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
    this.worker?.postMessage(message);
  }

  private end(state: LiveState): void {
    this.worker?.terminate();
    this.worker = null;
    this.setState(state);
  }

  private setState(state: LiveState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
