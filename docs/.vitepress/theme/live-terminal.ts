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
 * The program runs in a sandbox (sandbox.ts), which owns why a worker in a
 * frame.
 *
 * [LAW:single-enforcer] Bytes and keys cross between the worker and xterm
 * through `BrowserTerminalHost`, the library's own host for an xterm terminal,
 * so a program's newlines reach the screen the way a tty delivers them.
 */
import type { Contrast } from "../example-card.js";
import { BrowserTerminalHost, type XtermDisposable, type XtermTerminal } from "../../../src/host/index.js";
import type { TerminalTheme } from "../../../src/index.js";
import { XTERM } from "../../../examples/_browser-shell/xterm.js";
import { sandbox, type Sandbox, type TerminalSpec, type ToWorker } from "./sandbox.js";

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
  /**
   * The least contrast xterm lets a colour have against its background; it
   * changes a colour to reach it. 1 shows every colour as drawn.
   */
  readonly minimumContrast: number;
}

/**
 * The contrast a docs example is shown at. A program that picks its own
 * colours picks them for a background it cannot see: `[white]` is white on
 * white in the light theme. The terminal keeps every colour readable against
 * its background (WCAG AA), as several desktop terminals can.
 */
export const READABLE_CONTRAST = 4.5;

/** The least contrast a card's live terminal lets a colour have, by the card's `Contrast` (example-card.ts). */
export const MINIMUM_CONTRAST: Readonly<Record<Contrast, number>> = { readable: READABLE_CONTRAST, "as drawn": 1 };

/**
 * The font static output is drawn in, as `LiveTerminalOptions` takes it:
 * custom.css gives a live terminal's element `--rich-fragment-font`, and xterm
 * takes it as numbers.
 *
 * [LAW:one-source-of-truth] The line height is not among them. xterm makes a
 * row its measured character height times its `lineHeight` option, rounded to
 * device pixels, so no factor handed in from here lands on the element's line
 * height. `loadXterm` and `openMeasuringInPage` instead have xterm measure its
 * character at the line custom.css derives that line height from, and the
 * option stays 1: a row is then the element's line height.
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
  /** `handler` sees each key event first; one it answers false for xterm leaves to the page. */
  attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean): void;
  options: { theme: Record<string, string>; fontFamily: string; fontSize: number };
}

/** Keys pressed only to change another: Shift between Escape and Tab still leaves. */
const MODIFIERS: ReadonlySet<string> = new Set(["Shift", "Control", "Alt", "Meta"]);

/**
 * How long after an Escape a Tab leaves the terminal: CodeMirror's window for
 * the same way out of its editor (`tabFocusMode` in @codemirror/view), so a
 * Tab a program is sent well after an Escape stays the program's.
 */
const LEAVE_WITHIN_MS = 2000;

/** The way out of a focused terminal, as the page says it beside one (LiveScreen.ts). */
export const LEAVE_HINT = "Keys go to the program · Esc then Tab leaves";

type XtermConstructor = new (options: Record<string, unknown>) => Xterm;

let xterm: Promise<XtermConstructor> | undefined;

/** xterm.js, from the site's one pin, added to the page the first time a terminal is made. */
function loadXterm(): Promise<XtermConstructor> {
  xterm ??= new Promise<XtermConstructor>((resolve, reject) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", crossOrigin: "anonymous", ...XTERM.stylesheet });
    // xterm makes a row the height it measures a character at, in whole CSS
    // pixels rounded up to whole device pixels, and measures it in the page
    // (`openMeasuringInPage`) at line-height: normal. Measured at the
    // element's --rich-fragment-line, a whole CSS pixel, a row is the line
    // height custom.css derives from it the same way (`elementFont`).
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

/**
 * `screen` opened in `parent`, measuring its character in the page, where
 * the stylesheet `loadXterm` adds sets the measure's line height.
 *
 * xterm 6 measures on an `OffscreenCanvas` when the page has one, as the
 * font's ascent plus its descent, which no stylesheet reaches; and a factor
 * on that measure cannot bring a row down to the line, because the box of a
 * face a reader may have installed is taller than 1.25em, and xterm refuses a
 * `lineHeight` under 1. With no `OffscreenCanvas` it measures a span in the
 * page, as 5.3 always did. It chooses once, as the terminal opens, and the
 * canvas measure is the only thing in xterm that reads `OffscreenCanvas`, so
 * the global is hidden for that one call and nothing else sees it gone.
 */
function openMeasuringInPage(screen: Xterm, parent: HTMLElement): void {
  const canvas = Object.getOwnPropertyDescriptor(globalThis, "OffscreenCanvas");
  if (canvas === undefined) return screen.open(parent);
  delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
  try {
    screen.open(parent);
  } finally {
    Object.defineProperty(globalThis, "OffscreenCanvas", canvas);
  }
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
      minimumContrastRatio: options.minimumContrast,
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
    openMeasuringInPage(screen, clip);
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
    // Every key is the program's, Tab and Escape too, so a keyboard needs one
    // way out (`LEAVE_HINT`): Escape, then Tab, as it leaves the card's editor
    // (playground-editor.ts). The Escape still reaches the program; a Tab as
    // the next key, within `LEAVE_WITHIN_MS`, is the page's, and moves focus
    // on, or back with Shift.
    let escapedAt = -Infinity;
    screen.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" || MODIFIERS.has(event.key)) return true;
      const leaving = event.key === "Tab" && event.timeStamp - escapedAt <= LEAVE_WITHIN_MS;
      escapedAt = event.key === "Escape" ? event.timeStamp : -Infinity;
      return !leaving;
    });
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
        // What is typed reaches a program whether or not it said it would read it.
        case "listening":
          return;
      }
    });
    this.sandbox = run;
    this.post({ kind: "run", script, terminal: this.options.terminal });
    this.setState({ kind: "running" });
  }

  /** Type `chunk` at the running program, as a key typed at the terminal is; with none running, it goes nowhere. */
  type(chunk: string | Uint8Array): void {
    this.post({ kind: "input", chunk });
  }

  /**
   * End the running program, if one runs; what it drew stays on screen. A
   * frame it was part-way through is shown as far as it got, once xterm gives
   * up waiting for its end, as a terminal shows a program killed mid-frame.
   */
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
