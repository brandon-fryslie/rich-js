/**
 * Console — the central orchestrator for rendering styled output to the terminal.
 */

import { Segment } from "./segment.js";
import { Style, NULL_STYLE, Theme, DEFAULT_THEME } from "./style.js";
import { ColorDepth, resolveDestination } from "./color.js";
import type { Destination } from "./color.js";
import type { Env } from "./env.js";
import type { TerminalTheme } from "./color.js";
import { encodeHtml } from "./export-html.js";
import { encodeSvg } from "./export-svg.js";
import { RichText } from "./text.js";
import { renderStr } from "./markup.js";
import { Pretty, isExpandable } from "./pretty.js";
import { JSONRenderable, type JSONOptions } from "./json.js";
import { ReprHighlighter, NullHighlighter } from "./highlighter.js";
import type { Highlighter } from "./highlighter.js";
// [LAW:one-way-deps] exception: one of the two sanctioned upward edges out of
// `core/`, named in CLAUDE.md and pinned by `test/seam/layering.test.ts` — the
// orchestrator reaching down for `Rule`. `RuleOptions` rides the same edge
// rather than being restated here; see `rule()`.
import { Rule, type RuleOptions } from "../renderables/rule.js";
import { segmentsToString } from "./render.js";
import { placeBlock, type Alignment } from "./place.js";
import type {
  Height,
  Measurable,
  OverflowMethod,
  Renderable,
  RenderOptions,
  StyleErrorHandler,
} from "./protocol.js";
import { isRenderable } from "./protocol.js";

// --- Types ---

// [LAW:types-are-the-program] The strongest theorem about Console's output
// sink is "we call .write(chunk) on it." Nothing else. Narrowing to that
// exact surface lets every structurally-compatible writable (process.stdout,
// process.stderr, a terminal host's stream, any test double) be passed without a
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
  readonly env: Env;
  readonly stdout?: ConsoleStream;
  readonly stderr?: ConsoleStream;
}

export interface ConsoleOptions {
  /**
   * Color encoding. Accepts a string spec (`"auto"`, `"truecolor"`, `"256"`,
   * `"ansi"`, `"none"`), a `ColorDepth` enum value (use this for `WINDOWS`,
   * which has no string spec), or `null` for no color. Default `"auto"`.
   * Colour only: an explicit depth, `null` included, keeps hyperlinks.
   */
  colorSystem?: string | ColorDepth | null;
  /**
   * Whether OSC 8 hyperlinks are emitted. Default: what the destination takes
   * — true for an explicit `colorSystem`, detected under `"auto"` (no TTY or
   * TERM=dumb: false). `false` with `colorSystem: null` writes plain text.
   */
  hyperlinks?: boolean;
  /**
   * The terminal can draw only ASCII: boxes, rules, tree guides and widget
   * marks draw with ASCII characters instead of line-drawing glyphs. A
   * property of the output device, so it is set here once and reaches every
   * renderable this console draws. Default false.
   */
  asciiOnly?: boolean;
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
  /**
   * Called each time a render resolves a style string it cannot parse — a
   * misspelled name, a key the theme lacks — and degrades it to unstyled.
   * Calls are per resolution, not per distinct string: a style read twice, or
   * redrawn by a refresh, is reported again. Throw from it to make rendering
   * strict.
   */
  onStyleError?: StyleErrorHandler;
}

export interface PrintOptions {
  style?: string | Style;
  justify?: "default" | "left" | "center" | "right" | "full";
  overflow?: OverflowMethod;
  highlight?: boolean;
  markup?: boolean;
  softWrap?: boolean;
  crop?: boolean;
  end?: string;
  sep?: string;
}

// [LAW:types-are-the-program] The two kinds of block a print is made of, and
// the discriminator is who ends the lines: a text run is ended by the print's
// `end`, a renderable's lines are each closed by the print.
type PrintBlock =
  | { kind: "text"; items: RichText[] }
  | { kind: "lines"; renderable: Renderable };

// What a print draws, before it is written: its rows, whether the last one is
// closed, and the width they are cropped at. `print` writes them as they are;
// `log` sets them in the cell beside its time.
type Drawn = { rows: Segment[][]; closed: boolean; cropWidth: number };

// Rows as the bytes that reach the terminal. Every row but the last is closed
// by a line break, and the last one when `closed` says so. Crop last, and crop
// the line-end with the rest: in the reference `end` is the tail of the printed
// line, so a line cut at the edge loses it too.
function emit({ rows, closed, cropWidth }: Drawn): Segment[] {
  const output = rows.flatMap((row, index) =>
    closed || index < rows.length - 1 ? [...row, Segment.line()] : row,
  );
  return [...Segment.cropLines(output, cropWidth)];
}

// The time `log` stamps, in a form whose width does not change with the hour.
const LOG_TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit" };

// Three of the five justify methods place what a print draws as a block, the
// way Rich's `print` wraps each renderable in `Align`. The other two leave it
// where it was drawn: `"default"` asks for no placement, and `"full"` is a way
// of setting a paragraph's words, which only text can do.
const PLACED_BY: Record<NonNullable<PrintOptions["justify"]>, Alignment | undefined> = {
  default: undefined,
  full: undefined,
  left: "left",
  center: "center",
  right: "right",
};

// A text run as one block: its items joined into one text, as the reference's
// `Text.join` joins them, drawn under the print's options and ended by the
// print's `end`. Measure and render both read that one text, so the width
// `justify` places the run at is the width it is drawn at. Each item's own
// `justify`, `overflow`, `noWrap` and `tabSize` stay behind, as they do in the
// reference: the print's options set the whole run.
class TextRun implements Renderable, Measurable {
  private readonly text: RichText;

  constructor(
    items: readonly RichText[],
    private readonly end: Segment,
  ) {
    this.text = items.reduce((joined, item) => joined.append(item), new RichText("", { end: "" }));
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this.text.render(options);
    yield this.end;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.text.measure(options);
  }
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
        "write to (e.g. running in a browser). Pass " +
        "`environment: hostEnvironment(host)` to write through a terminal " +
        "host, or a `file` so output has somewhere to go.",
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

/** Shared because it is stateless: highlighting nothing has nothing to own. */
const NO_HIGHLIGHT = new NullHighlighter();

/**
 * What `print` bounds a data argument by when the caller said nothing.
 *
 * `print` formats whatever it is handed, so it is the one place that has to
 * assume nothing about the value's size, in any of the three ways a value can
 * be large. Unbounded, `print(buffer)` emits a line per byte,
 * `print(deeplyNested)` descends until the stack gives out, and a single
 * response body assigned to a field arrives in full — each of them a debug line
 * that costs megabytes or hangs the terminal. All three bounds announce
 * themselves in the output (`... +N`, `{...}`, `+N` after the closing quote),
 * so this truncates visibly and never silently. [LAW:no-silent-failure]
 *
 * `maxString` reaches only strings nested inside data; a string argument is
 * printed by the arm above, where the caller asked for that string by name.
 *
 * A caller constructing a `Pretty` has seen their data and gets no defaults;
 * these belong to the convenience path, not to the formatter.
 */
const PRINT_DATA_BOUNDS = { maxLength: 100, maxDepth: 16, maxString: 1000 } as const;

export class Console {
  private readonly _destination: Destination;
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
  private _onStyleError: StyleErrorHandler | undefined;
  private readonly _asciiOnly: boolean;
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
    // [LAW:dataflow-not-control-flow] `isTTY` and `env` are forwarded
    // unconditionally, so detection stays inside the console's injected
    // environment rather than the ambient process's.
    const resolved = resolveDestination(
      options?.colorSystem === undefined ? "auto" : options.colorSystem,
      { isTTY: this._isTerminal, env: environment.env },
    );
    // [LAW:single-enforcer] The console's one override, an explicit
    // `hyperlinks`, is applied here and nowhere else; every write encodes for
    // this value whole.
    this._destination = {
      colorSystem: resolved.colorSystem,
      hyperlinks: options?.hyperlinks ?? resolved.hyperlinks,
    };
    this._getSize = resolveGetSize(options, environment, stream);
    // [LAW:no-ambient-temporal-coupling] The theme is assigned before the
    // style, because the console's own style may be one of the theme's names.
    this._theme = options?.theme ?? DEFAULT_THEME;
    this._style = this._theme.resolve(options?.style ?? NULL_STYLE);
    this._forceInteractive = options?.forceInteractive;
    this._file = options?.file;
    this._record = options?.record ?? false;
    this._markup = options?.markup !== false;
    this._highlight = options?.highlight !== false;
    this._highlighter = options?.highlighter ?? new ReprHighlighter();
    this._onStyleError = options?.onStyleError;
    this._asciiOnly = options?.asciiOnly ?? false;
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

  get isTerminal(): boolean {
    return this._isTerminal;
  }

  get isInteractive(): boolean {
    if (this._forceInteractive !== undefined) return this._forceInteractive;
    return this.isTerminal;
  }

  get colorSystem(): ColorDepth | null {
    return this._destination.colorSystem;
  }

  /**
   * Where this console writes: the colour depth it draws at and whether it
   * emits OSC 8 hyperlinks, overrides applied — the value its output is
   * encoded for, for anything that encodes on its behalf (`Live`).
   */
  get destination(): Destination {
    return this._destination;
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

  get options(): RenderOptions & { height: Height } {
    // One read of the size, so a resize cannot pair one frame's width with
    // another's height.
    const { width, height } = this.size;
    return {
      maxWidth: width,
      // The terminal an inline print lands on: a ceiling, never a region —
      // content keeps its natural height beneath it.
      height: { rows: height, exact: false },
      isTerminal: this.isTerminal,
      asciiOnly: this._asciiOnly,
      theme: this._theme,
      onStyleError: this._onStyleError,
      colorSystem: this._destination.colorSystem,
      markup: this._markup,
      highlighter: this._highlight ? this._highlighter : undefined,
    };
  }

  // --- Print ---

  print(...args: unknown[]): void {
    this._writeSegments(emit(this._draw(args, this.options)));
  }

  // What `print` draws for `args` at `options.maxWidth`.
  private _draw(args: unknown[], options: RenderOptions): Drawn {
    // Extract options from last arg if it's a PrintOptions
    let opts: PrintOptions = {};
    let items: unknown[];

    // The trailing options object is only recognised when something precedes
    // it. A lone object is data — `print({ style: "..." })` reads as a value to
    // format, and treating it as options would emit an empty line, which is the
    // one outcome this method must never produce. Nothing is given up: options
    // configure the rendering of content, so a call carrying options and no
    // content had nothing to render either way. [LAW:no-silent-failure]
    const lastArg = args[args.length - 1];
    if (
      args.length > 1 &&
      typeof lastArg === "object" &&
      lastArg !== null &&
      !isRenderable(lastArg) &&
      ("style" in lastArg || "justify" in lastArg || "markup" in lastArg ||
       "highlight" in lastArg || "overflow" in lastArg || "end" in lastArg ||
       "softWrap" in lastArg || "crop" in lastArg || "sep" in lastArg)
    ) {
      opts = lastArg as PrintOptions;
      items = args.slice(0, -1);
    } else {
      items = args;
    }

    // What a string is read as, wherever in this print it lands: an argument,
    // or a cell or label inside a renderable argument. `print`'s own flags
    // outrank the console's, as Rich's `options.update` has them.
    const strings: Pick<RenderOptions, "markup" | "highlighter"> = {
      markup: opts.markup ?? this._markup,
      highlighter: (opts.highlight ?? this._highlight) ? this._highlighter : undefined,
    };
    const sep = opts.sep ?? " ";
    const end = opts.end ?? "\n";
    const softWrap = opts.softWrap ?? false;
    const printStyle = this._theme.resolve(opts.style ?? NULL_STYLE);

    // A print is a column of blocks, and every argument joins one of two kinds.
    // Text — a string, a `RichText`, or a scalar — runs together: adjacent text
    // items are one block, joined by `sep` and ended by `end`. Any other
    // renderable is a block of its own that occupies whole lines, so neither
    // `sep` nor `end` ever touches it. That is the reference's split — `end`
    // belongs to text, not to the print — and it is what lets two printed panels
    // stack with no blank line between them. Data is cut where the reference
    // cuts it: a container (`isExpandable`) is a block, a scalar is text. A
    // container is laid out by `Pretty` across as many lines as it needs, and
    // joined into a run it would start partway along a line and leave its
    // closing bracket where the next item carries on. The line is not closed by
    // asking where the cursor sits: `print("a\n")` is a line and an empty one,
    // here as in the reference and in every other `print`, and only the kind of
    // the item can tell that trailing break from a `Panel`'s. A call with
    // nothing to print is one empty text run, so it still ends the line.
    const blocks: PrintBlock[] = items.length === 0 ? [{ kind: "text", items: [] }] : [];
    for (const item of items) {
      // Four arms, and they are the whole domain. A `RichText` is already text;
      // it runs as a copy with its own `end` cleared, as a string's is, because
      // the line end of a run is the print's. Any other renderable draws itself,
      // as a block. A string is the only kind of argument that can *contain*
      // markup, so it is the only kind the markup dialect is applied to.
      // Everything else is data — a block when it is a container, text when it
      // is not — and `Pretty` is the single authority on how a
      // JavaScript value displays — `String(value)` was a second, weaker one
      // that answered `[object Object]` for every object and let the markup
      // parser eat it. [LAW:one-source-of-truth]
      let text: RichText;
      if (item instanceof RichText) {
        const richText = item.copy();
        richText.end = "";
        text = richText;
      } else if (isRenderable(item)) {
        blocks.push({ kind: "lines", renderable: item });
        continue;
      } else if (typeof item === "string") {
        text = renderStr(item, strings);
      } else {
        // The highlighter travels with the value. `highlight` and a custom
        // `highlighter` are console-wide settings, so they have to reach a
        // formatted object the same way they reach a printed string; a `Pretty`
        // left to its own default would outrank both. [LAW:dataflow-not-control-flow]
        // the disabled case is an identity highlighter, not a skipped call.
        // Indent guides are styling too, and travel with the same decision —
        // the console owns what `highlight` means for everything it emits,
        // rather than `Pretty` inferring it back out of the highlighter.
        const pretty = new Pretty(item, {
          ...PRINT_DATA_BOUNDS,
          highlighter: strings.highlighter ?? NO_HIGHLIGHT,
          indentGuides: strings.highlighter !== undefined,
        });
        // A scalar spells the same at every width, so it joins its run as the
        // one text it is.
        if (isExpandable(item)) {
          blocks.push({ kind: "lines", renderable: pretty });
          continue;
        }
        text = pretty.toText(options);
      }
      const run = blocks.at(-1);
      if (run?.kind === "text") run.items.push(new RichText(sep, { end: "" }), text);
      else blocks.push({ kind: "text", items: [text] });
    }

    // Soft wrap is the reference's pair of defaults, not a mode of its own: it
    // stops wrapping, and when no overflow was named it asks for `"ignore"`, so
    // the line leaves unbounded. A named overflow still cuts the unwrapped line
    // at the width, as Rich's does. What `"ignore"` does to a line — no edge,
    // no justify — is `RichText`'s to apply, so it crosses as it was asked for.
    const renderOpts: RenderOptions = {
      ...options,
      ...strings,
      justify: opts.justify === "default" ? undefined : opts.justify,
      overflow: opts.overflow ?? (softWrap ? "ignore" : undefined),
      noWrap: softWrap,
    };

    // The print style, then the console's base style, over each line a block
    // drew and never over the break that ends it: a styled break carries SGR
    // codes across the newline.
    // [LAW:dataflow-not-control-flow] no style to apply is an empty list, not
    // a skipped step.
    const styles = [printStyle, this._style].filter((style) => !style.isNull);
    const styleContent = (segments: Iterable<Segment>): Iterable<Segment> =>
      styles.reduce((styled, style) => Segment.applyStyle(styled, style), segments);

    // The common default end is "\n" — reuse Segment's cached newline rather
    // than allocating one per print; only a non-default end needs a fresh one.
    const terminator = end === "\n" ? Segment.line() : new Segment(end);
    const align = PLACED_BY[opts.justify ?? "default"];

    // Each block as its lines, and whether its last line is closed. A placed
    // block is closed line by line, as `Align` closes it. Unplaced, a text run
    // is closed exactly where its content — its `end` included — breaks; any
    // other block's lines are closed whether or not it closed them itself: a
    // `Panel` ends in a line break and a bare `ProgressBar` does not (a line
    // fragment — test/seam/line-ends.ts), and both leave the next print at the
    // start of a line.
    const drawBlock = (block: PrintBlock): { lines: Segment[][]; closed: boolean } => {
      const renderable = block.kind === "text" ? new TextRun(block.items, terminator) : block.renderable;
      if (align) return { lines: placeBlock(renderable, align, renderOpts), closed: true };
      const drawn = [...renderable.render(renderOpts)];
      // A text run's last segment is always its `end`, yielded even when
      // empty, and `splitLines` drops the empty line after a final break only
      // when nothing follows it — so the run is closed exactly when `end` is.
      const closed = block.kind === "lines" || end.endsWith("\n");
      return { lines: Segment.splitLines(drawn), closed };
    };

    // Every line end goes through the same writeSegments funnel as the text it
    // ends, so it survives recording — otherwise `exportText` and `exportHtml`
    // would join consecutive prints onto a single line. [LAW:single-enforcer]
    // A block left open carries on along the next block's first line, so the
    // rows are read off the joined output rather than counted per block.
    const output: Segment[] = [];
    let closed = true;
    for (const block of blocks) {
      const drawn = drawBlock(block);
      drawn.lines.forEach((line, index) => {
        output.push(...styleContent(line));
        if (drawn.closed || index < drawn.lines.length - 1) output.push(Segment.line());
      });
      closed = drawn.closed;
    }

    // Soft wrap turns cropping off whatever `crop` says, because a line it left
    // whole is meant to reach the terminal whole. [LAW:dataflow-not-control-flow]
    // Not cropping is an unbounded width rather than a skipped step — the same
    // spelling `RichText` uses for `"ignore"`.
    const cropWidth = !softWrap && (opts.crop ?? true) ? options.maxWidth : Infinity;
    return { rows: Segment.splitLines(output), closed, cropWidth };
  }

  // The reference's `LogRender`: a grid row of two cells, the time and beside it
  // whatever `print` would draw for `args` in the width that is left. A grid row
  // is at least one line tall and always closed, whatever `end` left open
  // inside its cell. The time gives up cells before the content does, so a
  // console narrower than the time still shows every argument. The time takes
  // the console's style alone, as the reference styles only the renderables.
  log(...args: unknown[]): void {
    const options = this.options;
    const time = new RichText(`[${new Date().toLocaleTimeString(undefined, LOG_TIME)}] `, { end: "" });
    time.stylize("log.time");
    const width = Math.min(time.cellLength, options.maxWidth - 1);
    const { rows, cropWidth } = this._draw(args, { ...options, maxWidth: options.maxWidth - width });
    const [stampLine = []] = Segment.splitLines(time.render({ ...options, maxWidth: time.cellLength }));
    const styled = (cell: Segment[]): Segment[] => [...Segment.applyStyle(cell, this._style)];
    const stamp = styled(Segment.adjustLineLength(stampLine, width));
    const blank = styled([new Segment(" ".repeat(width))]);
    const grid = Array.from({ length: Math.max(1, rows.length) }, (_, index) => [
      ...(index === 0 ? stamp : blank),
      ...(rows[index] ?? []),
    ]);
    // The row is the column wider than its cell; an uncropped cell stays so.
    this._writeSegments(emit({ rows: grid, closed: true, cropWidth: cropWidth + width }));
  }

  // [LAW:one-source-of-truth] `RuleOptions` is `Rule`'s, not a restatement of
  // it. `console.ts` used to declare its own copy and field-by-field forward
  // into this constructor, which made a second map of one shape — identical
  // then, free to drift the moment `Rule` grew an option.
  rule(title?: string, options?: RuleOptions): void {
    const segments = [...new Rule(title, options).render(this.options)];
    this._writeSegments(segments);
  }

  // [LAW:one-source-of-truth] `JSONRenderable` is the one formatter for JSON and
  // `JSONOptions` is its option set; this method only picks the constructor. It
  // prints with soft wrap, as the reference does, so a line wider than the
  // console reaches the terminal whole and the output stays valid JSON.
  printJson(json: string | object, options?: JSONOptions): void {
    const renderable = typeof json === "string"
      ? JSONRenderable.fromString(json, options)
      : JSONRenderable.fromData(json, options);
    this.print(renderable, { softWrap: true });
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

  // [LAW:single-enforcer] `encodeHtml` draws the picture `exportLines`
  // resolves; nothing here interprets a `Style`.
  exportHtml({ theme, clear = true }: { theme?: TerminalTheme; clear?: boolean } = {}): string {
    const html = encodeHtml(this._recorded, theme);
    if (clear) this._recorded = [];
    return html;
  }

  // [LAW:single-enforcer] As `exportHtml`: `encodeSvg` draws, this clears.
  exportSvg({ theme, title = "Rich", clear = true }: { theme?: TerminalTheme; title?: string; clear?: boolean } = {}): string {
    const svg = encodeSvg(this._recorded, { theme, title, width: this.width });
    if (clear) this._recorded = [];
    return svg;
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
    const encoded = segmentsToString(segments, this._destination);
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

