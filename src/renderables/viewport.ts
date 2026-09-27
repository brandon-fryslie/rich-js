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
import { cellCount } from "../core/cells.js";
import {
  fitHeight,
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

export interface ViewportOptions {
  /**
   * The rows shown when the viewport is given no region. Absent, it shows the
   * content's full length. A ceiling caps either.
   */
  rows?: number;
}

export class Viewport implements Renderable, Measurable {
  /**
   * What the viewport shows. Replace it to show new content from the same
   * scroll position — a view rebuilt every frame keeps one `Viewport`.
   */
  content: Renderable;
  readonly rows: number | undefined;
  private _offset = 0;
  private _moves: Move[] = [];

  constructor(content: Renderable, options: ViewportOptions = {}) {
    this.content = content;
    this.rows = options.rows;
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
    const lines = Segment.splitLines(this.content.render(options));
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
    for (const line of shown) {
      yield* line;
      yield Segment.line();
    }
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // A viewport changes nothing horizontally, so its width is its content's.
    // `withCellWidth` and not `withBoundedWidth`: the bounded parse asks this
    // very method for the natural width.
    const options = withCellWidth(rawOptions);
    if (!isMeasurable(this.content)) {
      return { minimum: Math.min(1, options.maxWidth), maximum: options.maxWidth };
    }
    return Measurement.get(options, this.content);
  }
}

/** The rows a viewport shows, from its budget, its own configured rows, and its content's length. */
function viewRows(height: Height | undefined, rows: number | undefined, lines: number): number {
  return regionRows(height) ?? cellCount(Math.min(rows ?? lines, height?.rows ?? Infinity));
}

/** An offset held to the lines that exist: never above the first, never past the last full view. */
function clampOffset(offset: number, { rows, lines }: Extent): number {
  return cellCount(Math.min(offset, lines - rows));
}
