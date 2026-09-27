/**
 * Viewport — a fixed number of rows onto a taller renderable, scrolled by an
 * offset that cannot leave the content.
 *
 * Its rows, under the `Height` contract in `../core/protocol.ts`: the region's
 * when it is given one; otherwise its own configured rows, or the content's
 * full length when it has none, capped by any ceiling. It renders its content
 * with no height, because the content's natural length is the scroll extent,
 * and pads or crops what comes back to its rows — its rows are its own height,
 * not a region someone else will shape.
 *
 * Its width is the width it is given, in both directions: each row is cropped
 * or padded to it, so content that ignores its width cannot spill past the
 * viewport's edge and the scrollbar, drawn in a gutter at that edge, sits in
 * one column. [LAW:dataflow-not-control-flow] A viewport with no scrollbar
 * has a gutter zero cells wide, and every row takes the same path either way.
 *
 * [LAW:no-ambient-temporal-coupling] Neither half of what an offset is clamped
 * against exists before a render: the rows come from the budget the render is
 * handed, and the content's length from rendering it at the width it is handed.
 * So `scrollTo`, `scrollBy` and `ensureVisible` do not move anything when they
 * are called. Each queues a move, and the next render resolves the queue in
 * call order, clamping after every move, against the rows and length that
 * render found. Calling an operation before the first render, or three of them
 * between two renders, is the same code path as calling one.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import { cellCount, cellLen } from "../core/cells.js";
import { NULL_STYLE } from "../core/style.js";
import type { Style } from "../core/style.js";
import {
  fitHeight,
  getStyle,
  isMeasurable,
  regionRows,
  withBoundedWidth,
  withCellWidth,
} from "../core/protocol.js";
import type {
  Height,
  Measurable,
  Renderable,
  RenderOptions,
} from "../core/protocol.js";

/** What a render found: the rows it shows, and the lines of content behind them. */
interface Extent {
  readonly rows: number;
  readonly lines: number;
}

/** One requested change of offset, resolved against the extent the next render finds. */
type Move = (offset: number, extent: Extent) => number;

/** How one part of a scrollbar draws each row it covers. */
export interface ScrollbarPart {
  readonly glyph: string;
  /** A style, or a theme name resolved when the viewport renders. */
  readonly style: string | Style;
}

/**
 * The look of a scrollbar: the thumb, over the rows of the track that stand for
 * the lines in view, and the track, over the rest. Its gutter is as wide as the
 * wider of the two glyphs.
 */
export interface Scrollbar {
  readonly thumb: ScrollbarPart;
  readonly track: ScrollbarPart;
}

/** A heavy line for the thumb on a light line for the track. */
export const SCROLLBAR: Scrollbar = {
  thumb: { glyph: "┃", style: "scrollbar.thumb" },
  track: { glyph: "│", style: "scrollbar.track" },
};

/** The absence of a scrollbar, as a gutter zero cells wide. */
const NO_SCROLLBAR: Scrollbar = {
  thumb: { glyph: "", style: NULL_STYLE },
  track: { glyph: "", style: NULL_STYLE },
};

export interface ViewportOptions {
  /**
   * The rows shown when the viewport is given no region. Absent, it shows the
   * content's full length. A ceiling caps either.
   */
  rows?: number;
  /** A scrollbar down the right edge. Absent, the content has the full width. */
  scrollbar?: Scrollbar;
}

export class Viewport implements Renderable, Measurable {
  /**
   * What the viewport shows. Replace it to show new content from the same
   * scroll position — a view rebuilt every frame keeps one `Viewport`.
   */
  content: Renderable;
  readonly rows: number | undefined;
  readonly scrollbar: Scrollbar;
  private _offset = 0;
  private _moves: Move[] = [];

  constructor(content: Renderable, options: ViewportOptions = {}) {
    this.content = content;
    this.rows = options.rows;
    this.scrollbar = options.scrollbar ?? NO_SCROLLBAR;
  }

  /**
   * The first content line the last render showed. A move requested since is
   * not reflected until the next render resolves it.
   */
  get offset(): number {
    return this._offset;
  }

  /** Scroll so `line` is the first line shown. */
  scrollTo(line: number): void {
    this._moves.push(() => line);
  }

  /** Scroll by `lines`: down when positive, up when negative. */
  scrollBy(lines: number): void {
    this._moves.push((offset) => offset + lines);
  }

  /**
   * Scroll the least distance that shows lines `start` up to but not
   * including `end` — lines of the content as it renders at the viewport's
   * width, so an item that wraps spans more than one. A range already in view does not move; one taller than
   * the viewport shows its first line at the top.
   */
  ensureVisible(start: number, end: number): void {
    this._moves.push((offset, { rows }) => Math.min(start, Math.max(offset, end - rows)));
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const { height, ...options } = withBoundedWidth(rawOptions, this);
    const gutter = gutterWidth(this.scrollbar);
    const contentWidth = cellCount(options.maxWidth - gutter);
    const lines = Segment.splitLines(this.content.render({ ...options, maxWidth: contentWidth }));
    const extent: Extent = { rows: viewRows(height, this.rows, lines.length), lines: lines.length };
    // [LAW:dataflow-not-control-flow] The resolved offset is re-clamped every
    // render with or without queued moves: content that shrank since the last
    // render pulls the offset back with it.
    this._offset = this._moves.reduce(
      (offset, move) => clampOffset(move(offset, extent), extent),
      clampOffset(this._offset, extent),
    );
    this._moves = [];

    const shown = fitHeight(lines.slice(this._offset, this._offset + extent.rows), { rows: extent.rows, exact: true });
    // [LAW:no-ambient-temporal-coupling] The thumb is drawn from the offset
    // this render just resolved, not from `offset` as it stood before it.
    const thumb = thumbRows(extent, this._offset);
    const cell = ({ glyph, style }: ScrollbarPart): Segment[] =>
      Segment.adjustLineLength([new Segment(glyph, getStyle(options, style))], gutter);
    const thumbCell = cell(this.scrollbar.thumb);
    const trackCell = cell(this.scrollbar.track);
    for (const [row, line] of shown.entries()) {
      const bar = row >= thumb.start && row < thumb.end ? thumbCell : trackCell;
      // A gutter wider than the whole offer is cropped with the row, so the
      // viewport never draws past the width it was given.
      yield* Segment.adjustLineLength([...Segment.adjustLineLength(line, contentWidth), ...bar], options.maxWidth);
      yield Segment.line();
    }
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // Its width is its content's and its gutter's. `withCellWidth` and not
    // `withBoundedWidth`: the bounded parse asks this very method for the
    // natural width.
    const options = withCellWidth(rawOptions);
    const gutter = gutterWidth(this.scrollbar);
    const inner = { ...options, maxWidth: cellCount(options.maxWidth - gutter) };
    const content = isMeasurable(this.content)
      ? Measurement.get(inner, this.content)
      : new Measurement(Math.min(1, inner.maxWidth), inner.maxWidth);
    return new Measurement(content.minimum + gutter, content.maximum + gutter).withMaximum(options.maxWidth);
  }
}

/** The cells a scrollbar's gutter takes from the content: its wider glyph. */
function gutterWidth({ thumb, track }: Scrollbar): number {
  return Math.max(cellLen(thumb.glyph), cellLen(track.glyph));
}

/**
 * The rows of the track the thumb covers, from `start` up to but not including
 * `end`: its length is the share of the content in view, and its position the
 * share of the scroll travelled, so it touches the top at the first line and
 * the bottom at the last full view. Content that fits fills the track.
 */
function thumbRows({ rows, lines }: Extent, offset: number): { start: number; end: number } {
  const size = Math.min(rows, Math.max(1, Math.round((rows * rows) / Math.max(lines, rows, 1))));
  const start = Math.round((offset * (rows - size)) / Math.max(1, lines - rows));
  return { start, end: start + size };
}

/** The rows a viewport shows, from its budget, its own configured rows, and its content's length. */
function viewRows(height: Height | undefined, rows: number | undefined, lines: number): number {
  return regionRows(height) ?? cellCount(Math.min(rows ?? lines, height?.rows ?? Infinity));
}

/** An offset held to the lines that exist: never above the first, never past the last full view. */
function clampOffset(offset: number, { rows, lines }: Extent): number {
  return cellCount(Math.min(offset, lines - rows));
}
