/**
 * Terminal cell width calculation.
 * Handles ASCII, CJK (double-width), and emoji characters.
 */

import stringWidth from "string-width";

// [LAW:one-source-of-truth] string-width is the single authority for cell width
const cellLenCache = new Map<string, number>();
const CACHE_MAX = 4096;

/**
 * Returns the terminal cell width of a string.
 */
export function cellLen(text: string): number {
  if (text.length === 0) return 0;
  // Fast path for pure ASCII
  if (text.length <= 64) {
    const cached = cellLenCache.get(text);
    if (cached !== undefined) return cached;
  }
  const width = stringWidth(text);
  if (text.length <= 64) {
    if (cellLenCache.size >= CACHE_MAX) cellLenCache.clear();
    cellLenCache.set(text, width);
  }
  return width;
}

// ── Branded number spaces ────────────────────────────────────────────────────
//
// [LAW:types-are-the-program] Three distinct integer spaces coexist in terminal
// rendering. Treating any two as the same `number` is the root cause of wide-char
// and surrogate-pair bugs. Branding them makes every illegal mix-up a compile-time
// error at every crossing point.
//
// `CellCol`   — column offset in terminal cells (what the hardware counts for
//   cursor positioning / line wrapping).
// `CodeUnit`  — index in JS UTF-16 code units (what `.length`, `.slice`, and
//   array-indexing operate on; can fall mid-surrogate-pair).
// `CodePoint` — a `CodeUnit` that additionally falls on a Unicode code-point
//   boundary (never inside a surrogate pair). `CodePoint extends CodeUnit`:
//   a `CodePoint` is usable wherever `CodeUnit` is required, but a raw
//   `CodeUnit` cannot be used where `CodePoint` is required.
//
// Arithmetic on branded types produces plain `number`; re-brand with the
// factory functions only at trust boundaries.

declare const _cellCol: unique symbol;
declare const _codeUnit: unique symbol;
declare const _codePoint: unique symbol;

/** Terminal cell-column offset. Never interchangeable with a code-unit index. */
export type CellCol = number & { readonly [_cellCol]: true };

/** JS string code-unit index. Never interchangeable with a cell-column offset. */
export type CodeUnit = number & { readonly [_codeUnit]: true };

/**
 * A `CodeUnit` index that is additionally guaranteed to fall on a Unicode
 * code-point boundary (i.e. never inside a surrogate pair). Assignable to
 * `CodeUnit`; the reverse assignment is forbidden.
 */
export type CodePoint = CodeUnit & { readonly [_codePoint]: true };

/** Brand a raw number as a CellCol. Use only at trust boundaries. */
export function asCellCol(n: number): CellCol { return n as CellCol; }

/** Brand a raw number as a CodeUnit. Use only at trust boundaries. */
export function asCodeUnit(n: number): CodeUnit { return n as CodeUnit; }

/** Brand a raw number as a CodePoint. Use only when the value is known to be
 *  on a Unicode code-point boundary. */
export function asCodePoint(n: number): CodePoint { return n as CodePoint; }

// ── Cell-aware string utilities ──────────────────────────────────────────────

/**
 * Pads or crops a string to exactly `totalWidth` terminal cells.
 * Invariant: cellLen(setCellSize(text, n)) === n (unless n is 0)
 */
export function setCellSize(text: string, totalWidth: CellCol): string {
  if (totalWidth === 0) return "";
  const currentWidth = cellLen(text);
  if (currentWidth === totalWidth) return text;
  if (currentWidth < totalWidth) {
    return text + " ".repeat(totalWidth - currentWidth);
  }
  return cropToWidth(text, totalWidth);
}

/**
 * Splits text at a cell position. Returns [left, right].
 * When the position falls mid-wide-character, the left side is padded
 * to reach exactly `position` cells. The wide char remains in the right side.
 */
export function splitText(
  text: string,
  position: CellCol,
): [string, string] {
  if (position <= 0) return ["", text];
  const totalWidth = cellLen(text);
  if (position >= totalWidth) return [text, ""];

  // Walk characters tracking cell width and source char index
  let width = 0;
  let charIndex = 0;
  for (const char of text) {
    const charWidth = cellLen(char);
    if (width + charWidth > position) break;
    width += charWidth;
    charIndex += char.length;
  }

  const left = text.slice(0, charIndex);
  const right = text.slice(charIndex);

  // If we stopped short of position (mid-wide-char), pad left with spaces
  if (width < position) {
    return [left + " ".repeat(position - width), right];
  }
  return [left, right];
}

/**
 * Wraps text into lines of at most `maxWidth` cells.
 */
export function chopCells(text: string, maxWidth: CellCol): string[] {
  if (maxWidth <= 0 || text.length === 0) return [text];
  const totalWidth = cellLen(text);
  if (totalWidth <= maxWidth) return [text];

  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const remainingWidth = cellLen(remaining);
    if (remainingWidth <= maxWidth) {
      lines.push(remaining);
      break;
    }
    const [line, rest] = splitText(remaining, maxWidth);
    lines.push(line);
    remaining = rest;
  }
  return lines;
}

/**
 * Returns the largest prefix of `text` whose cell width fits within `cap` cells.
 * No padding — the returned string may be narrower than `cap` when the next
 * character is wide and would overshoot. Never wider than `cap` cells.
 *
 * When the first character already exceeds `cap` cells, returns "" (the caller
 * must decide whether to force-take the character or skip it).
 */
export function cellFit(text: string, cap: CellCol): string {
  let w = 0;
  let i = 0;
  for (const ch of text) {
    const cw = cellLen(ch);
    if (w + cw > cap) break;
    w += cw;
    i += ch.length;
  }
  return text.slice(0, i);
}

/**
 * Returns the largest code-unit offset into `content` whose prefix has
 * cell width ≤ `cellCol`. When `cellCol` falls mid-wide-character the
 * function stops before that character (never advances into it).
 * Clamps to `content.length` if `cellCol` exceeds the string's total
 * cell width.
 *
 * This is the inverse of `cellLen(content.slice(0, codeUnit))` — given a
 * visual column, return the corresponding string index.
 *
 * Returns `CodePoint` because `for...of` iteration always stops on a
 * code-point boundary.
 */
export function cellColToCodeUnitOffset(content: string, cellCol: CellCol): CodePoint {
  let w = 0;
  let i = 0;
  for (const ch of content) {
    if (w >= cellCol) break;
    const cw = cellLen(ch);
    if (w + cw > cellCol) break;
    w += cw;
    i += ch.length;
  }
  return asCodePoint(i);
}

/**
 * Advance one full Unicode code point from `cu`, returning the code-unit
 * offset of the start of the *next* code point. Returns `s.length` when
 * already at or past the end.
 *
 * Handles surrogate pairs: when the code point at `cu` is a supplementary
 * character (U+10000…U+10FFFF) it occupies 2 UTF-16 code units, so the
 * returned offset advances by 2.
 */
export function nextCodePoint(s: string, cu: CodeUnit): CodePoint {
  if (cu >= s.length) return asCodePoint(s.length);
  const cp = s.codePointAt(cu)!;
  return asCodePoint(cu + (cp > 0xFFFF ? 2 : 1));
}

/**
 * Step back one full Unicode code point from `cu`, returning the code-unit
 * offset of the start of the *previous* code point. Returns 0 when already
 * at the start.
 *
 * Handles surrogate pairs: when the code unit at `cu - 1` is a low
 * surrogate (the trailing half of a pair), steps back 2 code units.
 */
export function prevCodePoint(s: string, cu: CodeUnit): CodePoint {
  if (cu <= 0) return asCodePoint(0);
  const prevCU = s.charCodeAt(cu - 1);
  return asCodePoint(cu - (prevCU >= 0xDC00 && prevCU <= 0xDFFF ? 2 : 1));
}

// --- internal ---

function cropToWidth(text: string, targetWidth: number): string {
  let width = 0;
  let i = 0;
  // Use the string's code point iterator to handle surrogate pairs
  for (const char of text) {
    const charWidth = cellLen(char);
    if (width + charWidth > targetWidth) break;
    width += charWidth;
    i += char.length;
  }
  const cropped = text.slice(0, i);
  // Pad if we couldn't hit the exact width (wide char boundary)
  const diff = targetWidth - width;
  return diff > 0 ? cropped + " ".repeat(diff) : cropped;
}
