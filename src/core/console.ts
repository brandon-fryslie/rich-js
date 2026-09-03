/**
 * Console — the central orchestrator for rendering styled output to the terminal.
 */

import { Segment } from "./segment.js";
import { Style, NULL_STYLE, Theme } from "./style.js";
import { ColorDepth, resolveColorSystem } from "./color.js";
import type { DetectColorOptions } from "./color.js";
import { RichText } from "./text.js";
import { render as renderMarkup } from "./markup.js";
import { ReprHighlighter } from "./highlighter.js";
import type { Highlighter } from "./highlighter.js";
// [LAW:one-way-deps] exception: one of the two sanctioned upward edges out of
// `core/`, named in CLAUDE.md and pinned by `test/seam/layering.test.ts` — the
// orchestrator reaching down for `Rule`. `RuleOptions` rides the same edge
// rather than being restated here; see `rule()`.
import { Rule, type RuleOptions } from "../renderables/rule.js";
import { segmentsToString } from "./render.js";
import type {
  Renderable,
  RenderOptions,
} from "./protocol.js";
import { isRenderable } from "./protocol.js";

// --- Types ---

// [LAW:types-are-the-program] The strongest theorem about Console's output
// sink is "we call .write(chunk) on it." Nothing else. Narrowing to that
// exact surface lets every structurally-compatible writable (process.stdout,
// process.stderr, hostStream(host), any test double) be passed without a
// cast. `NodeJS.WritableStream` over-promised ~30 methods Console never
// touched, and the lie forced callers wrapping non-stream sinks (e.g. the
// browser TerminalHost adapter) to launder through `as unknown as`.
export interface ConsoleSink {
  write(chunk: string | Uint8Array): unknown;
}

// [LAW:types-are-the-program] A sink you can also interrogate: the console asks
// its output target three questions beyond "take these bytes" — are you a
// terminal, how wide are you, how tall. All three are optional because a plain
// `ConsoleSink` answers none of them, and "unknown" is a legal answer that the
// size and TTY defaults already handle.
export interface ConsoleStream extends ConsoleSink {
  readonly isTTY?: boolean;
  readonly columns?: number;
  readonly rows?: number;
}

/**
 * The host facilities a `Console` consults: an environment map and the two
 * standard streams. Node's `process` satisfies this shape as-is, which is the
 * point — injecting a fake terminal needs no adapter at either end.
 */
export interface ConsoleEnvironment {
  readonly env: NodeJS.ProcessEnv;
  readonly stdout?: ConsoleStream;
  readonly stderr?: ConsoleStream;
}

export interface ConsoleOptions {
  /**
   * Color encoding. Accepts a string spec (`"auto"`, `"truecolor"`, `"256"`,
   * `"ansi"`, `"none"`), a `ColorDepth` enum value (use this for `WINDOWS`,
   * which has no string spec), or `null` for no color. Default `"auto"`.
   */
  colorSystem?: string | ColorDepth | null;
  /**
   * Static width (cells). Ignored when `getSize` is provided. Falls back to
   * the `COLUMNS` env var / the bound stream's `columns` / 80.
   */
  width?: number;
  /**
   * Static height (lines). Ignored when `getSize` is provided. Falls back to
   * the `LINES` env var / the bound stream's `rows` / 24.
   */
  height?: number;
  /**
   * Live size source. When provided, the console reads its width/height from
   * this function on every access, overriding any static `width`/`height` and
   * the bound stream's dimensions. Pass this when the output target's
   * dimensions can change at runtime (e.g. xterm.js in a browser).
   *
   * [LAW:dataflow-not-control-flow] Live size is a function value the
   * console reads, not a branch the call site has to install via
   * `Object.defineProperty`.
   */
  getSize?: () => { width: number; height: number };
  style?: string | Style;
  forceTerminal?: boolean;
  forceInteractive?: boolean;
  stderr?: boolean;
  file?: ConsoleSink;
  /**
   * Host facilities to consult for colour detection, size detection, and the
   * default output sink. Defaults to the ambient `process`, or — where there
   * is no `process` — an empty environment with no streams. Pass this to drive
   * a `Console` deterministically, or to run one against a simulated terminal.
   */
  environment?: ConsoleEnvironment;
  record?: boolean;
  markup?: boolean;
  highlight?: boolean;
  theme?: Theme;
  highlighter?: Highlighter;
}

export interface PrintOptions {
  style?: string | Style;
  justify?: "default" | "left" | "center" | "right" | "full";
  overflow?: "fold" | "crop" | "ellipsis" | "ignore";
  highlight?: boolean;
  markup?: boolean;
  softWrap?: boolean;
  crop?: boolean;
  end?: string;
  sep?: string;
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

// [LAW:single-enforcer] Color spec → ColorDepth resolution lives in
// `resolveColorSystem`. This helper just normalizes the option shape (string |
// enum | null) into the cached `_colorSystem` field. WINDOWS has no string
// spec; callers reach it via the enum directly.
//
// [LAW:dataflow-not-control-flow] `isTTY` and `env` are forwarded
// unconditionally; `resolveColorSystem` ignores them for non-`"auto"` specs.
// Passing both is what keeps detection inside the console's injected
// environment — left to its own defaults, `detectColorSystem` would consult
// the ambient `process.env` and `process.stdout.isTTY` even for a console
// bound to a different stream.
function resolveOptionColorSystem(
  spec: string | ColorDepth | null | undefined,
  detect: DetectColorOptions,
): ColorDepth | null {
  if (spec === null) return null;
  if (spec === undefined) return resolveColorSystem("auto", detect);
  if (typeof spec === "string") return resolveColorSystem(spec, detect);
  return spec;
}

// A host with an environment but no streams — what a browser looks like from
// here. Frozen so the shared instance cannot be mutated into a fake terminal.
const DETACHED_ENVIRONMENT: ConsoleEnvironment = Object.freeze({
  env: Object.freeze({}),
});

// [LAW:single-enforcer] The only read of the ambient `process` global in this
// module, and the reason every other function below takes its environment as
// an argument. `process` satisfies `ConsoleEnvironment` structurally, so the
// node path needs no adapter; the browser path degrades to a host that answers
// "no streams" rather than throwing at the reference.
function ambientEnvironment(): ConsoleEnvironment {
  return typeof process === "undefined" ? DETACHED_ENVIRONMENT : process;
}

// [LAW:one-source-of-truth] A console talks to exactly one stream, and every
// question it asks the host — are you a terminal, how wide are you, where do
// bytes go — is a question about *that* stream. Selecting it once, here, is
// what makes the three answers agree. When each site re-selected for itself,
// one of them (size) silently didn't, and a `Console({ stderr: true })` keyed
// its colour to stderr and its width to stdout.
function boundStream(
  environment: ConsoleEnvironment,
  useStderr: boolean,
): ConsoleStream | undefined {
  return useStderr ? environment.stderr : environment.stdout;
}

// [LAW:single-enforcer] Effective TTY status of the console's output target is
// computed once, at construction, and cached — an explicit `file` is not a
// terminal, `forceTerminal` says it is regardless, and otherwise the bound
// stream answers. Every input is fixed at construction, so recomputing per
// read could only ever return the same answer twice.
function effectiveIsTTY(
  options: ConsoleOptions | undefined,
  stream: ConsoleStream | undefined,
): boolean {
  if (options?.forceTerminal) return true;
  if (options?.file) return false;
  return stream?.isTTY ?? false;
}

function terminalSize(
  environment: ConsoleEnvironment,
  stream: ConsoleStream | undefined,
): { width: number; height: number } {
  const cols = environment.env["COLUMNS"];
  const lines = environment.env["LINES"];
  const w = cols ? parseInt(cols, 10) : (stream?.columns ?? 80);
  const h = lines ? parseInt(lines, 10) : (stream?.rows ?? 24);
  return { width: w || 80, height: h || 24 };
}

// [LAW:single-enforcer] One trust-boundary check: when no `file:` was
// provided, the console writes to the stream it is bound to — which a browser
// host does not have. Without this, the absence would surface as a `TypeError`
// deep inside `_write`. Centralizing it here keeps both consumers (`file`
// getter, `_write`) behaving identically — no second copy of the check to
// drift.
function defaultSink(stream: ConsoleStream | undefined): ConsoleSink {
  if (stream === undefined) {
    throw new Error(
      "Console: no `file` provided and the environment has no stream to " +
        "write to (e.g. running in a browser). Pass `file: hostStream(host)` " +
        "or any other ConsoleSink so output has somewhere to go.",
    );
  }
  return stream;
}

// [LAW:dataflow-not-control-flow] Build one size-reading function at
// construction time from whichever options the caller supplied. The width
// getter is then unconditional — it always calls `_getSize()`. Variability
// lives in the captured closure (which source it consults), not in branches
// the getter has to evaluate on every read.
//
// The all-static and mixed cases get *different* closures: when both
// dimensions are fixed, the returned function is a constant — no
// `terminalSize` call on every read, since neither value can change.
// When at least one dimension is dynamic, the closure consults
// `terminalSize` to fill in the missing side.
function resolveGetSize(
  options: ConsoleOptions | undefined,
  environment: ConsoleEnvironment,
  stream: ConsoleStream | undefined,
): () => { width: number; height: number } {
  if (options?.getSize) return options.getSize;
  const staticWidth = options?.width;
  const staticHeight = options?.height;
  if (staticWidth !== undefined && staticHeight !== undefined) {
    // [LAW:one-source-of-truth] Freeze the captured object so consumers can't
    // mutate `console.size` and silently change every subsequent read.
    // Matches the dynamic-closure path (which builds a fresh object per call
    // and is therefore implicitly immutable from a sharing standpoint).
    const fixed = Object.freeze({ width: staticWidth, height: staticHeight });
    return () => fixed;
  }
  return () => {
    const term = terminalSize(environment, stream);
    return {
      width: staticWidth ?? term.width,
      height: staticHeight ?? term.height,
    };
  };
}

// --- Console ---

export class Console {
  private _colorSystem: ColorDepth | null;
  // [LAW:one-source-of-truth] Size flows through a single function. Static
  // `width`/`height` options collapse into a closure that returns them; a
  // caller-supplied `getSize` overrides. Every size read in this class goes
  // through `_getSize()` — no second path, no second source to drift.
  private _getSize: () => { width: number; height: number };
  private _style: Style;
  private _isTerminal: boolean;
  private _forceInteractive: boolean | undefined;
  private _file: ConsoleSink | undefined;
  // [LAW:one-source-of-truth] The resolved output stream, not the `stderr`
  // flag that selected it. Storing the answer instead of the question is what
  // stops `isTerminal`, `size`, and `file` from re-deriving it three ways.
  private _stream: ConsoleStream | undefined;
  private _record: boolean;
  private _markup: boolean;
  private _highlight: boolean;
  private _theme: Theme;
  private _highlighter: Highlighter;
  private _recorded: Segment[];
  // [LAW:types-are-the-program] The capture state is carried in the *type*
  // of this field, not in a sentinel value. `null` = not capturing; any
  // string (including "") = capturing, this is the buffer. A paired
  // boolean+string would admit the impossible state "not capturing, buffer
  // non-empty" — `string | null` makes that unrepresentable.
  private _capture: string | null;

  constructor(options?: ConsoleOptions) {
    const environment = options?.environment ?? ambientEnvironment();
    const stream = boundStream(environment, options?.stderr ?? false);
    this._stream = stream;
    this._isTerminal = effectiveIsTTY(options, stream);
    this._colorSystem = resolveOptionColorSystem(options?.colorSystem, {
      isTTY: this._isTerminal,
      env: environment.env,
    });
    this._getSize = resolveGetSize(options, environment, stream);
    this._style = resolveStyle(options?.style);
    this._forceInteractive = options?.forceInteractive;
    this._file = options?.file;
    this._record = options?.record ?? false;
    this._markup = options?.markup !== false;
    this._highlight = options?.highlight !== false;
    this._theme = options?.theme ?? new Theme();
    this._highlighter = options?.highlighter ?? new ReprHighlighter();
    this._recorded = [];
    this._capture = null;
  }

  // --- Properties ---

  get size(): { width: number; height: number } {
    return this._getSize();
  }

  get width(): number {
    return this._getSize().width;
  }

  get height(): number {
    return this._getSize().height;
  }

  get encoding(): string {
    return "utf-8";
  }

  get isTerminal(): boolean {
    return this._isTerminal;
  }

  get isInteractive(): boolean {
    if (this._forceInteractive !== undefined) return this._forceInteractive;
    return this.isTerminal;
  }

  get colorSystem(): ColorDepth | null {
    return this._colorSystem;
  }

  // [LAW:one-source-of-truth] Output target lookup matches `_write`'s:
  // explicit `file` wins, otherwise `defaultSink` returns the bound stream
  // (or throws clearly when the environment has none). Exposed
  // so renderables that bypass the segment pipeline (e.g. Live's raw control
  // sequences) still write to the caller's configured stream. Return type is
  // the narrow `ConsoleSink` — Live (and any external consumer) only needs
  // `.write()`, so the type tells the truth about what the surface guarantees.
  get file(): ConsoleSink {
    return this._file ?? defaultSink(this._stream);
  }

  get theme(): Theme {
    return this._theme;
  }

  get options(): RenderOptions {
    return {
      maxWidth: this.width,
      isTerminal: this.isTerminal,
      encoding: this.encoding,
      asciiOnly: false,
    };
  }

  // --- Print ---

  print(...args: unknown[]): void {
    // Extract options from last arg if it's a PrintOptions
    let opts: PrintOptions = {};
    let items: unknown[];

    const lastArg = args[args.length - 1];
    if (
      args.length > 0 &&
      typeof lastArg === "object" &&
      lastArg !== null &&
      !isRenderable(lastArg) &&
      !(lastArg instanceof RichText) &&
      ("style" in lastArg || "justify" in lastArg || "markup" in lastArg ||
       "highlight" in lastArg || "overflow" in lastArg || "end" in lastArg ||
       "softWrap" in lastArg || "crop" in lastArg || "sep" in lastArg)
    ) {
      opts = lastArg as PrintOptions;
      items = args.slice(0, -1);
    } else {
      items = args;
    }

    const doMarkup = opts.markup ?? this._markup;
    const doHighlight = opts.highlight ?? this._highlight;
    const sep = opts.sep ?? " ";
    const end = opts.end ?? "\n";
    const printStyle = resolveStyle(opts.style);

    // Convert items to renderables
    const renderables: Renderable[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i > 0 && sep) {
        renderables.push(new RichText(sep, { end: "" }));
      }

      const item = items[i];
      if (isRenderable(item)) {
        renderables.push(item);
      } else if (item instanceof RichText) {
        renderables.push(item);
      } else {
        const text = String(item);
        let richText: RichText;
        if (doMarkup) {
          richText = renderMarkup(text);
        } else {
          richText = new RichText(text);
        }
        richText.end = "";
        if (doHighlight) {
          this._highlighter.highlight(richText);
        }
        renderables.push(richText);
      }
    }

    // Render all items
    const allSegments: Segment[] = [];
    const renderOpts: RenderOptions = {
      maxWidth: this.width,
      isTerminal: this.isTerminal,
      encoding: this.encoding,
      justify: opts.justify === "default" ? undefined : opts.justify as RenderOptions["justify"],
      overflow: opts.overflow === "ignore" ? undefined : opts.overflow as RenderOptions["overflow"],
      noWrap: opts.softWrap,
    };

    for (const renderable of renderables) {
      allSegments.push(...renderable.render(renderOpts));
    }

    // Apply print style
    const styled = printStyle.isNull
      ? allSegments
      : [...Segment.applyStyle(allSegments, printStyle)];

    // Apply base console style
    const final = this._style.isNull
      ? styled
      : [...Segment.applyStyle(styled, this._style)];

    // Output. The line-end goes through the same writeSegments funnel as
    // every other emitted text so it survives recording — otherwise
    // `exportText` and `exportHtml` would join consecutive prints onto a
    // single line. [LAW:single-enforcer]
    this._writeSegments(final);
    // The common default end is "\n" — reuse Segment's cached newline rather
    // than allocating one per print; only a non-default end needs a fresh one.
    if (end) this._writeSegments([end === "\n" ? Segment.line() : new Segment(end)]);
  }

  log(...args: unknown[]): void {
    // Simple log implementation — adds timestamp
    const now = new Date();
    const time = now.toLocaleTimeString();
    const timeText = new RichText(`[${time}] `, { end: "" });
    timeText.stylize("log.time");

    this.print(timeText, ...args);
  }

  // [LAW:one-source-of-truth] `RuleOptions` is `Rule`'s, not a restatement of
  // it. `console.ts` used to declare its own copy and field-by-field forward
  // into this constructor, which made a second map of one shape — identical
  // then, free to drift the moment `Rule` grew an option.
  rule(title?: string, options?: RuleOptions): void {
    const segments = [...new Rule(title, options).render(this.options)];
    this._writeSegments(segments);
  }

  printJson(json: string | object, options?: { indent?: number; sortKeys?: boolean }): void {
    // Lazy import to avoid circular deps
    const data = typeof json === "string" ? JSON.parse(json) as unknown : json;
    const formatted = JSON.stringify(data, options?.sortKeys ? Object.keys(data as object).sort().reduce((r: Record<string, unknown>, k) => { r[k] = (data as Record<string, unknown>)[k]; return r; }, {}) as unknown as undefined : undefined, options?.indent ?? 2);
    const text = new RichText(formatted, { end: "" });
    this.print(text);
  }

  // --- Capture ---

  // [LAW:one-source-of-truth] Redirect semantics match Python Rich's
  // `Console.capture()`: while a capture is active the underlying target
  // (file / stdout / stderr) receives nothing, and `endCapture()` returns
  // the full text that would otherwise have been written. This is not a
  // tee — callers wanting both must compose explicitly.
  beginCapture(): void {
    this._capture = "";
  }

  endCapture(): string {
    const result = this._capture ?? "";
    this._capture = null;
    return result;
  }

  // --- Export (when record:true) ---

  exportText({ clear = true }: { clear?: boolean } = {}): string {
    const text = this._recorded.map((s) => s.text).join("");
    if (clear) this._recorded = [];
    return text;
  }

  exportHtml({ clear = true }: { clear?: boolean } = {}): string {
    const parts: string[] = [];
    parts.push('<!DOCTYPE html>');
    parts.push('<html><head><meta charset="utf-8"><style>');
    parts.push('body{background:#000;color:#fff;font-family:monospace;padding:1em}');
    parts.push('pre{margin:0;white-space:pre-wrap;word-wrap:break-word}');
    parts.push('</style></head><body><pre>');

    for (const segment of this._recorded) {
      if (segment.isControl) continue;
      const css = this._styleToCss(segment.style);
      const escaped = segment.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      parts.push(css ? `<span style="${css}">${escaped}</span>` : escaped);
    }

    parts.push('</pre></body></html>');
    if (clear) this._recorded = [];
    return parts.join("");
  }

  private _styleToCss(style: Style | undefined): string {
    if (!style || style.isNull) return "";
    const parts: string[] = [];
    if (style.bold) parts.push("font-weight:bold");
    if (style.italic) parts.push("font-style:italic");
    if (style.dim) parts.push("opacity:0.5");
    const underlineParts: string[] = [];
    if (style.underline || style.underline2) underlineParts.push("underline");
    if (style.strike) underlineParts.push("line-through");
    if (style.overline) underlineParts.push("overline");
    if (underlineParts.length) parts.push(`text-decoration:${underlineParts.join(" ")}`);
    if (style.color && !style.color.isDefault) {
      const t = style.color.getTruecolor();
      parts.push(`color:${t.hex}`);
    }
    if (style.bgcolor && !style.bgcolor.isDefault) {
      const t = style.bgcolor.getTruecolor();
      parts.push(`background-color:${t.hex}`);
    }
    return parts.join(";");
  }

  // --- Internal ---

  // [LAW:single-enforcer] One encode call per write batch routes through the
  // same `segmentsToString` tree-coalescer used by `renderToString`. Adjacent
  // same-style segments share one SGR open/close pair on the wire instead of
  // one pair per segment. Recording captures every non-control segment for
  // replay regardless of how the bytes coalesce.
  private _writeSegments(segments: Segment[]): void {
    if (this._record) {
      for (const segment of segments) {
        if (!segment.isControl) this._recorded.push(segment);
      }
    }
    const encoded = segmentsToString(segments, this._colorSystem);
    if (encoded.length > 0) this._write(encoded);
  }

  private _write(text: string): void {
    // [LAW:types-are-the-program] `_capture !== null` is a discriminator
    // narrow on `string | null`, not a sentinel comparison — the type
    // carries the active/inactive state. The early return is what makes
    // this a redirect (not a tee); see beginCapture for semantics.
    if (this._capture !== null) {
      this._capture += text;
      return;
    }
    const target = this._file ?? defaultSink(this._stream);
    target.write(text);
  }
}

