/**
 * RichText — styled text with spans. The primary text type for the library.
 */

import { cellLen, cellCount } from "./cells.js";
import { divideLine } from "./wrap.js";
import { Segment } from "./segment.js";
import { Style, NULL_STYLE, StyleSyntaxError } from "./style.js";
import { stripOscTerminators } from "./sanitize.js";
import { getStyle, withBoundedWidth } from "./protocol.js";
import type { Renderable, Measurable, RenderOptions } from "./protocol.js";

// Strip control characters except \t and \n
// [LAW:single-enforcer] Single place where control chars are sanitized
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS_RE, "");
}

const TRAILING_WHITESPACE_RE = /\s+$/;

/**
 * The plain text of one line of segments, in the coordinate system
 * `divideLine` and `Segment.divide` share: cell offsets into the styled line
 * are cell offsets into this string. [LAW:one-source-of-truth] for that
 * correspondence — the offsets are found in this text and applied to the
 * segments it came from.
 */
function plainOf(line: Segment[]): string {
  return line.map((segment) => segment.text).join("");
}

/**
 * The cells of trailing whitespace on a wrapped line.
 *
 * A wrap cuts before a word, so the line it closes ends with the whitespace
 * that followed *its* last word — padding the break created, not content the
 * author wrote. Measuring it is what lets the overflow method tell "this line
 * was cut" from "this line ends in spaces" and stamp an ellipsis only on the
 * first, and what keeps a centred line from drifting half a space off true.
 *
 * Asked of the line's text rather than walked back through its segments,
 * because where a line ends is a fact about the characters and not about how
 * they were split. Walking the segments made it a fact about both: it read a
 * segment with no trailing whitespace as content and stopped there, which an
 * empty segment also looks like — and a crop leaves one behind. A styled line
 * whose last cells were cropped therefore reported no hanging whitespace at
 * all and was centred as though it were content to the edge, so a span landing
 * anywhere in a wrap's whitespace un-centred the line it closed.
 */
function hangingWhitespace(line: Segment[]): number {
  return cellLen(TRAILING_WHITESPACE_RE.exec(plainOf(line))?.[0] ?? "");
}

// [LAW:single-enforcer] RichText is the data-model trust boundary for link
// URLs: a `Style` is sanitized as it enters (`admitStyle`), and the `Style` a
// stored string resolves to is sanitized as it leaves for a render
// (`resolveStyle`). Wire-byte safety is enforced separately in render.ts and
// style.ts through the same `stripOscTerminators`.
function sanitizeStyleLink(style: Style): Style {
  const link = style.link;
  if (!link) return style;
  const cleaned = stripOscTerminators(link);
  if (cleaned === link) return style;
  return style.withLink(cleaned);
}

/**
 * A style as a RichText keeps it: as given. A name stays a name because what
 * it stands for depends on the theme of the render that draws it, which no
 * RichText knows when the name arrives — the reference stores span styles the
 * same way. A string holds no link until it is parsed, so only a `Style` has
 * one to sanitize here.
 */
function admitStyle(style: string | Style): string | Style {
  return style instanceof Style ? sanitizeStyleLink(style) : style;
}

/** A style that adds nothing: the empty definition, or a null `Style`. */
function isEmptyStyle(style: string | Style): boolean {
  return style instanceof Style ? style.isNull : style === "";
}

/**
 * The style a stored `string | Style` stands for in this render.
 *
 * [LAW:single-enforcer] Styling is non-critical — an unrecognized style name
 * (typo, missing theme key, bad concatenation) degrades to unstyled rather
 * than crashing, as the reference's `Text.render` resolves with a null
 * default. Absorb only StyleSyntaxError here; other errors are genuine bugs
 * and must surface. A parsed string can carry a link, so the result is
 * sanitized on the way out as well.
 */
function resolveStyle(options: RenderOptions, style: string | Style): Style {
  try {
    return sanitizeStyleLink(getStyle(options, style));
  } catch (err) {
    if (err instanceof StyleSyntaxError) return NULL_STYLE;
    throw err;
  }
}

// --- Span ---

export class Span {
  readonly start: number;
  readonly end: number;
  readonly style: string | Style;

  constructor(start: number, end: number, style: string | Style) {
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
  style?: string | Style;
  justify?: "left" | "center" | "right" | "full";
  overflow?: "fold" | "crop" | "ellipsis";
  end?: string;
  tabSize?: number;
  noWrap?: boolean;
}

export class RichText implements Renderable, Measurable {
  private _text: string;
  private _spans: Span[];
  private _style: string | Style;
  private _justify: "left" | "center" | "right" | "full" | undefined;
  private _overflow: "fold" | "crop" | "ellipsis" | undefined;
  private _end: string;
  private _tabSize: number;
  private _noWrap: boolean;

  constructor(text?: string, options?: RichTextOptions) {
    this._text = text ? stripControlChars(text) : "";
    this._spans = [];
    // [LAW:single-enforcer] `admitStyle` is the boundary that sanitizes
    // any link URL crossing into a RichText; downstream trusts the invariant.
    this._style = admitStyle(options?.style ?? NULL_STYLE);
    this._justify = options?.justify;
    this._overflow = options?.overflow;
    this._end = options?.end ?? "\n";
    this._tabSize = options?.tabSize ?? 8;
    this._noWrap = options?.noWrap ?? false;
  }

  // --- Properties ---

  get plain(): string {
    return this._text;
  }

  set plain(value: string) {
    const sanitized = stripControlChars(value);
    this._text = sanitized;
    // Trim spans that extend beyond new length
    const len = sanitized.length;
    this._spans = this._spans
      .map((s) => (s.end > len ? new Span(s.start, Math.min(s.end, len), s.style) : s))
      .filter((s) => s.start < len);
  }

  get length(): number {
    return this._text.length;
  }

  get cellLength(): number {
    return cellLen(this._text);
  }

  get hasContent(): boolean {
    return this._text.length > 0;
  }

  /** The base style every span layers over: a `Style`, or a name resolved at render. */
  get style(): string | Style {
    return this._style;
  }

  set style(value: string | Style) {
    this._style = admitStyle(value);
  }

  get justify(): "left" | "center" | "right" | "full" | undefined {
    return this._justify;
  }

  set justify(value: "left" | "center" | "right" | "full" | undefined) {
    this._justify = value;
  }

  get overflow(): "fold" | "crop" | "ellipsis" | undefined {
    return this._overflow;
  }

  set overflow(value: "fold" | "crop" | "ellipsis" | undefined) {
    this._overflow = value;
  }

  get end(): string {
    return this._end;
  }

  set end(value: string) {
    this._end = value;
  }

  get noWrap(): boolean {
    return this._noWrap;
  }

  set noWrap(value: boolean) {
    this._noWrap = value;
  }

  get spans(): readonly Span[] {
    return this._spans;
  }

  /**
   * This text's own style, spans aside, as the render drawing it resolves it.
   * A name the render's theme does not define resolves to no style, because
   * text forgives a missing name.
   */
  resolvedStyle(options: RenderOptions): Style {
    return resolveStyle(options, this._style);
  }

  /**
   * The style of the cell-column at the named edge — base style merged with
   * any spans covering the leftmost (side="left") or rightmost (side="right")
   * character.
   *
   * [LAW:locality-or-seam] Used by `Joiner`s to paint the transition between
   * adjacent `Strip` items. Joiners only ever need the column adjacent to
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
    if (this._text.length === 0) return base;
    const pos = side === "left" ? 0 : this._text.length - 1;
    let result = base;
    for (const span of this._spans) {
      if (span.start <= pos && pos < span.end) {
        result = result.add(resolveStyle(options, span.style));
      }
    }
    return result;
  }

  // --- Content Operations ---

  append(content: string | RichText, style?: string | Style): this {
    if (content instanceof RichText) {
      if (style !== undefined) {
        throw new Error("Style argument must not be provided when appending RichText");
      }
      const offset = this._text.length;
      this._text += content._text;
      for (const span of content._spans) {
        this._spans.push(span.move(offset));
      }
      return this;
    }

    const sanitized = stripControlChars(content);
    const start = this._text.length;
    this._text += sanitized;
    this._addSpan(start, this._text.length, style ?? "");
    return this;
  }

  contains(needle: string | RichText): boolean {
    const searchText = needle instanceof RichText ? needle._text : needle;
    return this._text.includes(searchText);
  }

  at(index: number): RichText {
    const resolved = index < 0 ? this._text.length + index : index;
    const char = this._text[resolved];
    if (char === undefined) return new RichText("");
    return this.slice(resolved, resolved + 1);
  }

  slice(start?: number, end?: number): RichText {
    const text = this._text;
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

    for (const span of this._spans) {
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
  private _addSpan(start: number, end: number, style: string | Style): void {
    if (isEmptyStyle(style)) return;
    this._spans.push(new Span(start, end, admitStyle(style)));
  }

  stylize(style: string | Style, start?: number, end?: number): this {
    const len = this._text.length;
    const s = start !== undefined ? (start < 0 ? len + start : start) : 0;
    const e = end !== undefined ? (end < 0 ? len + end : end) : len;

    if (s >= e || s >= len || e <= 0) return this;
    const clampedStart = Math.max(0, s);
    const clampedEnd = Math.min(len, e);

    this._addSpan(clampedStart, clampedEnd, style);
    return this;
  }

  highlightRegex(pattern: RegExp, style?: string | Style): number {
    const text = this._text;
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
    style: string | Style,
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
      while ((match = re.exec(this._text)) !== null) {
        this._addSpan(match.index, match.index + match[0].length, style);
        count++;
      }
    }

    return count;
  }

  // --- Copy Operations ---

  copy(): RichText {
    const result = new RichText(this._text, {
      style: this._style,
      justify: this._justify,
      overflow: this._overflow,
      end: this._end,
      tabSize: this._tabSize,
      noWrap: this._noWrap,
    });
    result._spans = this._spans.slice();
    return result;
  }

  blankCopy(text?: string): RichText {
    return new RichText(text ?? "", {
      style: this._style,
      justify: this._justify,
      overflow: this._overflow,
      end: this._end,
      tabSize: this._tabSize,
      noWrap: this._noWrap,
    });
  }

  // --- Splitting ---

  split(separator?: string): RichText[] {
    const sep = separator ?? "\n";
    const text = this._text;
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
    const trimmed = this._text.replace(/\s+$/, "");
    if (trimmed.length < this._text.length) {
      this.plain = trimmed;
    }
    return this;
  }

  pad(count: number, char?: string): this {
    const c = char ?? " ";
    const padding = c.repeat(count);
    // Shift all spans to the right
    this._spans = this._spans.map((s) => s.move(count));
    this._text = padding + this._text + padding;
    return this;
  }

  padLeft(count: number, char?: string): this {
    const c = char ?? " ";
    this._spans = this._spans.map((s) => s.move(count));
    this._text = c.repeat(count) + this._text;
    return this;
  }

  padRight(count: number, char?: string): this {
    const c = char ?? " ";
    this._text += c.repeat(count);
    return this;
  }

  setLength(length: number): this {
    if (this._text.length < length) {
      this._text += " ".repeat(length - this._text.length);
    } else if (this._text.length > length) {
      this.plain = this._text.slice(0, length);
    }
    return this;
  }

  extendStyle(count: number): this {
    const oldLen = this._text.length;
    this._text += " ".repeat(count);
    // Extend existing spans to cover new spaces
    this._spans = this._spans.map((s) =>
      s.end === oldLen ? s.extend(count) : s,
    );
    return this;
  }

  // --- Truncation ---

  /**
   * Truncate to a fixed cell-column width. Three modes, plus a back-compat
   * `overflow` form.
   *
   * - `mode: "right"` (default) \u2014 drop characters from the right; append
   *   `marker` (if any) at the cut.
   * - `mode: "left"` \u2014 drop characters from the left; prepend `marker` at
   *   the cut.
   * - `mode: "middle"` \u2014 keep equal halves from both ends; place `marker`
   *   in the middle.
   *
   * Marker default is `"\u2026"`. Pass `marker: ""` for raw cropping without an
   * indicator glyph.
   *
   * Legacy form: `{ overflow: "ellipsis" }` is equivalent to
   * `{ mode: "right", marker: "\u2026" }`; `{ overflow: "crop" | "fold" }` is
   * equivalent to `{ marker: "" }`.
   *
   * Spans are preserved through the cut: characters that survive keep their
   * styling; the marker (if any) is inserted as plain text with no span.
   * Use `stylize(...)` on the result to color the marker if needed.
   *
   * [LAW:dataflow-not-control-flow] mode/marker/width all flow as values;
   * the walk is the same shape regardless. No "if truncated then rebuild"
   * branch \u2014 the unchanged path just early-returns when content fits.
   */
  truncate(
    width: number,
    options?: {
      overflow?: "fold" | "crop" | "ellipsis";
      mode?: "right" | "left" | "middle";
      marker?: string;
    },
  ): this {
    if (this.cellLength <= width) return this;

    const overflow = options?.overflow;
    const mode = options?.mode ?? "right";
    const marker =
      options?.marker !== undefined
        ? options.marker
        : overflow === "ellipsis"
          ? "\u2026"
          : overflow === undefined && options?.mode !== undefined
            ? "\u2026"
            : "";

    const markerWidth = cellLen(marker);
    if (width <= 0) {
      this.plain = "";
      return this;
    }
    const budget = Math.max(0, width - markerWidth);

    if (mode === "right") {
      this._cropRightTo(budget);
      if (marker) this._text += marker;
      return this;
    }

    if (mode === "left") {
      this._cropLeftTo(budget);
      if (marker) {
        this._spans = this._spans.map((s) => s.move(marker.length));
        this._text = marker + this._text;
      }
      return this;
    }

    // middle
    const leftBudget = Math.floor(budget / 2);
    const rightBudget = budget - leftBudget;
    // Find the char-index ranges to keep from each side.
    const leftEndCharIdx = this._cellPrefixCharLength(leftBudget);
    const rightStartCharIdx = this._cellSuffixStartCharIndex(rightBudget);
    const leftText = this._text.slice(0, leftEndCharIdx);
    const rightText = this._text.slice(rightStartCharIdx);
    const droppedStart = leftEndCharIdx;
    const droppedEnd = rightStartCharIdx;
    const shift = marker.length - (droppedEnd - droppedStart);
    // Spans falling entirely before the drop stay; entirely after shift by
    // (marker.length - dropped chars); spans crossing the drop are clipped.
    const newSpans: Span[] = [];
    for (const s of this._spans) {
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
    this._text = leftText + marker + rightText;
    this._spans = newSpans;
    return this;
  }

  private _cropRightTo(targetWidth: number): void {
    const charIdx = this._cellPrefixCharLength(targetWidth);
    this.plain = this._text.slice(0, charIdx);
  }

  private _cropLeftTo(targetWidth: number): void {
    const charIdx = this._cellSuffixStartCharIndex(targetWidth);
    // Shift spans left by charIdx; clip spans that started before.
    const shift = -charIdx;
    this._spans = this._spans
      .map((s) => {
        if (s.end <= charIdx) return undefined;
        const newStart = Math.max(0, s.start + shift);
        const newEnd = s.end + shift;
        return new Span(newStart, newEnd, s.style);
      })
      .filter((s): s is Span => s !== undefined);
    this._text = this._text.slice(charIdx);
  }

  /** Number of char-index code units that fit within `targetWidth` cell columns from the left. */
  private _cellPrefixCharLength(targetWidth: number): number {
    let width = 0;
    let charIndex = 0;
    for (const char of this._text) {
      const charWidth = cellLen(char);
      if (width + charWidth > targetWidth) break;
      width += charWidth;
      charIndex += char.length;
    }
    return charIndex;
  }

  /** Char-index at which the suffix of `targetWidth` cell columns starts. */
  private _cellSuffixStartCharIndex(targetWidth: number): number {
    // Walk from right: accumulate widths of trailing chars until we hit the budget.
    const chars: string[] = [...this._text];
    let width = 0;
    let kept = 0;
    for (let i = chars.length - 1; i >= 0; i--) {
      const w = cellLen(chars[i]!);
      if (width + w > targetWidth) break;
      width += w;
      kept += chars[i]!.length;
    }
    return this._text.length - kept;
  }

  // --- Alignment ---

  align(justify: "left" | "center" | "right", width: number): this {
    const currentWidth = this.cellLength;
    if (currentWidth >= width) return this;

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
    if (this._text.endsWith(suffix)) {
      this.plain = this._text.slice(0, -suffix.length);
    }
    return this;
  }

  // --- Token Appending ---

  appendTokens(tokens: Array<[string, (string | Style)?]>): this {
    for (const [text, style] of tokens) {
      this.append(text, style);
    }
    return this;
  }

  // --- Static Factories ---

  static assemble(
    parts: Array<string | [string, (string | Style)?] | RichText>,
    options?: { style?: string | Style },
  ): RichText {
    const result = new RichText("", { style: options?.style });
    for (const part of parts) {
      if (typeof part === "string") {
        result.append(part);
      } else if (part instanceof RichText) {
        result.append(part);
      } else {
        const [text, style] = part;
        result.append(text, style);
      }
    }
    return result;
  }

  static styled(text: string, style: string | Style): RichText {
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
   * preserved as spans on the concatenated result. The plain `append()`
   * propagates spans only, so this static does the additional work of
   * lifting `frag.style` into a span before appending.
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
    for (const frag of fragments) {
      const start = result.length;
      result.append(frag.plain);
      result.stylize(frag.style, start, result.length);
      for (const span of frag.spans) {
        result.stylize(span.style, start + span.start, start + span.end);
      }
    }
    return result;
  }

  // --- Renderable ---

  *render(options: RenderOptions): Iterable<Segment> {
    const text = this._expandTabs(this._text);
    if (text.length === 0) {
      if (this._end) yield new Segment(this._end);
      return;
    }

    const base = this.resolvedStyle(options);
    const allSegments = this._buildSegments(text, base, options);
    const logicalLines = Segment.splitLines(allSegments);
    // [LAW:single-enforcer] The one crossing for this renderable's width, and
    // the call every other renderable already makes. A bare `cellCount` stood
    // here doing half of it: it caught a NaN width, which had made every
    // overflow arm a no-op, but passed an unbounded one through to `justify`,
    // which pads — and `" ".repeat(Infinity)` throws.
    const maxWidth = cellCount(withBoundedWidth(options, this).maxWidth);
    const overflow = this._overflow ?? options.overflow ?? "fold";
    const justify = this._justify ?? options.justify;
    const noWrap = this._noWrap || (options.noWrap ?? false);

    // The width a line is cut to, which is not always the width it is
    // justified in. `noWrap` means the line is not bounded at all: it leaves at
    // its natural width and whatever asked for it decides about the overhang —
    // `Console`'s soft wrap and `FlexStrip`'s too-wide fallback both want the
    // text intact rather than cropped.
    //
    // [LAW:dataflow-not-control-flow] It reaches the pipeline as a width, not
    // as a step to skip: an unbounded budget has no edge to break at, so
    // `divideLine` finds no cuts and `_fitLine` finds nothing past the edge,
    // and every line runs the same three steps. `Infinity` is already this
    // library's spelling of an unbounded width offer — `withBoundedWidth` in
    // protocol.ts parses one on the way in.
    const budget = noWrap ? cellCount(Infinity) : maxWidth;
    const endsWithNewline = text.endsWith("\n");

    for (let index = 0; index < logicalLines.length; index += 1) {
      const line = logicalLines[index]!;
      const terminateLine = index < logicalLines.length - 1 || endsWithNewline;

      // Wrap first, overflow last — the reference's order, and the reason a
      // long sentence grows a table row while an unbreakable word in the same
      // column still ellipsizes.
      const cuts = divideLine(plainOf(line), budget, { fold: overflow === "fold" });

      const wrapped = Segment.divide(line, cuts);
      const placed = this._justifyLines(
        wrapped.map((piece) => [...this._fitLine(piece, budget, overflow)]),
        maxWidth,
        base,
        justify,
      );
      for (let piece = 0; piece < placed.length; piece += 1) {
        yield* placed[piece]!;
        if (piece < placed.length - 1 || terminateLine) {
          yield Segment.line();
        }
      }
    }

    if (this._end && this._end !== "\n") {
      yield new Segment(this._end);
    }
  }

  // --- Measurable ---

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const text = this._expandTabs(this._text);
    const lines = text.split("\n");

    let maxLineWidth = 0;
    let maxWordWidth = 0;

    for (const line of lines) {
      const lineWidth = cellLen(line);
      maxLineWidth = Math.max(maxLineWidth, lineWidth);

      // Minimum is the longest word
      const words = line.split(/\s+/);
      for (const word of words) {
        if (word.length > 0) {
          maxWordWidth = Math.max(maxWordWidth, cellLen(word));
        }
      }
    }

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

  private _expandTabs(text: string): string {
    if (!text.includes("\t")) return text;
    return text.replace(/\t/g, " ".repeat(this._tabSize));
  }

  /**
   * The rendered text cut at every span edge, each piece carrying the base
   * style plus every span covering it.
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
   * their styles in `_spans` order — which iterating `_spans` is, and which a
   * sweep ordered by position would have had to reconstruct.
   *
   * [LAW:dataflow-not-control-flow] A span covering nothing — empty, reversed,
   * or entirely past the text — still cuts the text where its edges land, as it
   * always did, and then folds into no piece at all: its range comes out empty
   * and no case handles it.
   */
  private _buildSegments(text: string, base: Style, options: RenderOptions): Segment[] {
    const clamp = (offset: number): number =>
      Math.max(0, Math.min(offset, text.length));

    const positions = new Set<number>([0, text.length]);
    for (const span of this._spans) {
      positions.add(clamp(span.start));
      positions.add(clamp(span.end));
    }
    const boundaries = [...positions].sort((a, b) => a - b);

    // Every span edge is a boundary, so where a span's range opens is a lookup
    // rather than a search.
    const pieceAt = new Map<number, number>(
      boundaries.map((position, piece) => [position, piece]),
    );

    const styles = boundaries.slice(0, -1).map(() => base);
    for (const span of this._spans) {
      const end = clamp(span.end);
      const style = resolveStyle(options, span.style);
      const opensAt = pieceAt.get(clamp(span.start))!;
      for (let piece = opensAt; boundaries[piece]! < end; piece++) {
        styles[piece] = styles[piece]!.add(style);
      }
    }

    return styles.map(
      (style, piece) =>
        new Segment(
          text.slice(boundaries[piece]!, boundaries[piece + 1]!),
          style.isNull ? undefined : style,
        ),
    );
  }

  /**
   * The pieces one logical line wrapped into, each placed in a canvas
   * `maxWidth` wide, as Rich's `Lines.justify` places them — pinned block for
   * block against the reference in `test/core/text-justify.test.ts`.
   *
   * It is handed the whole wrapped line because `full` is the one mode a
   * piece cannot answer alone: the reference leaves a paragraph's last line
   * ragged, so where the piece sits decides its answer where the other three
   * modes need only the piece itself. The set that decides "last" is this one
   * and not the whole render — `Text.wrap` calls `Lines.justify` once per
   * *logical* line — and `Segment.divide` already handed it over whole.
   */
  private _justifyLines(
    lines: Segment[][],
    maxWidth: number,
    base: Style,
    justify?: "left" | "center" | "right" | "full",
  ): Segment[][] {
    if (justify !== "full") {
      return lines.map((line) => [...this._justifyLine(line, maxWidth, justify)]);
    }
    return lines.map((line, index) =>
      index === lines.length - 1 ? line : this._fillLine(line, maxWidth, base),
    );
  }

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
   */
  private *_justifyLine(
    line: Segment[],
    maxWidth: number,
    // [LAW:types-are-the-program] `full` is absent rather than ignored: it
    // needs the lines either side of this one, so the type refuses it here
    // instead of a branch quietly rendering it as `left`, which is the bug
    // this signature replaces (rich-justify-0cr.1).
    justify?: "left" | "center" | "right",
  ): Iterable<Segment> {
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
        if (leftPad > 0) yield new Segment(" ".repeat(leftPad));
        yield* body;
        const rightPad = gap - leftPad;
        if (rightPad > 0) yield new Segment(" ".repeat(rightPad));
        break;
      }
      case "left":
        yield* Segment.adjustLineLength(line, Math.max(maxWidth, Segment.getLineLength(line)));
        break;
      default:
        yield* line;
        break;
    }
  }

  /**
   * One line of a wrapped paragraph, its gaps widened until it fills the
   * canvas — what `justify: "full"` promises, and what the reference's
   * `Lines.justify` does to every line of a paragraph but the last.
   *
   * Slack goes in a cell at a time, starting at the rightmost gap and walking
   * left, round and round until the line is full. That order is the
   * reference's own, and what it decides is where an odd cell lands when the
   * slack will not divide evenly: the right-hand gaps take it.
   *
   * The words come from the line's *text* split on a single space, with the
   * blank a trailing separator leaves behind dropped — `Text.split` and
   * `String.prototype.split` agree on that list, empty words and all. Two
   * consequences read as bugs until you know whose they are: a run of n
   * spaces is n gaps rather than one, so spacing an author widened stretches
   * instead of collapsing, and the whitespace a wrap left hanging is a gap
   * like the rest, which is why a filled line does not keep it. Both are
   * pinned in `text-justify.golden.txt`, by the `uneven` and `sentence`
   * blocks respectively.
   */
  private _fillLine(line: Segment[], maxWidth: number, base: Style): Segment[] {
    const plain = plainOf(line);
    const words = plain.split(" ");
    if (plain.endsWith(" ")) words.pop();

    const gaps = words.length - 1;
    const spaces = new Array<number>(gaps).fill(1);
    let filled = words.reduce((total, word) => total + cellLen(word), 0) + gaps;
    for (let turn = 0; filled < maxWidth && gaps > 0; turn = (turn + 1) % gaps) {
      spaces[gaps - 1 - turn]! += 1;
      filled += 1;
    }

    // Cut at both edges of every gap, so a word is an even piece and the
    // separator that followed it is the odd piece after it. Measured in cells
    // because that is the coordinate system `Segment.divide` reads, which a
    // line of wide glyphs is the only thing that notices.
    const cuts: number[] = [];
    let edge = 0;
    for (let index = 0; index < words.length; index += 1) {
      edge += cellLen(words[index]!);
      cuts.push(edge);
      edge += 1;
      if (index < gaps) cuts.push(edge);
    }
    const pieces = Segment.divide(line, cuts);

    // A widened gap takes the style the words either side of it agree on, and
    // the line's own where they disagree — the reference reads that off the
    // character each side turns towards the gap, which is the offset `at` is
    // given here. A word with no characters turns none and answers with the
    // line's style, which is what two adjacent separators leave between them.
    const edgeStyle = (word: Segment[], at: number): Style =>
      word.filter((segment) => segment.hasText).at(at)?.style ?? base;

    const result: Segment[] = [];
    for (let index = 0; index < words.length; index += 1) {
      result.push(...pieces[index * 2]!);
      if (index < gaps) {
        const before = edgeStyle(pieces[index * 2]!, -1);
        const after = edgeStyle(pieces[index * 2 + 2]!, 0);
        const style = before.equals(after) ? before : base;
        result.push(
          new Segment(" ".repeat(spaces[index]!), style.isNull ? undefined : style),
        );
      }
    }
    return result;
  }

  /**
   * One wrapped line cut to the canvas.
   *
   * Everything reaching here already survived wrapping, so the only text still
   * too wide is text no break could help: a word longer than the canvas under
   * a non-folding overflow method, a glyph wider than the budget, or a canvas
   * with no cells at all. That is what makes the overflow method a last
   * resort rather than the first thing a long cell meets.
   */
  private *_fitLine(
    line: Segment[],
    maxWidth: number,
    overflow: "fold" | "crop" | "ellipsis",
  ): Iterable<Segment> {
    const lineWidth = Segment.getLineLength(line);
    const contentWidth = lineWidth - hangingWhitespace(line);

    // Whitespace hanging past the edge is the wrap's own padding: cropping it
    // away is not truncation, so it earns no marker. Without this an ellipsis
    // landed on any break that fell a space past the column — the common case
    // in a table, not an edge one.
    if (contentWidth <= maxWidth) {
      yield* Segment.adjustLineLength(line, Math.min(lineWidth, maxWidth), undefined, false);
      return;
    }

    // The marker takes the last cell and the text keeps the rest. At maxWidth 1
    // that is zero cells of text and the marker alone, which is the honest
    // rendering of "all of this was cut"; the `maxWidth > 1` guard that used to
    // stand here emitted no line at all, so every table column squeezed to a
    // single cell rendered blank rather than truncated — `ellipsis` being the
    // default column overflow, a hard-squeezed table looked like an empty frame.
    //
    // At maxWidth 0 there is no cell to put the marker in, so every method
    // yields the same bare empty line. Agreement there is what keeps a
    // `Columns` or `Layout` squeezed to no width at all from rendering
    // three different kinds of nothing.
    if (overflow === "ellipsis" && maxWidth > 0) {
      yield* Segment.adjustLineLength(line, maxWidth - 1, undefined, false);
      yield new Segment("\u2026");
      return;
    }

    yield* Segment.adjustLineLength(line, maxWidth, undefined, false);
  }

}
