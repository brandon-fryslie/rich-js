/**
 * RichText — styled text with spans. The primary text type for the library.
 */

import { cellLen, cellCount, cellFit, cellFitEnd, cellFitFrom, graphemes, asCellCol, asCodePoint, expandTabs, parseTabSize, type CellCol, type TabSize } from "./cells.js";
import { closed, closing, isBidi, openersAlong } from "./bidi.js";
import { controlClass, dispositionOf, pictureOf } from "./control-codes.js";
import { reorder, drawnTail, edges, hangingCells, hangingWhitespace, measured, paragraphLevelOf, removes } from "./orient.js";
import { divideLine, wordWidths, type LineBreak } from "./wrap.js";
import { Segment } from "./segment.js";
import { Style, NULL_STYLE, StyleSyntaxError, type TextStyle } from "./style.js";
import { stripUrlControls } from "./osc8.js";
import { betweenPasses, drawable, getStyle, withBoundedWidth } from "./protocol.js";
import type { Renderable, Measurable, OverflowMethod, RenderOptions } from "./protocol.js";
import { pattern } from "./pattern.js";
import { ListState, State } from "./state.js";
import type { ParagraphLevel, TextOrder } from "./text-order.js";

const STRIPPED = pattern(new RegExp(controlClass((disposition) => disposition === "strip"), "u"));
const STOOD_IN_FOR = pattern(new RegExp(controlClass((disposition) => disposition === "line-break" || disposition === "pictured"), "u"));

/** What content holds in place of a `line-break` or `pictured` code point. */
function standIn(character: string): string {
  const codePoint = character.codePointAt(0)!;
  return dispositionOf(codePoint) === "pictured" ? pictureOf(codePoint) : "\n";
}

// `text` without its `strip` code points, all that `sanitized` deletes.
// [LAW:single-enforcer] Single place where control chars are sanitized: every
// string that becomes part of a Text's characters passes through `sanitized`.
// Which ones, and why, is `CONTROL_CODES`. A code point at a time and never by its
// neighbours, because it runs again on every slice and fragment: what depends on
// context is `wireText`'s. `match` and `split` need no cursor, so `STRIPPED` can
// be held. `match` first because nearly every string is clean, and not `test`,
// which coerces: a template's unlifted scope value reaches here typed as a
// string, and has to throw rather than read as `[object Object]`.
export function stripControlChars(text: string): string {
  return text.match(STRIPPED) === null ? text : text.split(STRIPPED).join("");
}

/**
 * `text` as a Text's characters hold it: stripped, every line ending an LF, and
 * every control its picture. One code unit for one, so an offset into stripped
 * text holds, and every reader of a Text finds one line break without having to
 * know the others.
 */
export function sanitized(text: string): string {
  const stripped = stripControlChars(text);
  return stripped.match(STOOD_IN_FOR) === null ? stripped : stripped.replace(new RegExp(STOOD_IN_FOR.source, "gu"), standIn);
}

// [LAW:single-enforcer] RichText is the data-model trust boundary for link
// URLs: a `Style` is sanitized as it enters (`admitStyle`), and the `Style` a
// stored string resolves to is sanitized as it leaves for a render
// (`resolveStyle`). Wire-byte safety is enforced separately by `osc8Open`
// (core/osc8.ts), which every link producer calls and which applies the same
// `stripUrlControls`.
function sanitizeStyleLink(style: Style): Style {
  const link = style.link;
  if (!link) return style;
  const cleaned = stripUrlControls(link);
  if (cleaned === link) return style;
  return style.withLink(cleaned);
}

/**
 * A style as a RichText keeps it: as given. A name stays a name because what
 * it stands for depends on the theme of the render that draws it, which no
 * RichText knows when the name arrives — the reference stores span styles the
 * same way. A string holds no link until it is parsed, so only a `Style` —
 * alone or laid over a name — has one to sanitize here.
 *
 * [LAW:single-enforcer] Nor does a RichText keep an anchor (`./anchor.ts`). It
 * lays its text out anew, so a stamp naming where a cell sat in the output it
 * came from would name the wrong cell once it wraps, slices or overlaps; the
 * owner that renders the RichText is the one that stamps its cells. A
 * hold stays — `validFrom` and `validUntil`: when a span's cells began and
 * next change is true of them wherever the text lays them, so a frame
 * appended into a line still says when it turns.
 */
function admitStyle(style: TextStyle): TextStyle {
  if (typeof style === "string") return style;
  if (style instanceof Style) return admitDefined(style);
  return { under: style.under, over: admitDefined(style.over) };
}

function admitDefined(style: Style): Style {
  return sanitizeStyleLink(style.anchor ? style.withAnchor(undefined) : style);
}

/** A style that adds nothing: the empty definition, or a null `Style`. */
function isEmptyStyle(style: TextStyle): boolean {
  return style instanceof Style ? style.isNull : style === "";
}

/**
 * The style a stored `TextStyle` stands for in this render.
 *
 * A parsed string can carry a link, so the result is sanitized on the way out
 * as well.
 */
export function resolveStyle(options: RenderOptions, style: TextStyle): Style {
  const resolved =
    style instanceof Style ? style
    : typeof style === "string" ? resolveDefinition(options, style)
    : resolveDefinition(options, style.under).add(style.over);
  return sanitizeStyleLink(resolved);
}

/**
 * [LAW:single-enforcer] Styling is non-critical — an unrecognized style name
 * (typo, missing theme key, bad concatenation) degrades to unstyled rather
 * than crashing, as the reference's `Text.render` resolves with a null
 * default. Absorb only StyleSyntaxError here; other errors are genuine bugs
 * and must surface. The render's `onStyleError` hears about each one first,
 * and a handler that throws turns the degrade into a failure.
 */
function resolveDefinition(options: RenderOptions, style: string): Style {
  try {
    return getStyle(options, style);
  } catch (err) {
    if (!(err instanceof StyleSyntaxError)) throw err;
    betweenPasses(() => options.onStyleError?.(err, style));
    return NULL_STYLE;
  }
}

// --- Span ---

export class Span {
  readonly start: number;
  readonly end: number;
  readonly style: TextStyle;

  constructor(start: number, end: number, style: TextStyle) {
    this.start = start;
    this.end = end;
    this.style = style;
  }

  get hasLength(): boolean {
    return this.end > this.start;
  }

  toString(): string {
    return `Span(${this.start}, ${this.end})`;
  }

  split(offset: number): [Span, Span | undefined] {
    if (offset <= this.start || offset >= this.end) return [this, undefined];
    return [
      new Span(this.start, offset, this.style),
      new Span(offset, this.end, this.style),
    ];
  }

  move(delta: number): Span {
    return new Span(this.start + delta, this.end + delta, this.style);
  }

  rightCrop(offset: number): Span {
    if (offset >= this.end) return this;
    return new Span(this.start, Math.min(this.end, offset), this.style);
  }

  extend(count: number): Span {
    return new Span(this.start, this.end + count, this.style);
  }
}

// --- RichText ---

export interface RichTextOptions {
  style?: TextStyle;
  justify?: "left" | "center" | "right" | "full";
  overflow?: OverflowMethod;
  end?: string;
  tabSize?: number;
  noWrap?: boolean;
  /**
   * The paragraph's direction, UAX #9's P3: stated, it decides what the first
   * strong character would. A row `wrap` cut from a bidi line carries its
   * line's, which the row alone cannot find again.
   */
  direction?: Direction;
}

/** A paragraph's direction, as HTML's `dir` states one. */
export type Direction = "ltr" | "rtl";

const LEVEL_OF: Readonly<Record<Direction, ParagraphLevel>> = { ltr: 0, rtl: 1 };
const DIRECTION_OF: readonly [Direction, Direction] = ["ltr", "rtl"];

/**
 * What `wrap` takes: the render's options in an order where a row is a
 * `RichText`. Under `visual` a row is laid out by levels resolved over its whole
 * line — trimmed, placed and stamped by them — so no text cut from it draws
 * that row alone, and the type refuses the order rather than return rows that
 * would not.
 */
export type WrapOptions = RenderOptions & { readonly textOrder?: "plain" | "logical" };

/** What a `RichText` says about how it is drawn, as Rich's `Text` lets a caller change it after construction. */
interface TextFormat {
  readonly style: TextStyle;
  readonly justify: "left" | "center" | "right" | "full" | undefined;
  readonly overflow: OverflowMethod | undefined;
  readonly end: string;
  readonly noWrap: boolean;
  readonly direction: Direction | undefined;
}

export class RichText implements Renderable, Measurable {
  // Rich's `Text` is changed in place — appended to, stylized, padded — so its
  // characters, spans and format are state, and a write to one while
  // something is drawn throws. Four holders rather than one per field: a
  // `RichText` is the most-made object in the library.
  private readonly _text: State<string>;
  private readonly _spans = new ListState<Span>();
  // What `append` has added to `text` since it last closed it, so closing reads
  // no more than that. Any other write leaves `text` naming an older string, and
  // the whole is read instead.
  private readonly _closure = new State<{ readonly text: string; readonly tail: string }>({ text: "", tail: "" });
  private readonly _format: State<TextFormat>;
  private readonly _tabSize: TabSize;

  constructor(text?: string, options?: RichTextOptions) {
    this._text = new State(text ? sanitized(text) : "");
    this._format = new State<TextFormat>({
      // [LAW:single-enforcer] `admitStyle` is the boundary that sanitizes
      // any link URL crossing into a RichText; downstream trusts the invariant.
      style: admitStyle(options?.style ?? NULL_STYLE),
      justify: options?.justify,
      overflow: options?.overflow,
      end: options?.end ?? "\n",
      noWrap: options?.noWrap ?? false,
      direction: options?.direction,
    });
    this._tabSize = parseTabSize(options?.tabSize ?? 8);
  }

  /** The part of the text whose direction state nothing has closed. */
  private _unclosed(): string {
    const text = this._text.get();
    const closure = this._closure.get();
    return closure.text === text ? closure.tail : text;
  }

  /** The paragraph level this text states, if it states one. */
  private _level(): ParagraphLevel | undefined {
    const direction = this._format.get().direction;
    return direction === undefined ? undefined : LEVEL_OF[direction];
  }

  private _reformat(change: Partial<TextFormat>): void {
    this._format.set({ ...this._format.get(), ...change });
  }

  // --- Properties ---

  get plain(): string {
    return this._text.get();
  }

  set plain(value: string) {
    const clean = sanitized(value);
    this._text.set(clean);
    // Trim spans that extend beyond new length
    const len = clean.length;
    this._spans.set(this._spans.get()
      .map((s) => (s.end > len ? new Span(s.start, Math.min(s.end, len), s.style) : s))
      .filter((s) => s.start < len));
  }

  get length(): number {
    return this._text.get().length;
  }

  /**
   * The cells of the plain text with each tab widened to its stop counted from
   * this text's own column 0, as `render` widens it — so it is the drawn width
   * of a one-line text set at a stop. A deliberate departure from Rich, whose
   * `Text.cell_len` counts a tab as no cells, so everything sized by it — a
   * truncation, an alignment, a header's remaining width — decided on a width
   * no render draws.
   */
  get cellLength(): number {
    return cellLen(expandTabs(this._text.get(), this._tabSize).text);
  }

  get hasContent(): boolean {
    return this._text.get().length > 0;
  }

  /** The base style every span layers over, resolved at render unless it is a `Style`. */
  get style(): TextStyle {
    return this._format.get().style;
  }

  set style(value: TextStyle) {
    this._reformat({ style: admitStyle(value) });
  }

  get justify(): "left" | "center" | "right" | "full" | undefined {
    return this._format.get().justify;
  }

  set justify(value: "left" | "center" | "right" | "full" | undefined) {
    this._reformat({ justify: value });
  }

  get overflow(): OverflowMethod | undefined {
    return this._format.get().overflow;
  }

  set overflow(value: OverflowMethod | undefined) {
    this._reformat({ overflow: value });
  }

  get end(): string {
    return this._format.get().end;
  }

  set end(value: string) {
    this._reformat({ end: value });
  }

  get noWrap(): boolean {
    return this._format.get().noWrap;
  }

  set noWrap(value: boolean) {
    this._reformat({ noWrap: value });
  }

  get direction(): Direction | undefined {
    return this._format.get().direction;
  }

  set direction(value: Direction | undefined) {
    this._reformat({ direction: value });
  }

  get spans(): readonly Span[] {
    return this._spans.get();
  }

  /**
   * This text's own style, spans aside, as the render drawing it resolves it.
   * A name the render's theme does not define resolves to no style, because
   * text forgives a missing name.
   */
  resolvedStyle(options: RenderOptions): Style {
    return resolveStyle(options, this._format.get().style);
  }

  /**
   * The style of the cell-column at the named edge — base style merged with
   * any spans covering the leftmost (side="left") or rightmost (side="right")
   * character.
   *
   * [LAW:locality-or-seam] Used by `Separator`s to paint the transition between
   * adjacent `Strip` items. Separators only ever need the column adjacent to
   * them, so the cell type exposes that column rather than constraining its
   * interior to be uniform. For RichText with uniform styling, both edges
   * return the same style; for RichText with edge variation, each edge
   * accurately reports the column the joiner actually meets.
   *
   * Position is by character index (not cell column). For wide-character
   * text, the last character occupies the rightmost cell column — the bg
   * of that character covers both columns, so character-index lookup gives
   * the correct edge color.
   *
   * Takes the render's options because the edge is reported as it will be
   * drawn, and a style name draws as whatever the render's theme says.
   */
  edgeStyle(side: "left" | "right", options: RenderOptions): Style {
    const base = this.resolvedStyle(options);
    if (this._text.get().length === 0) return base;
    const shown = edges(this._text.get(), options.textOrder ?? "plain", this._level());
    const pos = side === "left" ? shown.left : shown.right;
    let result = base;
    for (const span of this._spans.get()) {
      if (span.start <= pos && pos < span.end) {
        result = result.add(resolveStyle(options, span.style));
      }
    }
    return result;
  }

  // --- Content Operations ---

  append(content: string | RichText, style?: TextStyle): this {
    if (content instanceof RichText) {
      if (style !== undefined) {
        throw new Error("Style argument must not be provided when appending RichText");
      }
      // [LAW:single-enforcer] Reached only when separate Texts are set on one
      // line, so here direction state ends with the content holding it. The
      // string arm below builds one content, and an embedding spans it.
      const own = this._text.get() + closing(this._unclosed());
      const offset = own.length;
      // Read before anything is appended, so a text appended to itself takes its spans as they were.
      const moved = content._spans.get().map((span) => span.move(offset));
      this._text.set(own + closed(content._text.get()));
      this._closure.set({ text: this._text.get(), tail: "" });
      // Its base style becomes a span under its own spans, as the reference's
      // `append` does, so appended text looks as it did alone.
      this._addSpan(offset, this._text.get().length, content._format.get().style);
      for (const span of moved) this._spans.push(span);
      return this;
    }

    const clean = sanitized(content);
    const start = this._text.get().length;
    const tail = this._unclosed() + clean;
    this._text.set(this._text.get() + clean);
    this._closure.set({ text: this._text.get(), tail });
    this._addSpan(start, this._text.get().length, style ?? "");
    return this;
  }

  contains(needle: string | RichText): boolean {
    const searchText = needle instanceof RichText ? needle._text.get() : needle;
    return this._text.get().includes(searchText);
  }

  at(index: number): RichText {
    const resolved = index < 0 ? this._text.get().length + index : index;
    const char = this._text.get()[resolved];
    if (char === undefined) return new RichText("");
    return this.slice(resolved, resolved + 1);
  }

  slice(start?: number, end?: number): RichText {
    const text = this._text.get();
    const len = text.length;
    const s = start ?? 0;
    const e = end ?? len;
    const resolvedStart = s < 0 ? Math.max(0, len + s) : Math.min(s, len);
    const resolvedEnd = e < 0 ? Math.max(0, len + e) : Math.min(e, len);

    if (resolvedStart >= resolvedEnd) {
      return this.blankCopy();
    }

    const slicedText = text.slice(resolvedStart, resolvedEnd);
    const result = this.blankCopy(slicedText);

    for (const span of this._spans.get()) {
      const spanStart = Math.max(span.start, resolvedStart) - resolvedStart;
      const spanEnd = Math.min(span.end, resolvedEnd) - resolvedStart;
      if (spanStart < spanEnd) {
        result._spans.push(new Span(spanStart, spanEnd, span.style));
      }
    }

    return result;
  }

  // --- Styling Operations ---

  /**
   * The one way a span enters this text. [LAW:single-enforcer] An empty style
   * adds nothing, as the reference's `if style:` has it, and every other style
   * is admitted as given.
   */
  private _addSpan(start: number, end: number, style: TextStyle): void {
    const admitted = admitStyle(style);
    if (isEmptyStyle(admitted)) return;
    this._spans.push(new Span(start, end, admitted));
  }

  stylize(style: TextStyle, start?: number, end?: number): this {
    const len = this._text.get().length;
    const s = start !== undefined ? (start < 0 ? len + start : start) : 0;
    const e = end !== undefined ? (end < 0 ? len + end : end) : len;

    if (s >= e || s >= len || e <= 0) return this;
    const clampedStart = Math.max(0, s);
    const clampedEnd = Math.min(len, e);

    this._addSpan(clampedStart, clampedEnd, style);
    return this;
  }

  highlightRegex(pattern: RegExp, style?: TextStyle): number {
    const text = this._text.get();
    let count = 0;

    // Ensure global flag
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const re = new RegExp(pattern.source, flags);

    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex++;
        continue;
      }

      // Named capture groups are applied as style names
      if (match.groups) {
        let searchFrom = 0;
        for (const [groupName, groupValue] of Object.entries(match.groups)) {
          if (groupValue !== undefined) {
            const posInMatch = match[0].indexOf(groupValue, searchFrom);
            if (posInMatch >= 0) {
              const groupStart = match.index + posInMatch;
              this._addSpan(groupStart, groupStart + groupValue.length, groupName);
              searchFrom = posInMatch + groupValue.length;
            }
          }
        }
        count++;
        continue;
      }

      this._addSpan(match.index, match.index + match[0].length, style ?? "");
      count++;
    }

    return count;
  }

  highlightWords(
    words: string[],
    style: TextStyle,
    options?: { caseSensitive?: boolean },
  ): number {
    const caseSensitive = options?.caseSensitive !== false;

    let count = 0;
    for (const word of words) {
      if (word.length === 0) continue;
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = caseSensitive ? "g" : "gi";
      const re = new RegExp(`\\b${escaped}\\b`, flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(this._text.get())) !== null) {
        this._addSpan(match.index, match.index + match[0].length, style);
        count++;
      }
    }

    return count;
  }

  // --- Copy Operations ---

  copy(): RichText {
    const result = this.blankCopy(this._text.get());
    result._spans.set(this._spans.get());
    return result;
  }

  blankCopy(text?: string): RichText {
    return new RichText(text ?? "", { ...this._format.get(), tabSize: this._tabSize });
  }

  // --- Splitting ---

  split(separator?: string): RichText[] {
    const sep = separator ?? "\n";
    const text = this._text.get();
    const parts: RichText[] = [];
    let start = 0;

    while (true) {
      const idx = text.indexOf(sep, start);
      if (idx === -1) {
        parts.push(this.slice(start));
        break;
      }
      parts.push(this.slice(start, idx));
      start = idx + sep.length;
    }

    return parts;
  }

  divide(offsets: number[]): RichText[] {
    if (offsets.length === 0) return [this.copy()];

    const parts: RichText[] = [];
    let prev = 0;
    for (const offset of offsets) {
      parts.push(this.slice(prev, offset));
      prev = offset;
    }
    parts.push(this.slice(prev));
    return parts;
  }

  // --- Whitespace Operations ---

  rstrip(): this {
    const trimmed = this._text.get().replace(/\s+$/, "");
    if (trimmed.length < this._text.get().length) {
      this.plain = trimmed;
    }
    return this;
  }

  pad(count: number, char?: string): this {
    const padding = sanitized(char ?? " ").repeat(count);
    // Shift all spans right by what the left side gained.
    this._spans.set(this._spans.get().map((s) => s.move(padding.length)));
    this._text.set(padding + this._text.get() + padding);
    return this;
  }

  /**
   * Each tab widened to the next tab stop, in place, as Rich's
   * `Text.expand_tabs` widens it: spans move with the characters they style, so
   * the text measures what it will draw.
   */
  expandTabs(): this {
    const expanded = expandTabs(this._text.get(), this._tabSize);
    this._spans.set(this._spans.get().map(
      (s) => new Span(expanded.offsetOf(s.start), expanded.offsetOf(s.end), s.style),
    ));
    this._text.set(expanded.text);
    return this;
  }

  padLeft(count: number, char?: string): this {
    const padding = sanitized(char ?? " ").repeat(count);
    this._spans.set(this._spans.get().map((s) => s.move(padding.length)));
    this._text.set(padding + this._text.get());
    return this;
  }

  padRight(count: number, char?: string): this {
    this._text.set(this._text.get() + sanitized(char ?? " ").repeat(count));
    return this;
  }

  setLength(length: number): this {
    if (this._text.get().length < length) {
      this._text.set(this._text.get() + " ".repeat(length - this._text.get().length));
    } else if (this._text.get().length > length) {
      this.plain = this._text.get().slice(0, length);
    }
    return this;
  }

  extendStyle(count: number): this {
    const oldLen = this._text.get().length;
    this._text.set(this._text.get() + " ".repeat(count));
    // Extend existing spans to cover new spaces
    this._spans.set(this._spans.get().map((s) =>
      s.end === oldLen ? s.extend(count) : s,
    ));
    return this;
  }

  // --- Truncation ---

  /**
   * Truncate to a fixed cell-column width, in one of three modes.
   *
   * - `mode: "right"` (default) \u2014 drop characters from the right; append
   *   `marker` (if any) at the cut.
   * - `mode: "left"` \u2014 drop characters from the left; prepend `marker` at
   *   the cut.
   * - `mode: "middle"` \u2014 keep equal halves from both ends; place `marker`
   *   in the middle.
   *
   * Marker default is `"\u2026"`. Pass `marker: ""` for raw cropping without an
   * indicator glyph. A marker wider than `width` is itself cut to the glyphs
   * that fit, and the text takes whatever cells that leaves — all of them, when
   * not one glyph of the marker fits — so the result is never wider than asked.
   * Every cut, marker and text alike, falls between grapheme clusters.
   *
   * Spans are preserved through the cut: characters that survive keep their
   * styling; the marker (if any) is inserted as plain text with no span.
   * Use `stylize(...)` on the result to color the marker if needed.
   *
   * Text that fits comes back untouched. Text that is cut has its tabs widened
   * to their stops first, as `expandTabs` widens them, so the width cut to is
   * the width drawn.
   *
   * [LAW:dataflow-not-control-flow] mode/marker/width all flow as values;
   * the walk is the same shape regardless. No "if truncated then rebuild"
   * branch \u2014 the unchanged path just early-returns when content fits.
   */
  truncate(
    width: number,
    options?: {
      mode?: "right" | "left" | "middle";
      marker?: string;
    },
  ): this {
    if (this.cellLength <= width) return this;
    // [LAW:one-source-of-truth] Cut what is drawn: once a tab is spaces, a cell
    // of the plain text is a cell of the output, so the cut lands where it looks.
    this.expandTabs();

    const mode = options?.mode ?? "right";
    // [LAW:dataflow-not-control-flow] the marker is fitted to the width as a
    // value, so width 0 and a marker wider than the width run the same walk
    // as every other call: what is drawn plus what is kept is `cells` wide.
    const cells = cellCount(width);
    const marker = cellFit(sanitized(options?.marker ?? "\u2026"), cells);
    const budget = asCellCol(cells - cellLen(marker));

    if (mode === "right") {
      this._cropRightTo(budget);
      if (marker) this._text.set(this._text.get() + marker);
      return this;
    }

    if (mode === "left") {
      this._cropLeftTo(budget);
      if (marker) {
        this._spans.set(this._spans.get().map((s) => s.move(marker.length)));
        this._text.set(marker + this._text.get());
      }
      return this;
    }

    // middle
    const leftBudget = asCellCol(Math.floor(budget / 2));
    const rightBudget = asCellCol(budget - leftBudget);
    // Find the char-index ranges to keep from each side.
    const leftEndCharIdx = cellFit(this._text.get(), leftBudget).length;
    const rightStartCharIdx = this._text.get().length - cellFitEnd(this._text.get(), rightBudget).length;
    const leftText = this._text.get().slice(0, leftEndCharIdx);
    const rightText = this._text.get().slice(rightStartCharIdx);
    const droppedStart = leftEndCharIdx;
    const droppedEnd = rightStartCharIdx;
    const shift = marker.length - (droppedEnd - droppedStart);
    // Spans falling entirely before the drop stay; entirely after shift by
    // (marker.length - dropped chars); spans crossing the drop are clipped.
    const newSpans: Span[] = [];
    for (const s of this._spans.get()) {
      if (s.end <= droppedStart) {
        newSpans.push(s);
      } else if (s.start >= droppedEnd) {
        newSpans.push(s.move(shift));
      } else {
        // crosses \u2014 clip to left side and to right side as two spans
        if (s.start < droppedStart) {
          newSpans.push(new Span(s.start, droppedStart, s.style));
        }
        if (s.end > droppedEnd) {
          newSpans.push(new Span(droppedEnd + shift, s.end + shift, s.style));
        }
      }
    }
    this._text.set(leftText + marker + rightText);
    this._spans.set(newSpans);
    return this;
  }

  private _cropRightTo(targetWidth: CellCol): void {
    this.plain = cellFit(this._text.get(), targetWidth);
  }

  private _cropLeftTo(targetWidth: CellCol): void {
    const charIdx = this._text.get().length - cellFitEnd(this._text.get(), targetWidth).length;
    // Shift spans left by charIdx; clip spans that started before.
    const shift = -charIdx;
    this._spans.set(this._spans.get()
      .map((s) => {
        if (s.end <= charIdx) return undefined;
        const newStart = Math.max(0, s.start + shift);
        const newEnd = s.end + shift;
        return new Span(newStart, newEnd, s.style);
      })
      .filter((s): s is Span => s !== undefined));
    this._text.set(this._text.get().slice(charIdx));
  }

  // --- Alignment ---

  align(justify: "left" | "center" | "right", width: number): this {
    const currentWidth = this.cellLength;
    if (currentWidth >= width) return this;
    // Padded to `width`, the text claims that width only while its tab stops
    // hold: widened now, padding on either side cannot move them.
    this.expandTabs();

    const gap = width - currentWidth;
    switch (justify) {
      case "left":
        this.padRight(gap);
        break;
      case "right":
        this.padLeft(gap);
        break;
      case "center": {
        const leftPad = Math.floor(gap / 2);
        const rightPad = gap - leftPad;
        this.padLeft(leftPad);
        this.padRight(rightPad);
        break;
      }
    }

    return this;
  }

  // --- Suffix Removal ---

  removeSuffix(suffix: string): this {
    if (this._text.get().endsWith(suffix)) {
      this.plain = this._text.get().slice(0, -suffix.length);
    }
    return this;
  }

  // --- Token Appending ---

  appendTokens(tokens: Array<[string, TextStyle?]>): this {
    // Each token is its own content, as `assemble`'s parts are.
    for (const [text, style] of tokens) {
      this.append(new RichText(text, { style }));
    }
    return this;
  }

  // --- Static Factories ---

  static assemble(
    parts: Array<string | [string, TextStyle?] | RichText>,
    options?: { style?: TextStyle },
  ): RichText {
    const result = new RichText("", { style: options?.style });
    // Each part is its own content, a string's included, so each takes
    // `append`'s RichText arm.
    for (const part of parts) {
      if (part instanceof RichText) result.append(part);
      else if (typeof part === "string") result.append(new RichText(part));
      else result.append(new RichText(part[0], { style: part[1] }));
    }
    return result;
  }

  static styled(text: string, style: TextStyle): RichText {
    const result = new RichText(text);
    result.stylize(style);
    return result;
  }

  /**
   * Concatenate a sequence of `RichText` fragments into a single `RichText`,
   * flattening each fragment's wrapping `style` onto a span over that
   * fragment's range so downstream rendering preserves the original styling.
   *
   * Designed for the template engine's `RichText[]` output: a top-level
   * `{{ red "x" }}{{ blue "y" }}` evaluates to two fragments — one with
   * wrapping `style = red`, one with `blue` — and consumers that want a
   * single styled string for downstream rendering need both styles
   * preserved as spans on the concatenated result, which is what `append()`
   * does with each fragment.
   *
   * Empty input → empty `RichText` with `end: ""`. Caller can override
   * `end` (defaults to `""` — the engine-output case rarely wants a
   * trailing newline added by the container).
   */
  static fromFragments(
    fragments: readonly RichText[],
    options?: { end?: string },
  ): RichText {
    const result = new RichText("", { end: options?.end ?? "" });
    for (const frag of fragments) result.append(frag);
    return result;
  }

  // --- Wrapping ---

  /**
   * The rows this text wraps into, each a `RichText` holding the spans of the
   * characters it holds — Rich's `Text.wrap`. Drawn one per line with the same
   * options, they are this text's render, but for its `end`.
   *
   * Each row says everything its line knew about it in its own characters and
   * format, so a row rebuilt from its `plain`, `spans` and format draws the
   * same row. As Rich's rows do, it holds what the wrap made of the line: a
   * taken soft hyphen is `-`, whitespace hanging past the edge is cropped to it,
   * a cut word ends in its ellipsis, and under `full` a row that is not its
   * paragraph's last has its gaps widened. Under `logical`, a row of a bidi line
   * opens with the controls its line still had open there, and states the
   * line's direction, which the row alone cannot find again.
   *
   * [LAW:one-source-of-truth] `render` draws these rows; there is no second
   * account of where a line breaks.
   */
  wrap(options: WrapOptions): RichText[] {
    // [LAW:single-enforcer] The type refuses `visual`; this refuses it to a
    // caller the type cannot reach — a cast `RenderOptions`, or JavaScript.
    if (options.textOrder === ("visual" as TextOrder)) throw new RangeError("RichText.wrap: a visual row is laid out by its whole line, so no RichText draws it alone");
    const format = this._format.get();
    return this._layout(options).rows.map(({ draft, direction }) => {
      const piece = new RichText(draft.text, { ...format, end: "", noWrap: true, tabSize: this._tabSize, direction });
      piece._spans.set(draft.spans);
      return piece;
    });
  }

  // --- Renderable ---

  *render(options: RenderOptions): Iterable<Segment> {
    const layout = this._layout(options);
    // Empty text is one empty piece, which writes no bytes and is what makes it
    // one line to whatever splits a render into lines; a blank line among
    // others is already one, between its breaks, and draws nothing.
    const lone = layout.rows.length === 1;
    for (let index = 0; index < layout.rows.length; index += 1) {
      if (index > 0) yield Segment.line();
      yield* drawRow(layout.rows[index]!, layout, options).filter((segment) => lone || segment.text !== "");
    }

    // [LAW:single-enforcer] The one place `end` is emitted, for empty and
    // non-empty text alike — the pre-fix code checked it once for empty text
    // (truthy) and again for non-empty text (truthy and not the default
    // "\n"), which gave `end` two meanings depending on whether the text was
    // empty (rich-text-5ai).
    if (this._format.get().end) {
      yield new Segment(this._format.get().end);
    }
  }

  // --- Measurable ---

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const lines = measured(expandTabs(this._text.get(), this._tabSize).text, options.textOrder ?? "plain").split("\n");

    const maxLineWidth = lines.reduce((widest, line) => Math.max(widest, cellLen(line)), 0);
    // [LAW:one-source-of-truth] The minimum is the widest piece the wrapper
    // never breaks, asked of the wrapper — so a line's indent, which wraps
    // with its first word, counts toward it. Rich splits on whitespace here
    // and drops the indent, then wraps with it kept: a container sized by
    // that minimum cuts the word it was meant to hold whole. Text with no word
    // at all is all whitespace, and as in Rich its whole width is the minimum.
    const widths = lines.flatMap(wordWidths);
    const maxWordWidth =
      widths.length > 0 ? widths.reduce((widest, w) => Math.max(widest, w), 0) : maxLineWidth;

    // Parsed for the same reason `render` parses it: an unparsed NaN ceiling
    // makes both `Math.min` calls NaN, and a range of NaN..NaN is one no parent
    // layout can divide.
    const ceiling = cellCount(options.maxWidth);
    return {
      minimum: Math.min(maxWordWidth, ceiling),
      maximum: Math.min(maxLineWidth, ceiling),
    };
  }


  // --- Internal ---

  /**
   * Every row this text draws at `options`, and what drawing one needs.
   *
   * Each logical line — Rich wraps `split(allow_blank=True)`, so n line breaks
   * make n + 1 lines, the last one blank when the text ends in a break — loses
   * what its order removes ahead of wrapping, is cut where `divideLine` breaks
   * it, and each piece is made the row it draws: hyphen, then overflow, then
   * fill, the reference's order. Wrap first, overflow last — the reason a long
   * sentence grows a table row while an unbreakable word in the same column
   * still ellipsizes.
   */
  private _layout(options: RenderOptions): Layout {
    const format = this._format.get();
    const { text, offsetOf } = expandTabs(this._text.get(), this._tabSize);
    // A span is written against the text as given; `offsetOf` moves its edges
    // past every tab that widened before them.
    const clamp = (offset: number): number => Math.max(0, Math.min(offsetOf(offset), text.length));
    const whole: Draft = { text, spans: this._spans.get().map((span) => new Span(clamp(span.start), clamp(span.end), span.style)) };

    // [LAW:single-enforcer] The one crossing for this renderable's width, and
    // the call every other renderable already makes. A bare `cellCount` stood
    // here doing half of it: it caught a NaN width, which had made every
    // overflow arm a no-op, but passed an unbounded one through to `justify`,
    // which pads — and `" ".repeat(Infinity)` throws.
    const maxWidth = cellCount(withBoundedWidth(options, this).maxWidth);
    const overflow = format.overflow ?? options.overflow ?? "fold";
    const noWrap = format.noWrap || (options.noWrap ?? false);
    // Two widths, and they are the reference's `no_wrap` and `"ignore"` told
    // apart. `edge` is where a line is cut: gone under `"ignore"`, so the line
    // leaves at its natural width and whatever drew it decides about the
    // overhang. `wrapAt` is where a line may break: gone under `noWrap` too,
    // which keeps one line per line and still cuts it at the edge by the
    // overflow method — Rich's `Text.wrap` truncates its no-wrap arm.
    //
    // [LAW:dataflow-not-control-flow] Each reaches the pipeline as a width, not
    // as a step to skip: an unbounded width has no edge to break at, so
    // `divideLine` finds no cuts and `fitted` finds nothing past the edge, and
    // every line runs the same steps. `Infinity` is already this library's
    // spelling of an unbounded width offer — `withBoundedWidth` in protocol.ts
    // parses one on the way in.
    const edge = overflow === "ignore" ? cellCount(Infinity) : maxWidth;
    const wrapAt = noWrap ? cellCount(Infinity) : edge;
    // A line with no edge has no width to be justified in, so under `"ignore"`
    // it is not justified — the reference's `Text.wrap` returns that arm before
    // `justify`. `undefined` is the placement that leaves a line as it is.
    const justify = overflow === "ignore" ? undefined : format.justify ?? options.justify;
    // One cell either way, so the marker's stand-in leaves the cut where it was.
    const ellipsis = drawable(options, "…", ".");
    const order = options.textOrder ?? "plain";
    const base = this.resolvedStyle(options);
    const stated = this._level();

    const rows: Row[] = [];
    for (const raw of divided(whole, lineRanges(text))) {
      const directed = stated !== undefined || isBidi(raw.text);
      const line = directed ? without(raw, (character) => removes(order, character)) : raw;
      const breaks = divideLine(line.text, wrapAt, { fold: overflow === "fold" });
      const ranges = rowRanges(line.text, breaks);
      // Under `visual` a row is ordered by levels resolved over the whole
      // line, which no row can find alone; under every other order a row is
      // ordered by what it holds.
      // The levels are resolved over the raw line, its explicit controls and
      // marks still in it, and `reorder` takes them out as `without` did.
      const ordered = order === "visual" && directed ? reorder(drawnSegments(raw, base, options).segments, order, stated) : undefined;
      // Under `logical` the paragraph level is what a row cannot find alone,
      // and the row states it.
      const level = order === "logical" && directed ? paragraphLevelOf(line.text, stated) : stated;
      const direction = level === undefined ? format.direction : DIRECTION_OF[level];
      const openersAt = openersAlong(line.text);

      divided(line, ranges).forEach((cut, index) => {
        const [start, end] = ranges[index]!;
        const last = index === ranges.length - 1;
        const hyphen = breaks[index]?.hyphen;
        const hyphenated = hyphen === undefined ? cut : spliced(cut, hyphen - start, hyphen - start + 1, "-", INHERIT);
        const fit = fitted(hyphenated, edge, overflow, ellipsis);
        // Rule L1 would stand the whitespace a wrap left hanging at a
        // right-to-left row's left edge, so a directed row a wrap closed loses
        // it; the last row keeps what the author wrote.
        const closedRow = order === "logical" && directed && !last ? cropped(fit, cellLen(fit.text) - hangingCells(fit.text)) : fit;
        const placed = justify === "full" && !last ? filled(closedRow, maxWidth, base, options) : closedRow;
        const opened = order === "logical" && directed ? spliced(placed, 0, 0, openersAt(start), INHERIT) : placed;
        const source = line.text.slice(start, end);
        rows.push({
          // [LAW:single-enforcer] A span that adds nothing is no span, as `_addSpan` admits them.
          draft: { text: opened.text, spans: opened.spans.filter((span) => !isEmptyStyle(span.style)) },
          direction,
          orient: ordered === undefined ? ownOrientation(order, level) : (shown) => ({ line: shown, oriented: true, orient: (segments) => ordered.orient(segments, start, source) }),
        });
      });
    }
    return { rows, maxWidth, base, justify };
  }
}

/**
 * One wrapped line, and whether each of its cells is drawn by no span — the
 * cells the reference cuts into the same piece as padding beside them.
 */
interface WrappedLine {
  readonly segments: Segment[];
  readonly free: (cell: number) => boolean;
  /** The line as its destination's order writes it: the last step before padding. */
  readonly orient: (segments: Segment[]) => Segment[];
}

const NEVER_FREE = (): boolean => false;

/**
 * One line placed in a canvas `maxWidth` wide.
 *
 * Centre and right align on the line's *content*. The whitespace a wrap
 * leaves on the end of the line it closed is the break's own padding, not
 * text, and aligning around it pushes the text half a gap off true — a
 * centred title that wraps drifts left on every line that happens to end in
 * a space. Left keeps that whitespace, because there it is already on the
 * side the padding goes.
 *
 * `undefined` is not `"left"`: it is Rich's `"default"`, which places the
 * line without padding it at all. That distinction is what lets a soft-wrapped
 * `Console.print` leave its lines at their natural width.
 *
 * The padding is drawn in the text's base style, as the reference pads
 * inside the `Text` it justifies: a title "on red" fills its row in red.
 */
function* placed(
  { segments: line, free, orient }: WrappedLine,
  maxWidth: number,
  base: Style,
  // [LAW:types-are-the-program] `full` is absent rather than ignored: it
  // needs the lines either side of this one, so the type refuses it here
  // instead of a branch quietly rendering it as `left`, which is the bug
  // this signature replaces (rich-justify-0cr.1).
  justify?: "left" | "center" | "right",
): Iterable<Segment> {
  const padStyle = base.isNull ? undefined : base;
  switch (justify) {
    case "center":
    case "right": {
      const body = Segment.adjustLineLength(
        line,
        Segment.getLineLength(line) - hangingWhitespace(line),
        undefined,
        false,
      );
      const gap = Math.max(maxWidth - Segment.getLineLength(body), 0);
      const leftPad = justify === "center" ? Math.floor(gap / 2) : gap;
      yield* padded(orient(body), free, leftPad, gap - leftPad, padStyle);
      break;
    }
    case "left": {
      const row = orient(line);
      yield* padded(row, free, 0, Math.max(maxWidth - Segment.getLineLength(row), 0), padStyle);
      break;
    }
    default:
      yield* orient(line);
      break;
  }
}

/**
 * For one row, whether the cell at an offset is covered by no span. `covered`
 * is `_buildSegments`'s answer per piece.
 */
function spanFree(segments: readonly Segment[], covered: readonly boolean[]): (cell: number) => boolean {
  // The cell each run ends at.
  const ends: number[] = [];
  segments.forEach((segment) => ends.push((ends.at(-1) ?? 0) + segment.cellLength));
  return (cell) => {
    let lo = 0;
    let hi = ends.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ends[mid]! <= cell) lo = mid + 1;
      else hi = mid;
    }
    return !covered[lo];
  };
}

/**
 * A line with `left` and `right` cells of padding in `style` either side.
 *
 * The reference pads inside the `Text` it justifies and cuts its output at
 * span edges, so a pad and the run of the line beside it that no span covers
 * are one piece, and Rich emits them as one segment; a run a span covers stays
 * its own segment even when its style draws the same as the pad
 * (rich-table-qj6i). A span-free run is drawn in `style` alone, which is what
 * makes the joined segment's style exact.
 */
function* padded(
  drawn: Segment[],
  free: (cell: number) => boolean,
  left: number,
  right: number,
  style: Style | undefined,
): Iterable<Segment> {
  if (left + right === 0) return yield* drawn;
  // An empty piece writes no bytes, and at an edge it would take the join that
  // belongs to the run behind it.
  const line = drawn.filter((segment) => segment.text !== "");
  const pad = (cells: number): string => " ".repeat(cells);
  const width = Segment.getLineLength(line);
  // A line with no cells has no run to join; the pads alone are its one piece.
  if (width === 0) return yield new Segment(pad(left + right), style);
  const last = line.length - 1;
  // A zero-width segment has no cell of its own to ask about, so it never
  // joins: merged on its neighbour's answer it would lose its own style.
  const head = left > 0 && line[0]!.cellLength > 0 && free(0);
  const tail = right > 0 && line[last]!.cellLength > 0 && free(width - 1);
  const from = head ? 1 : 0;
  const to = tail ? last : last + 1;
  // One run joined on both sides: the pads and it are one piece.
  if (from > to) {
    yield new Segment(pad(left) + line[0]!.text + pad(right), style);
    return;
  }
  if (left > 0) yield new Segment(pad(left) + (head ? line[0]!.text : ""), style);
  yield* line.slice(from, to);
  if (right > 0) yield new Segment((tail ? line[last]!.text : "") + pad(right), style);
}


// --- Rows ---

/** Characters and the spans over them, while `_layout` makes them a row. */
interface Draft {
  readonly text: string;
  readonly spans: readonly Span[];
}

/** A row's drawn segments as its destination's order meets them. */
interface OrientedRow {
  /** The segments to place: what the order removes is gone. */
  readonly line: readonly Segment[];
  /** Whether a row's cells may not be merged with the padding beside them. */
  readonly oriented: boolean;
  /** The row as its destination's order writes it: the last step before padding. */
  orient(shown: Segment[]): Segment[];
}

/** One row a text draws: what `wrap` makes a `RichText` of, and how its order meets it. */
interface Row {
  readonly draft: Draft;
  readonly direction: Direction | undefined;
  readonly orient: (segments: Segment[]) => OrientedRow;
}

/** A text's rows at one render's options, and what placing each needs. */
interface Layout {
  readonly rows: readonly Row[];
  readonly maxWidth: number;
  readonly base: Style;
  readonly justify: "left" | "center" | "right" | "full" | undefined;
}

/** What covers characters `spliced` writes: the spans over what they replace, or one style alone. */
const INHERIT = Symbol("inherit");
type Cover = typeof INHERIT | Style;

/**
 * A row as it is drawn: its segments, oriented, then placed in a canvas
 * `maxWidth` wide. A `full` row's gaps are already in its text, so it is
 * placed as it stands, as the reference's `Lines.justify` leaves a
 * paragraph's last line.
 */
function drawRow(row: Row, layout: Layout, options: RenderOptions): Segment[] {
  const { segments, covered } = drawnSegments(row.draft, layout.base, options);
  const { line, oriented, orient } = row.orient(segments);
  // An oriented row's cells are not where `free` counted them, and a pad
  // joined to one would land inside its isolate.
  const free = oriented ? NEVER_FREE : spanFree(segments, covered);
  return [...placed({ segments: [...line], free, orient }, layout.maxWidth, layout.base, layout.justify === "full" ? undefined : layout.justify)];
}

/** A row ordered by what it holds: under every order but a directed `visual` line's, all a row needs. */
function ownOrientation(order: TextOrder, level: ParagraphLevel | undefined): (segments: Segment[]) => OrientedRow {
  return (segments) => {
    const { line, oriented, orient } = reorder(segments, order, level);
    return { line, oriented, orient: (shown) => orient(shown, 0, Segment.plainOf(line)) };
  };
}

/** Where each logical line of `text` begins and ends, its line break in neither. */
function lineRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let start = 0;
  for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1)) {
    ranges.push([start, at]);
    start = at + 1;
  }
  ranges.push([start, text.length]);
  return ranges;
}

/**
 * Where each row of a line begins and ends, in code units: `breaks` are cells,
 * read off in one walk over the line's clusters, since a walk begun again at
 * each break re-segments the line from its start. A zero-width character at a
 * cut stays on the row before it, as `cutCells` keeps it.
 */
function rowRanges(text: string, breaks: readonly LineBreak[]): [number, number][] {
  const bounds = [0];
  let unit = 0;
  let cell = 0;
  let next = 0;
  for (const cluster of graphemes(text)) {
    const width = cellLen(cluster);
    for (; next < breaks.length && cell + width > breaks[next]!.cell; next += 1) bounds.push(unit);
    unit += cluster.length;
    cell += width;
  }
  for (; next < breaks.length; next += 1) bounds.push(text.length);
  bounds.push(text.length);
  return bounds.slice(0, -1).map((start, index): [number, number] => [start, bounds[index + 1]!]);
}

/**
 * `draft` cut into `ranges`, ascending and apart, each piece with the spans
 * over it moved to its own offsets. One pass over the spans, each going to the
 * pieces it overlaps found by bisection, so a densely styled text cut into
 * many rows costs what the pieces hold, and a piece's spans keep their order —
 * the order `Style.add` folds them in.
 */
function divided(draft: Draft, ranges: readonly [number, number][]): Draft[] {
  const spans: Span[][] = ranges.map(() => []);
  for (const span of draft.spans) {
    let low = 0;
    let high = ranges.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (ranges[mid]![1] <= span.start) low = mid + 1;
      else high = mid;
    }
    for (let piece = low; piece < ranges.length && ranges[piece]![0] < span.end; piece += 1) {
      const [start, end] = ranges[piece]!;
      const from = Math.max(span.start, start);
      const to = Math.min(span.end, end);
      if (from < to) spans[piece]!.push(new Span(from - start, to - start, span.style));
    }
  }
  return ranges.map(([start, end], piece) => ({ text: draft.text.slice(start, end), spans: spans[piece]! }));
}

/** `draft` without each character `drops`, its spans over what remains. */
function without(draft: Draft, drops: (character: string) => boolean): Draft {
  // How many code units are gone before each offset.
  const gone = [0];
  let text = "";
  for (const character of draft.text) {
    const dropped = drops(character);
    if (!dropped) text += character;
    for (let unit = 0; unit < character.length; unit += 1) gone.push(gone.at(-1)! + (dropped ? 1 : 0));
  }
  const spans = draft.spans
    .map((span) => new Span(span.start - gone[span.start]!, span.end - gone[span.end]!, span.style))
    .filter((span) => span.hasLength);
  return { text, spans };
}

/**
 * `draft` with `start`..`end` replaced by `insert`. Under `INHERIT` a span
 * covers what was written exactly when it covered something replaced, so a
 * character written over one keeps its style, and one written between two —
 * `start` equal to `end` — is covered by neither. Under a style, that style
 * alone covers it, as the reference builds a widened gap from a `Text` of its
 * own.
 */
function spliced(draft: Draft, start: number, end: number, insert: string, cover: Cover): Draft {
  const delta = insert.length - (end - start);
  const written = start + insert.length;
  const opening = (at: number): number => (at < start ? at : at >= end ? at + delta : start);
  const closing = (at: number): number => (at <= start ? at : at >= end ? at + delta : written);
  const moved = draft.spans.map((span) => new Span(opening(span.start), closing(span.end), span.style));
  const spans = cover === INHERIT
    ? moved
    : [
        ...moved.flatMap((span) => [new Span(span.start, Math.min(span.end, start), span.style), new Span(Math.max(span.start, written), span.end, span.style)]),
        new Span(start, written, cover),
      ];
  return {
    text: draft.text.slice(0, start) + insert + draft.text.slice(end),
    spans: spans.filter((span) => span.hasLength),
  };
}

/**
 * `draft` cut to `width` cells, as `Segment.adjustLineLength` crops: a wide
 * glyph the edge goes through leaves a space in each of its cells it kept.
 */
function cropped(draft: Draft, width: number): Draft {
  const kept = cellFitFrom(draft.text, asCodePoint(0), asCellCol(Math.max(width, 0)));
  const blank = Math.max(width, 0) - cellLen(draft.text.slice(0, kept));
  return kept === draft.text.length ? draft : trimmed(draft, kept, " ".repeat(blank));
}

/**
 * A row cut to the canvas, as Rich's `Text.truncate` cuts it.
 *
 * Everything reaching here already survived wrapping, so the only text still
 * too wide is text no break could help: a word longer than the canvas under
 * a non-folding overflow method, a glyph wider than the budget, a canvas
 * with no cells at all, or a `noWrap` line, which no break was allowed to
 * help. That is what makes the overflow method a last resort rather than the
 * first thing a long cell meets. `"fold"` has nothing left to fold here and
 * cuts as `"crop"` does, as the reference's `truncate` does.
 */
function fitted(draft: Draft, maxWidth: number, overflow: OverflowMethod, ellipsis: string): Draft {
  const width = cellLen(draft.text);
  // Whitespace hanging past the edge is the wrap's own padding: cropping it
  // away is not truncation, so it earns no marker. Without this an ellipsis
  // landed on any break that fell a space past the column — the common case
  // in a table, not an edge one.
  if (width - hangingCells(draft.text) <= maxWidth) return cropped(draft, Math.min(width, maxWidth));

  // The marker takes the last cell and the text keeps the rest. At maxWidth 1
  // that is zero cells of text and the marker alone, which is the honest
  // rendering of "all of this was cut". At maxWidth 0 there is no cell to put
  // the marker in, so every method draws the same empty row — agreement that
  // keeps a `Columns` or `Layout` squeezed to no width at all from rendering
  // three different kinds of nothing.
  const marker = overflow === "ellipsis" && maxWidth > 0 ? ellipsis : "";
  const room = maxWidth - cellLen(marker);
  const kept = cellFitFrom(draft.text, asCodePoint(0), asCellCol(room));
  const blank = room - cellLen(draft.text.slice(0, kept));
  return trimmed(draft, kept, " ".repeat(blank) + marker);
}

/**
 * `draft` kept to its first `kept` code units with `tail` after them, as Rich's
 * `Text.truncate` sets `plain` and then `_trim_spans`: a span that began
 * before the new end reaches to it, through `tail`, and one that began at or
 * past it is gone.
 */
function trimmed(draft: Draft, kept: number, tail: string): Draft {
  const text = draft.text.slice(0, kept) + tail;
  const spans = draft.spans
    .filter((span) => span.start < text.length)
    .map((span) => new Span(span.start, Math.min(span.end, text.length), span.style));
  return { text, spans };
}

/**
 * One row of a wrapped paragraph, its gaps widened until it fills the
 * canvas — what `justify: "full"` promises, and what the reference's
 * `Lines.justify` does to every line of a paragraph but the last.
 *
 * Slack goes in a cell at a time, starting at the rightmost gap and walking
 * left, round and round until the line is full. That order is the
 * reference's own, and what it decides is where an odd cell lands when the
 * slack will not divide evenly: the right-hand gaps take it.
 *
 * The words come from the row's text split on a single space, with the
 * blank a trailing separator leaves behind dropped — `Text.split` and
 * `String.prototype.split` agree on that list, empty words and all. Two
 * consequences read as bugs until you know whose they are: a run of n
 * spaces is n gaps rather than one, so spacing an author widened stretches
 * instead of collapsing, and the whitespace a wrap left hanging is a gap
 * like the rest, which is why a filled row does not keep it. Both are
 * pinned in `text-justify.golden.txt`, by the `uneven` and `sentence`
 * blocks respectively.
 */
function filled(draft: Draft, maxWidth: number, base: Style, options: RenderOptions): Draft {
  const words = draft.text.split(" ");
  if (drawnTail(draft.text).endsWith(" ")) words.pop();

  const gaps = words.length - 1;
  const spaces = new Array<number>(gaps).fill(1);
  let filledTo = words.reduce((total, word) => total + cellLen(word), 0) + gaps;
  for (let turn = 0; filledTo < maxWidth && gaps > 0; turn = (turn + 1) % gaps) {
    spaces[gaps - 1 - turn]! += 1;
    filledTo += 1;
  }

  // Where each separator sits, and where the last word ends: what follows it is
  // the gap a trailing separator left, and a filled row does not keep it.
  const separators: number[] = [];
  let end = 0;
  words.forEach((word, index) => {
    end += word.length;
    if (index < gaps) separators.push(end);
    end += index < gaps ? 1 : 0;
  });

  // A widened gap takes the style the words either side of it agree on, and
  // the row's own where they disagree — the reference reads that off the
  // character each side turns towards the gap. A word with no characters
  // turns none and answers with the row's style, which is what two adjacent
  // separators leave between them.
  const styleAt = (at: number): Style =>
    draft.spans.reduce((style, span) => (span.start <= at && at < span.end ? style.add(resolveStyle(options, span.style)) : style), base);
  let result = spliced(draft, end, draft.text.length, "", INHERIT);
  for (let gap = gaps - 1; gap >= 0; gap -= 1) {
    const at = separators[gap]!;
    const before = words[gap]!.length > 0 ? styleAt(at - 1) : base;
    const after = words[gap + 1]!.length > 0 ? styleAt(at + 1) : base;
    result = spliced(result, at, at + 1, " ".repeat(spaces[gap]!), before.equals(after) ? before : base);
  }
  return result;
}

/**
 * Characters and spans as segments: the text cut at every span edge, each
 * piece carrying the base style plus every span covering it, and whether any
 * span covers it.
 *
 * Walked span-first rather than piece-first, and that direction is the whole
 * performance argument. The pieces are cut at the span edges themselves, so
 * a span covers a piece exactly when it covers the piece's first character —
 * which makes each span's run of pieces a contiguous range it can be written
 * into once, instead of a question every piece asks of every span. The
 * piece-first form charged `spans x pieces`, and the pieces are themselves
 * cut by the spans, so anything styling densely paid the square in ordinary
 * use: 8,000 one-character spans took 211ms where 1,000 took 3.2ms. Every
 * `Highlighter` over a large value reaches that, and so does `Pretty`, whose
 * indent guides emit a span per indent character.
 *
 * Span-first is also what keeps the composition honest, for free. `Style.add`
 * is order-dependent and the last writer wins, so the pieces have to fold
 * their styles in span order — which iterating the spans is, and which a
 * sweep ordered by position would have had to reconstruct.
 */
function drawnSegments({ text, spans }: Draft, base: Style, options: RenderOptions): { segments: Segment[]; covered: boolean[] } {
  // The text's own start and end are always the outer boundaries, even when
  // they are one offset: empty text is one empty piece, as Rich's
  // `Text.render` yields `Segment("")` for it. That piece writes no bytes,
  // and it is what makes empty text one line to everything that splits a
  // render into lines — a panel's body, a table cell — where Rich draws one.
  const inner = new Set<number>();
  for (const span of spans) {
    inner.add(span.start);
    inner.add(span.end);
  }
  inner.delete(0);
  inner.delete(text.length);
  const boundaries = [0, ...[...inner].sort((a, b) => a - b), text.length];

  // Every span edge is a boundary, so where a span's range opens is a lookup
  // rather than a search. Where two boundaries share an offset — empty
  // text's start and end — the first wins, so the offset names the piece
  // that opens there rather than the one past the last.
  const pieceAt = new Map<number, number>(
    boundaries.map((position, piece): [number, number] => [position, piece]).reverse(),
  );

  const styles = boundaries.slice(0, -1).map(() => base);
  const covered = styles.map(() => false);
  for (const span of spans) {
    const style = resolveStyle(options, span.style);
    for (let piece = pieceAt.get(span.start)!; boundaries[piece]! < span.end; piece++) {
      styles[piece] = styles[piece]!.add(style);
      covered[piece] = true;
    }
  }

  const segments = styles.map(
    (style, piece) => new Segment(text.slice(boundaries[piece]!, boundaries[piece + 1]!), style.isNull ? undefined : style),
  );
  return { segments, covered };
}
