/**
 * Console — the central orchestrator for rendering styled output to the terminal.
 */

import { writeFileSync } from "fs";
import { Segment } from "./segment.js";
import { Style, NULL_STYLE, Theme } from "./style.js";
import { ColorDepth, resolveColorSystem } from "./color.js";
import type { ColorSystemSpec } from "./color.js";
import { RichText } from "./text.js";
import { render as renderMarkup } from "./markup.js";
import { ReprHighlighter } from "./highlighter.js";
import type { Highlighter } from "./highlighter.js";
import { Rule } from "../renderables/rule.js";
import { segmentToString } from "./render.js";
import type {
  Renderable,
  RenderOptions,
} from "./protocol.js";
import { isRenderable } from "./protocol.js";

// --- Types ---

export interface ConsoleOptions {
  /**
   * Color encoding. Accepts a `ColorSystemSpec` string (`"auto"`, `"truecolor"`,
   * `"256"`, `"ansi"`, `"none"`), a `ColorDepth` enum value (use this for
   * `WINDOWS`, which has no string spec), or `null` for no color. Default `"auto"`.
   */
  colorSystem?: ColorSystemSpec | ColorDepth | null;
  width?: number;
  height?: number;
  style?: string | Style;
  forceTerminal?: boolean;
  forceInteractive?: boolean;
  stderr?: boolean;
  file?: NodeJS.WritableStream;
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

export interface RuleOptions {
  style?: string | Style;
  align?: "left" | "center" | "right";
  characters?: string;
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
// [LAW:dataflow-not-control-flow] `isTTY` is forwarded unconditionally;
// `resolveColorSystem` ignores it for non-`"auto"` specs. Caller must compute
// the effective TTY status of the actual output target (stdout/stderr/file)
// so `"auto"` detection doesn't accidentally consult `process.stdout.isTTY`
// when the console is bound to a different stream.
function resolveOptionColorSystem(
  spec: ColorSystemSpec | ColorDepth | null | undefined,
  isTTY: boolean,
): ColorDepth | null {
  if (spec === null) return null;
  if (spec === undefined) return resolveColorSystem("auto", { isTTY });
  if (typeof spec === "string") return resolveColorSystem(spec, { isTTY });
  return spec;
}

// [LAW:single-enforcer] Effective TTY status of the console's output target
// is computed once, here, from the options that determine the target. Mirrors
// the `isTerminal` getter so the cached `_colorSystem` and runtime
// `isTerminal` agree on what counts as a TTY.
function effectiveIsTTY(options?: ConsoleOptions): boolean {
  if (options?.forceTerminal) return true;
  if (options?.file) return false;
  if (typeof process === "undefined") return false;
  return (options?.stderr ? process.stderr : process.stdout)?.isTTY ?? false;
}

function getTerminalSize(): { width: number; height: number } {
  if (typeof process !== "undefined") {
    const cols = process.env?.["COLUMNS"];
    const lines = process.env?.["LINES"];
    const w = cols ? parseInt(cols, 10) : (process.stdout?.columns ?? 80);
    const h = lines ? parseInt(lines, 10) : (process.stdout?.rows ?? 24);
    return { width: w || 80, height: h || 24 };
  }
  return { width: 80, height: 24 };
}

// --- Console ---

export class Console {
  private _colorSystem: ColorDepth | null;
  private _width: number | undefined;
  private _height: number | undefined;
  private _style: Style;
  private _forceTerminal: boolean;
  private _forceInteractive: boolean | undefined;
  private _file: NodeJS.WritableStream | undefined;
  private _stderr: boolean;
  private _record: boolean;
  private _markup: boolean;
  private _highlight: boolean;
  private _theme: Theme;
  private _highlighter: Highlighter;
  private _recorded: Segment[];
  private _buffer: string;

  constructor(options?: ConsoleOptions) {
    this._colorSystem = resolveOptionColorSystem(
      options?.colorSystem,
      effectiveIsTTY(options),
    );
    this._width = options?.width;
    this._height = options?.height;
    this._style = resolveStyle(options?.style);
    this._forceTerminal = options?.forceTerminal ?? false;
    this._forceInteractive = options?.forceInteractive;
    this._file = options?.file;
    this._stderr = options?.stderr ?? false;
    this._record = options?.record ?? false;
    this._markup = options?.markup !== false;
    this._highlight = options?.highlight !== false;
    this._theme = options?.theme ?? new Theme();
    this._highlighter = options?.highlighter ?? new ReprHighlighter();
    this._recorded = [];
    this._buffer = "";
  }

  // --- Properties ---

  get size(): { width: number; height: number } {
    const term = getTerminalSize();
    return {
      width: this._width ?? term.width,
      height: this._height ?? term.height,
    };
  }

  get width(): number {
    return this._width ?? getTerminalSize().width;
  }

  get height(): number {
    return this._height ?? getTerminalSize().height;
  }

  get encoding(): string {
    return "utf-8";
  }

  get isTerminal(): boolean {
    if (this._forceTerminal) return true;
    if (this._file) return false;
    if (typeof process !== "undefined") {
      return (this._stderr ? process.stderr : process.stdout)?.isTTY ?? false;
    }
    return false;
  }

  get isInteractive(): boolean {
    if (this._forceInteractive !== undefined) return this._forceInteractive;
    return this.isTerminal;
  }

  get colorSystem(): ColorDepth | null {
    return this._colorSystem;
  }

  // [LAW:one-source-of-truth] Output target lookup matches _renderSegment's:
  // explicit `file` wins, otherwise stderr/stdout per the _stderr flag. Exposed
  // so renderables that bypass the segment pipeline (e.g. Live's raw control
  // sequences) still write to the caller's configured stream.
  get file(): NodeJS.WritableStream {
    return this._file ?? (this._stderr ? process.stderr : process.stdout);
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

    // Output
    this._writeSegments(final);
    if (end) this._write(end);
  }

  log(...args: unknown[]): void {
    // Simple log implementation — adds timestamp
    const now = new Date();
    const time = now.toLocaleTimeString();
    const timeText = new RichText(`[${time}] `, { end: "" });
    timeText.stylize("log.time");

    this.print(timeText, ...args);
  }

  rule(title?: string, options?: RuleOptions): void {
    const rule = new Rule(title, {
      characters: options?.characters,
      align: options?.align,
      style: options?.style,
    });
    const segments = [...rule.render(this.options)];
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

  beginCapture(): void {
    this._buffer = "";
  }

  endCapture(): string {
    const result = this._buffer;
    this._buffer = "";
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

  saveText(path: string, options?: { clear?: boolean }): void {
    writeFileSync(path, this.exportText(options), "utf-8");
  }

  saveHtml(path: string, options?: { clear?: boolean }): void {
    writeFileSync(path, this.exportHtml(options), "utf-8");
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

  private _writeSegments(segments: Segment[]): void {
    for (const segment of segments) {
      if (segment.isControl) continue;
      const text = this._renderSegment(segment);
      this._write(text);
      if (this._record) {
        this._recorded.push(segment);
      }
    }
  }

  // [LAW:single-enforcer] Defers to the same Segment-to-ANSI encoder used by
  // `renderToString`, so terminal output and string export agree by
  // construction.
  private _renderSegment(segment: Segment): string {
    return segmentToString(segment, this._colorSystem);
  }

  private _write(text: string): void {
    if (this._buffer !== undefined && this._buffer !== "") {
      this._buffer += text;
    }

    const target = this._file ?? (this._stderr ? process.stderr : process.stdout);
    target.write(text);
  }
}

