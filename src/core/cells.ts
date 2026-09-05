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

/**
 * [LAW:parse-dont-validate] A caller's number as a count of cells — the checked
 * counterpart to `asCellCol`'s unchecked brand, and the one place the rule "a
 * cell count is a non-negative integer" is written.
 *
 * [LAW:one-source-of-truth] Every renderable is handed `RenderOptions.maxWidth`
 * as a plain `number`, so every renderable used to answer this for itself and
 * they disagreed: at NaN, `Table` collapsed to one cell of garbage, `Columns`
 * and `Layout` threw `Invalid array length`, and `RichText` ignored the request
 * and emitted its full natural width. Parse at the entry to `render`/`measure`
 * and nothing downstream re-asks.
 *
 * The comparison is the point, not `Math.max(0, n)`: NaN fails every comparison
 * and so floors here, where `Math.max` would return it and let it poison every
 * bounds check downstream. Integral because a cell is not divisible — a
 * fractional budget reaches a largest-remainder division, which grants a whole
 * cell against a fractional residue and hands out more width than it was given.
 *
 * `Infinity` is outside what the comparison floors, so it passes through
 * unchanged, and no clamp belongs here: the finite answer to an unbounded offer
 * is the renderable's own natural width, which this function cannot see from
 * the number alone. `withBoundedWidth` in `protocol.ts` is the second half of
 * the parse and the only place that value is resolved.
 */
export function cellCount(n: number): CellCol {
  return (n > 0 ? Math.floor(n) : 0) as CellCol;
}

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
 * Wraps text into lines of at most `maxWidth` cells, preserving every code
 * point: `chopCells(t, w).join("") === t`. Unlike `splitText` this never pads,
 * so a line ending before a wide glyph is narrower than `maxWidth` rather than
 * padded out to it.
 *
 * A line overflows exactly where the budget cannot be met: a glyph wider than
 * `maxWidth` is force-taken whole rather than dropped, and a `maxWidth` of zero
 * or less is no budget at all, so the text comes back as one line.
 */
export function chopCells(text: string, maxWidth: CellCol): string[] {
  if (maxWidth <= 0 || text.length === 0) return [text];

  const lines: string[] = [];
  let start = asCodePoint(0);
  while (start < text.length) {
    const end = cellStepFrom(text, start, maxWidth);
    lines.push(text.slice(start, end));
    start = end;
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
 * Returns the largest code-unit end offset starting from `startCU` whose
 * prefix (from `startCU`) has cell width ≤ `cap`. Iterates from the given
 * offset without slicing the tail, avoiding O(N²) allocation when called
 * repeatedly across a long string.
 *
 * [LAW:types-are-the-program] returns CodePoint because for...of always
 * stops on a code-point boundary.
 */
export function cellFitFrom(text: string, startCU: CodePoint, cap: CellCol): CodePoint {
  let w = 0;
  let i: CodePoint = startCU;
  while (i < text.length) {
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const cw = cellLen(ch);
    if (w + cw > cap) break;
    w += cw;
    i = asCodePoint(i + ch.length);
  }
  return i;
}

/**
 * Like `cellFitFrom`, but never returns `startCU`: a glyph too wide for `cap`
 * is force-taken whole, overflowing `cap` by its own width. So a loop walking
 * to `text.length` terminates by construction, and the re-brand is honest —
 * both operands land on code-point boundaries, so their max does too.
 *
 * [LAW:single-enforcer] `cellFit` documents that its caller must choose between
 * force-taking and skipping; this is that choice, made once. It was made twice
 * before and the copies drifted — the textarea's soft wrap force-took,
 * `chopCells` did neither and hung.
 */
export function cellStepFrom(text: string, startCU: CodePoint, cap: CellCol): CodePoint {
  return asCodePoint(Math.max(cellFitFrom(text, startCU, cap), nextCodePoint(text, startCU)));
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
 * Handles surrogate pairs: when the code unit at `cu - 1` is a low surrogate
 * AND the code unit at `cu - 2` is a high surrogate, steps back 2 code units.
 * Unpaired surrogates are treated as 1-CU characters.
 */
export function prevCodePoint(s: string, cu: CodeUnit): CodePoint {
  if (cu <= 0) return asCodePoint(0);
  const low = s.charCodeAt(cu - 1);
  if (low >= 0xDC00 && low <= 0xDFFF && cu >= 2) {
    const high = s.charCodeAt(cu - 2);
    if (high >= 0xD800 && high <= 0xDBFF) return asCodePoint(cu - 2);
  }
  return asCodePoint(cu - 1);
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
