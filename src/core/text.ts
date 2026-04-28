/**
 * RichText — styled text with spans. The primary text type for the library.
 */

import { cellLen } from "./cells.js";
import { Segment } from "./segment.js";
import { Style, NULL_STYLE, StyleSyntaxError } from "./style.js";
import type { Renderable, Measurable, RenderOptions } from "./protocol.js";

// Strip control characters except \t and \n
// [LAW:single-enforcer] Single place where control chars are sanitized
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS_RE, "");
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") {
    try {
      return Style.parse(style);
    } catch (err) {
      // [LAW:single-enforcer] Styling is non-critical — an unrecognized style
      // name (typo, missing theme key, bad concatenation) degrades to unstyled
      // rather than crashing. Absorb only StyleSyntaxError at this trust
      // boundary; other errors are genuine bugs and must surface.
      if (err instanceof StyleSyntaxError) return NULL_STYLE;
      throw err;
    }
  }
  return style;
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
    this._style = value;
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

  truncate(width: number, options?: { overflow?: "fold" | "crop" | "ellipsis" }): this {
    if (this.cellLength <= width) return this;
    const overflow = options?.overflow ?? "crop";

    if (overflow === "ellipsis" && width > 0) {
      // Truncate to width-1 and append ellipsis
      this._truncateToWidth(width - 1);
      this._text += "\u2026";
    } else {
      this._truncateToWidth(width);
    }

    return this;
  }

  private _truncateToWidth(targetWidth: number): void {
    let width = 0;
    let charIndex = 0;
    for (const char of this._text) {
      const charWidth = cellLen(char);
      if (width + charWidth > targetWidth) break;
      width += charWidth;
      charIndex += char.length;
    }
    this.plain = this._text.slice(0, charIndex);
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
