/**
 * Terminal cell width calculation.
 * Handles ASCII, CJK (double-width), and emoji characters.
 */

import stringWidth from "string-width";
import { Memo } from "./memo.js";

// [LAW:one-source-of-truth] string-width is the single authority for cell width
const cellLenMemo = new Memo<number>();

/**
 * Returns the terminal cell width of a string.
 */
export function cellLen(text: string): number {
  if (text.length === 0) return 0;
  // Short strings recur (words, cells, labels); a long one is rarely measured twice.
  return text.length <= 64 ? cellLenMemo.get(text, stringWidth) : stringWidth(text);
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
  return splitText(text, totalWidth)[0];
}

/**
 * Splits text at a cell position. Returns [left, right].
 * When the position falls mid-wide-character, the left side is padded
 * to reach exactly `position` cells. The wide char remains in the right side.
 *
 * [LAW:one-source-of-truth] The left side is `cellFit`'s, so the cut falls
 * between the grapheme clusters `cellLen` measures and never inside one.
 */
export function splitText(
  text: string,
  position: CellCol,
): [string, string] {
  if (position <= 0) return ["", text];
  if (position >= cellLen(text)) return [text, ""];
  const left = cellFit(text, position);
  return [left + " ".repeat(position - cellLen(left)), text.slice(left.length)];
}

/**
 * Cuts `text` into exactly `position` cells and the rest, as the reference's
 * `Segment.split_cells` does: a wide glyph the cut goes through fits neither
 * side, so it leaves a space in each of its cells, where `splitText` keeps it
 * whole on the right. Every other character lands on exactly one side.
 * `position` must fall inside `text`, between 0 and its width.
 */
export function cutCells(text: string, position: CellCol): [string, string] {
  const head = cellFit(text, position);
  // Cells of the glyph the cut goes through that lie left of it; 0 when the
  // cut falls between glyphs, and then there is no such glyph.
  const straddle = position - cellLen(head);
  const [glyph = ""] = straddle > 0 ? clustersFrom(text, asCodePoint(head.length)) : [];
  return [
    head + " ".repeat(straddle),
    " ".repeat(cellLen(glyph) - straddle) + text.slice(head.length + glyph.length),
  ];
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
 * `line` split at each of `cuts`, in one walk over it. Converting each cut to a
 * code-unit offset on its own rescans the line from the start every time, which
 * is quadratic in a long enough string.
 */
export function splitAtCells(line: string, cuts: readonly CellCol[]): string[] {
  const pieces: string[] = [];
  let start = 0;
  let offset = 0;
  let cells = 0;
  for (const ch of graphemes(line)) {
    if (pieces.length < cuts.length && cells >= cuts[pieces.length]!) {
      pieces.push(line.slice(start, offset));
      start = offset;
    }
    cells += cellLen(ch);
    offset += ch.length;
  }
  return [...pieces, line.slice(start)];
}

// [LAW:no-shared-mutable-globals] Private memos, written only by `segmentsOf`:
// the segmenter, and the segmentation of the last string walked, so a caller
// stepping along one string does not re-segment the whole of it every step.
let segmenter: Intl.Segmenter | undefined;
let lastSegmented: { text: string; segments: Intl.Segments } | undefined;

/** The grapheme segmentation of `text`, reusing the last one when it is the same string. */
function segmentsOf(text: string): Intl.Segments {
  if (lastSegmented?.text !== text) {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
    lastSegmented = { text, segments: segmenter.segment(text) };
  }
  return lastSegmented.segments;
}

/**
 * The grapheme clusters of `text`, in order: the unit `string-width` measures,
 * and so the unit `cellLen` of a whole string is the sum of. Summing `cellLen`
 * over code points instead disagrees with it on every glyph built from several:
 * `❤️` is 1 + 0 by code point and 2 as a cluster, `👨‍👩‍👧` is 6 and 2, and a cut
 * between two of its code points leaves half a glyph.
 */
export function graphemes(text: string): string[] {
  return Array.from(clustersFrom(text, asCodePoint(0)));
}

/**
 * The clusters of `text` from code unit `start` on, lazily, so a walk that
 * stops early pays only for the clusters it reads.
 */
function* clustersFrom(text: string, start: CodePoint): Generator<string> {
  const segments = segmentsOf(text);
  for (let at = start, s = segments.containing(at); s; s = segments.containing(at)) {
    const end = s.index + s.segment.length;
    yield text.slice(at, end);
    at = asCodePoint(end);
  }
}

/**
 * Returns the largest prefix of `text` whose cell width fits within `cap` cells,
 * cut between grapheme clusters. No padding — the returned string may be
 * narrower than `cap` when the next glyph is wide and would overshoot. Never
 * wider than `cap` cells.
 *
 * When the first glyph already exceeds `cap` cells, returns "" (the caller
 * must decide whether to force-take the glyph or skip it).
 */
export function cellFit(text: string, cap: CellCol): string {
  return text.slice(0, fitLength(clustersFrom(text, asCodePoint(0)), cap));
}

/** `cellFit` from the other end: the largest suffix of `text` within `cap` cells. */
export function cellFitEnd(text: string, cap: CellCol): string {
  return text.slice(text.length - fitLength(graphemes(text).reverse(), cap));
}

/** The code units of the leading `clusters` that fit within `cap` cells. */
function fitLength(clusters: Iterable<string>, cap: CellCol): number {
  let w = 0;
  let n = 0;
  for (const cluster of clusters) {
    const cw = cellLen(cluster);
    if (w + cw > cap) break;
    w += cw;
    n += cluster.length;
  }
  return n;
}

/**
 * Returns the largest code-unit end offset starting from `startCU` whose
 * prefix (from `startCU`) has cell width ≤ `cap`. Iterates from the given
 * offset without slicing the tail, avoiding O(N²) allocation when called
 * repeatedly across a long string.
 *
 * [LAW:types-are-the-program] returns CodePoint because it stops between
 * grapheme clusters, and every cluster boundary is a code-point boundary.
 */
export function cellFitFrom(text: string, startCU: CodePoint, cap: CellCol): CodePoint {
  return asCodePoint(startCU + fitLength(clustersFrom(text, startCU), cap));
}

/**
 * Like `cellFitFrom`, but for any `startCU` inside `text` the result is
 * strictly past it: a glyph too wide for `cap` is force-taken whole and
 * overflows `cap` by its own width. So a `while (i < text.length)` loop driven
 * by this terminates by construction, and the re-brand is honest — both
 * operands land on code-point boundaries, so their max does too.
 *
 * [LAW:single-enforcer] `cellFit` documents that its caller must choose between
 * force-taking and skipping; this is that choice, made once. It was made twice
 * before and the copies drifted — the textarea's soft wrap force-took,
 * `chopCells` did neither and hung.
 */
export function cellStepFrom(text: string, startCU: CodePoint, cap: CellCol): CodePoint {
  const [first = ""] = clustersFrom(text, startCU);
  return asCodePoint(Math.max(cellFitFrom(text, startCU, cap), startCU + first.length));
}

/**
 * The code-unit offset a visual column falls at: the end of the largest
 * prefix of `content` within `cellCol` cells, so a column inside a wide glyph
 * lands before it. The inverse of `cellLen(content.slice(0, offset))`.
 */
export function cellColToCodeUnitOffset(content: string, cellCol: CellCol): CodePoint {
  return cellFitFrom(content, asCodePoint(0), cellCol);
}

/**
 * The offset just past the grapheme cluster at `cu`: one step of a cursor, a
 * Delete, a transposition, so `👍🏽` or `👨‍👩‍👧` moves and goes as the one
 * glyph `cellLen` measures, never a code point at a time. `cu` is a cluster
 * boundary in `s` (see `graphemeBoundary`); `s.length` gives `s.length`.
 */
export function nextGrapheme(s: string, cu: CodePoint): CodePoint {
  const [cluster = ""] = clustersFrom(s, cu);
  return asCodePoint(cu + cluster.length);
}

/** `nextGrapheme` backwards: the start of the cluster ending at `cu`; 0 at the start. */
export function prevGrapheme(s: string, cu: CodePoint): CodePoint {
  if (cu <= 0) return asCodePoint(0);
  return asCodePoint(segmentsOf(s).containing(cu - 1)!.index);
}

/**
 * Where an offset into `s` comes to rest as a cursor: itself when it is a
 * cluster boundary, else the end of the cluster it falls inside, and never
 * past `s.length`. The one parse from any number to the boundaries
 * `nextGrapheme` and `prevGrapheme` step between.
 */
export function graphemeBoundary(s: string, cu: CodeUnit): CodePoint {
  const at = Math.min(cu, s.length);
  const cluster = segmentsOf(s).containing(at);
  return asCodePoint(cluster === undefined || cluster.index === at ? at : cluster.index + cluster.segment.length);
}

declare const _tabSize: unique symbol;
/** Cells between tab stops: a positive integer, so every stop is a column. */
export type TabSize = number & { readonly [_tabSize]: true };

/**
 * `n` as a `TabSize`, or a `RangeError` naming it. Rich divides by the tab
 * size and raises on 0; here the value is refused where it is given, not at
 * the first tab it meets.
 */
export function parseTabSize(n: number): TabSize {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`tabSize must be a positive integer, got ${n}`);
  }
  return n as TabSize;
}

/** Text with its tabs expanded, and where each offset into the original went. */
export interface TabExpansion {
  readonly text: string;
  offsetOf(offset: number): number;
}

/**
 * `text` with each tab widened to the next tab stop — a multiple of `tabSize`
 * cells from the start of its line — as Rich's `Text.expand_tabs` widens it, and
 * `offsetOf`, where each code-unit offset into `text` lands in the result.
 *
 * A tab is a column position, not a run of spaces: one that already sits a
 * cell short of a stop widens to a single space. `offsetOf` is there because a
 * caller that annotates the text by offset — a `RichText`'s spans — has to move
 * its offsets with the characters, or every annotation after a tab lands short
 * of what it styled.
 */
export function expandTabs(text: string, tabSize: TabSize): TabExpansion {
  const [head, ...rest] = text.split("\t");
  const tabAt: number[] = []; // offset of each tab in `text`
  const grownBy: number[] = []; // code units added by this tab and every one before it
  const columnAfter = (piece: string, column: number): number => {
    const newline = piece.lastIndexOf("\n");
    return (newline < 0 ? column : 0) + cellLen(piece.slice(newline + 1));
  };

  // A piece's column is read only when a tab follows it, so text with no tab
  // costs one `split` and no measuring.
  let expanded = head!;
  let before = head!; // the piece the next tab follows
  let column = 0; // the column `before` starts at
  let offset = head!.length;
  let grown = 0;
  for (const piece of rest) {
    column = columnAfter(before, column);
    const spaces = tabSize - (column % tabSize);
    grown += spaces - 1;
    tabAt.push(offset);
    grownBy.push(grown);
    expanded += " ".repeat(spaces) + piece;
    column += spaces;
    before = piece;
    offset += 1 + piece.length;
  }

  // An offset moves by what every tab before it grew: the count of tabs at
  // offsets below it, found by bisection since `tabAt` ascends.
  const offsetOf = (at: number): number => {
    let low = 0;
    let high = tabAt.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (tabAt[mid]! < at) low = mid + 1;
      else high = mid;
    }
    return at + (low === 0 ? 0 : grownBy[low - 1]!);
  };
  return { text: expanded, offsetOf };
}
