/**
 * RichText — styled text with spans. The primary text type for the library.
 */

import { cellLen } from "./cells.js";
import { Segment } from "./segment.js";
import { Style, NULL_STYLE, StyleSyntaxError } from "./style.js";
import { stripOscTerminators } from "./sanitize.js";
import type { Renderable, Measurable, RenderOptions } from "./protocol.js";

// Strip control characters except \t and \n
// [LAW:single-enforcer] Single place where control chars are sanitized
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS_RE, "");
}

// [LAW:single-enforcer] RichText is the *data-model* trust boundary for
// link URLs — any Style carrying a link that enters a RichText is sanitized
// in place, so callers that inspect `richText.style.link` or
// `richText.spans[].style.link` see the same clean URL the renderer will
// emit. Wire-byte safety is enforced separately in render.ts and style.ts
// via the same shared `stripOscTerminators` helper (one rule, applied at
// both seams). Together those layers guarantee the dirty bytes can neither
// live in the in-memory model nor escape on the wire — even if a Style is
// constructed and rendered via a path that bypasses RichText entirely.
//
// Co-located inside `resolveStyle` so any current or future RichText method
// that normalizes a `string | Style` argument inherits sanitization
// automatically; no per-callsite wrap to forget.
function sanitizeStyleLink(style: Style): Style {
  const link = style.link;
  if (!link) return style;
  const cleaned = stripOscTerminators(link);
  if (cleaned === link) return style;
  return style.withLink(cleaned);
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  let resolved: Style;
  if (typeof style === "string") {
    try {
      resolved = Style.parse(style);
    } catch (err) {
      // [LAW:single-enforcer] Styling is non-critical — an unrecognized style
      // name (typo, missing theme key, bad concatenation) degrades to unstyled
      // rather than crashing. Absorb only StyleSyntaxError at this trust
      // boundary; other errors are genuine bugs and must surface.
      if (err instanceof StyleSyntaxError) return NULL_STYLE;
      throw err;
    }
  } else {
    resolved = style;
  }
  return sanitizeStyleLink(resolved);
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
  private _style: Style;
  private _justify: "left" | "center" | "right" | "full" | undefined;
  private _overflow: "fold" | "crop" | "ellipsis" | undefined;
  private _end: string;
  private _tabSize: number;
  private _noWrap: boolean;

  constructor(text?: string, options?: RichTextOptions) {
    this._text = text ? stripControlChars(text) : "";
    this._spans = [];
    // [LAW:single-enforcer] `resolveStyle` is the boundary that sanitizes
    // any link URL crossing into a RichText; downstream trusts the invariant.
    this._style = resolveStyle(options?.style);
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

  get style(): Style {
    return this._style;
  }

  set style(value: Style) {
    // [LAW:single-enforcer] The setter is the only entry that doesn't pass
    // through `resolveStyle` (its argument is already a Style); sanitize
    // directly so the boundary contract holds for every Style assignment.
    this._style = sanitizeStyleLink(value);
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

  get spans(): readonly Span[] {
    return this._spans;
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
   */
  edgeStyle(side: "left" | "right"): Style {
    if (this._text.length === 0) return this._style;
    const pos = side === "left" ? 0 : this._text.length - 1;
    let result = this._style;
    for (const span of this._spans) {
      if (span.start <= pos && pos < span.end) {
        const spanStyle =
          typeof span.style === "string" ? Style.parse(span.style) : span.style;
        result = result.add(spanStyle);
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
    if (style !== undefined) {
      const resolved = resolveStyle(style);
      if (!resolved.isNull) {
        this._spans.push(new Span(start, this._text.length, resolved));
      }
    }
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

  stylize(style: string | Style, start?: number, end?: number): this {
    const resolved = resolveStyle(style);
    if (resolved.isNull) return this;

    const len = this._text.length;
    const s = start !== undefined ? (start < 0 ? len + start : start) : 0;
    const e = end !== undefined ? (end < 0 ? len + end : end) : len;

    if (s >= e || s >= len || e <= 0) return this;
    const clampedStart = Math.max(0, s);
    const clampedEnd = Math.min(len, e);

    this._spans.push(new Span(clampedStart, clampedEnd, resolved));
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
              this._spans.push(
                new Span(groupStart, groupStart + groupValue.length, groupName),
              );
              searchFrom = posInMatch + groupValue.length;
            }
          }
        }
        count++;
        continue;
      }

      const resolvedStyle = style !== undefined ? resolveStyle(style) : NULL_STYLE;
      if (!resolvedStyle.isNull) {
        this._spans.push(
          new Span(match.index, match.index + match[0].length, resolvedStyle),
        );
      }
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
    const resolved = resolveStyle(style);
    if (resolved.isNull) return 0;

    let count = 0;
    for (const word of words) {
      if (word.length === 0) continue;
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = caseSensitive ? "g" : "gi";
      const re = new RegExp(`\\b${escaped}\\b`, flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(this._text)) !== null) {
        this._spans.push(
          new Span(match.index, match.index + match[0].length, resolved),
        );
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
      if (!frag.style.isNull) {
        result.stylize(frag.style, start, result.length);
      }
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

    const allSegments = this._buildSegments(text);
    const logicalLines = Segment.splitLines(allSegments);
    const maxWidth = options.maxWidth;
    const overflow = this._overflow ?? options.overflow ?? "fold";
    const justify = this._justify ?? options.justify;
    const noWrap = this._noWrap || (options.noWrap ?? false);
    const endsWithNewline = text.endsWith("\n");

    for (let index = 0; index < logicalLines.length; index += 1) {
      const line = logicalLines[index]!;
      const lineWidth = Segment.getLineLength(line);
      const terminateLine = index < logicalLines.length - 1 || endsWithNewline;

      if (noWrap || lineWidth <= maxWidth) {
        // Line fits — apply justification
        yield* this._justifyLine(line, maxWidth, justify);
        if (terminateLine) {
          yield Segment.line();
        }
      } else {
        // Line too long — handle overflow
        yield* this._overflowLine(line, lineWidth, maxWidth, overflow, terminateLine);
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

    return {
      minimum: Math.min(maxWordWidth, options.maxWidth),
      maximum: Math.min(maxLineWidth, options.maxWidth),
    };
  }

  // --- Internal ---

  private _expandTabs(text: string): string {
    if (!text.includes("\t")) return text;
    return text.replace(/\t/g, " ".repeat(this._tabSize));
  }

  private _buildSegments(text: string): Segment[] {
    if (text.length === 0) return [];

    // Collect all unique boundary positions
    const positions = new Set<number>([0, text.length]);
    for (const span of this._spans) {
      const start = Math.max(0, Math.min(span.start, text.length));
      const end = Math.max(0, Math.min(span.end, text.length));
      positions.add(start);
      positions.add(end);
    }

    const sorted = [...positions].sort((a, b) => a - b);
    const segments: Segment[] = [];

    // [LAW:dataflow-not-control-flow] Always iterate all regions; empty ones produce nothing
    for (let i = 0; i < sorted.length - 1; i++) {
      const regionStart = sorted[i]!;
      const regionEnd = sorted[i + 1]!;
      const regionText = text.slice(regionStart, regionEnd);
      if (regionText.length === 0) continue;

      // Combine base style with all active span styles
      let style = this._style;
      for (const span of this._spans) {
        if (span.start <= regionStart && span.end >= regionEnd) {
          const spanStyle = resolveStyle(span.style);
          style = style.add(spanStyle);
        }
      }

      segments.push(
        new Segment(regionText, style.isNull ? undefined : style),
      );
    }

    return segments;
  }

  private *_justifyLine(
    line: Segment[],
    maxWidth: number,
    justify?: "left" | "center" | "right" | "full",
  ): Iterable<Segment> {
    const lineWidth = Segment.getLineLength(line);
    const gap = maxWidth - lineWidth;

    switch (justify) {
      case "center": {
        const leftPad = Math.floor(gap / 2);
        if (leftPad > 0) yield new Segment(" ".repeat(leftPad));
        yield* line;
        const rightPad = gap - leftPad;
        if (rightPad > 0) yield new Segment(" ".repeat(rightPad));
        break;
      }
      case "right": {
        if (gap > 0) yield new Segment(" ".repeat(gap));
        yield* line;
        break;
      }
      case "full": {
        // Full justification: distribute spaces between words
        // For now, fall through to left alignment
        yield* line;
        break;
      }
      default:
        // "left" or undefined — just yield the line as-is
        yield* line;
        break;
    }
  }

  private *_overflowLine(
    line: Segment[],
    lineWidth: number,
    maxWidth: number,
    overflow: "fold" | "crop" | "ellipsis",
    terminateLine: boolean,
  ): Iterable<Segment> {
    switch (overflow) {
      case "fold": {
        // Split at maxWidth boundaries
        const cuts: number[] = [];
        for (let w = maxWidth; w < lineWidth; w += maxWidth) cuts.push(w);
        const foldedLines = Segment.divide(line, cuts);
        for (let index = 0; index < foldedLines.length; index += 1) {
          const fLine = foldedLines[index]!;
          yield* fLine;
          if (index < foldedLines.length - 1 || terminateLine) {
            yield Segment.line();
          }
        }
        break;
      }
      case "crop": {
        const cropped = Segment.adjustLineLength(line, maxWidth, undefined, false);
        yield* cropped;
        if (terminateLine) {
          yield Segment.line();
        }
        break;
      }
      case "ellipsis": {
        if (maxWidth > 1) {
          const cropped = Segment.adjustLineLength(
            line,
            maxWidth - 1,
            undefined,
            false,
          );
          yield* cropped;
          yield new Segment("\u2026");
        }
        if (terminateLine) {
          yield Segment.line();
        }
        break;
      }
    }
  }
}
