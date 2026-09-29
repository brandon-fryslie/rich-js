/**
 * Columns — arranges renderables in a multi-column layout.
 *
 * A port of Rich's `Columns`. What it decides is how many columns, and which
 * item goes in which cell. Everything after that — how wide each column is, how
 * far apart, what `expand` does, how rows are separated — is the grid's: the
 * items are laid out as a `Table.grid` with `collapsePadding` and no
 * `padEdge`, as the reference lays them out.
 * [LAW:one-source-of-truth] A second copy of that geometry here is how the two
 * drifted: an empty item's column was drawn with no width where the grid draws one cell.
 */

import type { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { cellCount } from "../core/cells.js";
import { embed } from "./embed.js";
import { Constrain } from "./constrain.js";
import { Table } from "./table.js";

export interface ColumnsOptions {
  expand?: boolean;
  equal?: boolean;
  width?: number;
  padding?: PaddingDimensions;
  columnFirst?: boolean;
}

/**
 * The item in slot `slot` of the grid for `count` columns, counting row by row;
 * `undefined` is a slot no item fills. Constant time, so a search that stops at
 * the first slot that overflows pays for no slot after it.
 */
function slotItem(slot: number, items: number, count: number, columnFirst: boolean): number | undefined {
  const row = Math.floor(slot / count);
  const col = slot % count;
  // Column-first fills each column top to bottom, and the columns that take one
  // item more than the rest are the leading ones — Rich's `column_lengths`.
  const base = Math.floor(items / count);
  const extra = items % count;
  const length = base + (col < extra ? 1 : 0);
  const index = !columnFirst ? slot : row < length ? col * base + Math.min(col, extra) + row : items;
  return index < items ? index : undefined;
}

/** How many slots the grid for `count` columns has: every row full, the last one padded. */
function slotCount(items: number, count: number): number {
  return Math.ceil(items / count) * count;
}

/** The grid for one width: its column count and the item in each cell, row by row. */
interface Layout {
  readonly columns: number;
  /** Item indices, one array per row, `columns` slots each; `undefined` is an empty cell. */
  readonly rows: (number | undefined)[][];
  /** The widest any item is counted, which `equal` holds every item to. */
  readonly widest: number;
}

export class Columns implements Renderable, Measurable {
  renderables: (Renderable & Partial<Measurable>)[];
  readonly expand: boolean;
  readonly equal: boolean;
  readonly colWidth: number | undefined;
  readonly columnFirst: boolean;
  private readonly padding: [number, number, number, number];

  constructor(items?: Iterable<unknown>, options?: ColumnsOptions) {
    this.renderables = items ? [...items].map(embed) : [];
    this.expand = options?.expand ?? false;
    this.equal = options?.equal ?? false;
    // A declared column width is a cell count like any other, and it reaches
    // the layout without passing through `withCellWidth`, which parses only
    // what the *caller of render* supplied. Left raw, `width: NaN` made
    // `Math.max(1, NaN)` a NaN column count and `new Array` threw `Invalid
    // array length` before a single column was laid out. Absence is preserved
    // rather than parsed: `undefined` selects auto-fit, and `cellCount` would
    // read it as a declared zero.
    this.colWidth = options?.width === undefined ? undefined : cellCount(options.width);
    this.columnFirst = options?.columnFirst ?? false;
    // [LAW:parse-dont-validate] Rich's default is `(0, 1)`: one cell between
    // columns and none between rows.
    this.padding = normalizePadding(options?.padding ?? [0, 1]);
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    if (this.renderables.length === 0) return;

    // The parsed options, not just a parsed local: `_layout` hands them to
    // `Measurement.get`, and a raw NaN reaching it comes back as a NaN item
    // width, then a NaN column count, then `Invalid array length` before a
    // single column is laid out. An unbounded width reaches the same place by
    // the same route, which is why the parse here is the bounded one.
    const options = withBoundedWidth(rawOptions, this);
    yield* this._grid(options).render(options);
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // The maximum is the grid's, which reports its width before `expand`: a
    // stretch is what a Columns does with a width it is given, not a width it
    // asks for. Reported as the offer instead, `Panel` in fit mode drew a
    // 40-cell frame around five cells of content and an unbounded offer came
    // back unbounded.
    //
    // A floor of one cell is what Columns asks for, since it can always fall
    // back to one column, and the ceiling wins: a bare `minimum: 1` measured
    // into no width at all reported the range 1..0 — a floor above its own
    // ceiling, which the parent that asked cannot divide.
    const parsed = withCellWidth(rawOptions);
    if (this.renderables.length === 0) return { minimum: 0, maximum: 0 };
    const { maximum } = this._grid(parsed).measure(parsed);
    return { minimum: Math.min(1, maximum), maximum };
  }

  /**
   * The items at the width offered, as the reference's grid: `_layout`'s
   * cells in a `Table.grid` with `collapsePadding` and no `padEdge`.
   *
   * [LAW:single-enforcer] `render` draws this and `measure` reports its width,
   * so the two cannot disagree about how wide a Columns is.
   *
   * A declared `width` is each column's natural width rather than a Table
   * column `width`, which this port never stretches: the reference's grid
   * stretches a Columns' declared width under `expand` like any other.
   * `equal` holds every item to the widest, Rich's `Constrain`; without it
   * the cap is `undefined` and holds nothing.
   */
  private _grid(options: RenderOptions): Table {
    const { columns, rows, widest } = this._layout(options);
    const grid = Table.grid({
      padding: this.padding,
      collapsePadding: true,
      padEdge: false,
      expand: this.expand,
    });
    const declared = this._declaredWidth(options);
    for (let col = 0; col < columns; col++) {
      grid.addColumn(undefined, { minWidth: declared, maxWidth: declared });
    }
    const cap = this.equal ? widest : undefined;
    for (const row of rows) {
      grid.addRow(...row.map((index) => (index === undefined ? "" : new Constrain(this.renderables[index]!, cap))));
    }
    return grid;
  }

  /**
   * How many columns fit the width offered, and which item goes in each cell,
   * decided the way Rich's `Columns` decides them.
   *
   * Every item carries a width. It is what the item measures, or the declared
   * `width` for all of them. `equal` counts every item as the widest when
   * choosing how many columns fit, and the grid still sizes each column by
   * what is in it — which is why an `equal` layout is not a grid of equal
   * columns, in the reference or here.
   *
   * The count starts at one column per item and drops whenever the columns
   * filled so far, and the gaps between them, pass the width offered. Two
   * columns stand the wider of the padding's left and right sides apart, which
   * is what the collapsed grid leaves between them. One departure from the
   * reference: a declared `width` is searched the same way rather than by
   * `max_width // (width + gap)`, which laid out empty trailing columns and
   * charged the last column a gap it does not have.
   */
  private _layout(options: RenderOptions): Layout {
    const count = this.renderables.length;
    const maxWidth = options.maxWidth;
    const [, right, , left] = this.padding;
    const gap = Math.max(left, right);

    const declared = this._declaredWidth(options);
    const sizes = this.renderables.map((item) => declared ?? this._itemWidth(item, options));
    // A fold, not `Math.max(...sizes)`: spreading one argument per item
    // overflows the call stack at a few hundred thousand items.
    const widest = sizes.reduce((w, size) => Math.max(w, size), 0);
    const fits = this.equal ? sizes.map(() => widest) : sizes;

    // One attempt either fits in the offer or names the smaller count to try
    // next. `total` is the columns so far and the gaps between them, kept as
    // the widths grow so that a slot costs the same however many columns came
    // before it.
    const attempt = (columns: number): number => {
      const widths: number[] = [];
      let total = 0;
      for (let slot = 0; slot < slotCount(count, columns); slot++) {
        const col = slot % columns;
        const index = slotItem(slot, count, columns, this.columnFirst);
        const held = widths[col];
        const width = Math.max(held ?? 0, index === undefined ? 0 : fits[index]!);
        total += width - (held ?? 0) + (held === undefined && col > 0 ? gap : 0);
        widths[col] = width;
        // Never zero: no item measures wider than the offer, so the first
        // column alone always fits.
        if (total > maxWidth) return widths.length - 1;
      }
      return columns;
    };
    let columns = count;
    for (let next = attempt(columns); next < columns; next = attempt(columns)) columns = next;

    const rows = Array.from({ length: slotCount(count, columns) / columns }, (_, row) =>
      Array.from({ length: columns }, (_, col) =>
        slotItem(row * columns + col, count, columns, this.columnFirst),
      ),
    );
    return { columns, rows, widest };
  }

  /**
   * The widest one item wants to be.
   *
   * An item that cannot measure itself wants the offer, which is what `Panel`,
   * `Padding`, `Layout` and `Tree` all answer for the same case — and under an
   * unbounded offer that is `Infinity`, so `withBoundedWidth` throws and says
   * the request was unanswerable. Counting it as one cell instead reported a
   * natural width of 1, which resolved an unbounded offer to a single column and
   * cropped forty cells of content down to `"x"` with no error at all.
   */
  private _itemWidth(item: Renderable & Partial<Measurable>, options: RenderOptions): number {
    return isMeasurable(item) ? Measurement.get(options, item).maximum : options.maxWidth;
  }

  /**
   * The declared column width, bounded by the width offered.
   *
   * A declared width is what a column asks for, not what it takes — the
   * contract `Table._outerWidth` keeps for a declared table width. Laid out at
   * the raw declared width, a six-cell column offered three emitted six-cell
   * lines while `measure` reported three, and the terminal's soft wrap took the
   * frame of everything printed after it.
   */
  private _declaredWidth(options: RenderOptions): number | undefined {
    return this.colWidth === undefined ? undefined : Math.min(this.colWidth, options.maxWidth);
  }
}
