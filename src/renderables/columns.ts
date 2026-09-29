/**
 * Columns — arranges renderables in a multi-column layout.
 *
 * A port of Rich's `Columns`, which lays its items out as a `Table.grid` with
 * `collapse_padding=True` and `pad_edge=False`. The grid is not reproduced here;
 * what it decides is: how many columns, how wide each one is, how far apart,
 * and where the rows go. `_layout` answers the first two the way the reference
 * does, and `spacing` reduces the padding to the gaps that grid leaves.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, stackedHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { cellCount } from "../core/cells.js";
import { embed } from "./embed.js";
import { ratioDistribute } from "./ratio.js";

export interface ColumnsOptions {
  expand?: boolean;
  equal?: boolean;
  width?: number;
  padding?: PaddingDimensions;
  columnFirst?: boolean;
}

/**
 * The space a collapsed, edgeless grid leaves around its cells.
 *
 * `after` is a cell's right padding, which the last column drops; `before` is
 * its left padding less the right padding it collapses into, which the first
 * column drops. So two columns stand `after + before` apart — the wider of the
 * two sides. Rows collapse the other way round: a row's bottom becomes
 * `top - bottom`, floored at zero, and the next row keeps its top, so rows stand
 * `top + max(0, top - bottom)` apart and a bottom-only padding separates nothing.
 * Both are the reference's arithmetic, not a model of what padding ought to do.
 */
interface Spacing {
  readonly after: number;
  readonly before: number;
  readonly rowGap: number;
}

function spacing(padding: PaddingDimensions): Spacing {
  const [top, right, bottom, left] = normalizePadding(padding);
  return {
    after: right,
    before: Math.max(0, left - right),
    rowGap: top + Math.max(0, top - bottom),
  };
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

/** Columns of these widths side by side, `gap` cells apart. */
function gridWidth(widths: readonly number[], gap: number): number {
  return widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
}

interface Grid {
  /** Item indices, one array per row, `count` slots each. */
  readonly rows: (number | undefined)[][];
  /** Each column's width, before `expand` stretches it. */
  readonly widths: number[];
  /** The widest an item renders, whatever its column is stretched to: Rich's `Constrain` under `equal`. */
  readonly cap: number;
}

export class Columns implements Renderable, Measurable {
  renderables: (Renderable & Partial<Measurable>)[];
  readonly expand: boolean;
  readonly equal: boolean;
  readonly colWidth: number | undefined;
  readonly columnFirst: boolean;
  private readonly spacing: Spacing;

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
    this.spacing = spacing(options?.padding ?? [0, 1]);
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    if (this.renderables.length === 0) return;

    // The parsed options, not just a parsed local: `_layout` hands them to
    // `Measurement.get`, and a raw NaN reaching it comes back as a NaN item
    // width, then a NaN column count, then `Invalid array length` before a
    // single column is laid out. An unbounded width reaches the same place by
    // the same route, which is why the parse here is the bounded one.
    const options = withBoundedWidth(rawOptions, this);
    const { rows, widths, cap } = this._layout(options);
    const { after, before, rowGap } = this.spacing;
    const gap = after + before;

    // [LAW:dataflow-not-control-flow] `expand` is how many cells are left to
    // hand out, never whether the columns are stretched: zero surplus stretches
    // nothing. The weights are the widths Rich's table holds, which count each
    // column's own padding — so the edge columns weigh one side less.
    const natural = gridWidth(widths, gap);
    const surplus = this.expand ? Math.max(0, options.maxWidth - natural) : 0;
    const last = widths.length - 1;
    const stretch = ratioDistribute(
      surplus,
      widths.map((w, col) => w + (col < last ? after : 0) + (col > 0 ? before : 0)),
    );
    const columns = widths.map((w, col) => w + stretch[col]!);
    const blank = [new Segment(" ".repeat(natural + surplus)), Segment.line()];
    const separator = Array.from({ length: rowGap }, () => blank).flat();

    // [LAW:types-are-the-program] The element type is Renderable — any number
    // of lines. Each grid cell renders to its full set of lines; an unfilled
    // slot (the last row is rarely full) is an empty cell. mergeHorizontal then
    // stacks every row of every cell line-by-line, so multi-line children
    // (Panels, Tables) compose instead of being truncated to their first row.
    for (const [r, row] of rows.entries()) {
      if (r > 0) yield* separator;
      const cells = row.map((index, col) => {
        const width = columns[col]!;
        const item = index === undefined ? undefined : this.renderables[index];
        const lines =
          item === undefined
            ? []
            : Segment.splitLines([
                // A cell of Rich's grid is a default `Column`'s: left-justified,
                // wrapping, and an overlong word ends in an ellipsis.
                ...item.render({
                  ...options,
                  maxWidth: Math.min(width, cap),
                  justify: "left",
                  overflow: "ellipsis",
                  noWrap: false,
                  height: stackedHeight(options.height),
                }),
              ]);
        return { lines, width };
      });
      yield* Segment.mergeHorizontal(cells, gap);
    }
  }

  /**
   * The grid at the width offered, before `expand`: the column count and each
   * column's width, decided the way Rich's `Columns` decides them.
   *
   * [LAW:single-enforcer] `render` lays out against this and `measure` reports
   * its width, so the two cannot disagree about how wide a Columns is.
   *
   * Every item carries a width. It is what the item measures, or the declared
   * `width` for all of them. `equal` counts every item as the widest when
   * choosing how many columns fit, and still sizes each column by what is in
   * it — which is why an `equal` layout is not a grid of equal columns, in the
   * reference or here.
   *
   * The count starts at one column per item and drops whenever the columns
   * filled so far, and the gaps between them, pass the width offered. One
   * departure from the reference: a declared `width` is searched the same way
   * rather than by `max_width // (width + gap)`, which laid out empty trailing
   * columns and charged the last column a gap it does not have.
   */
  private _layout(options: RenderOptions): Grid {
    const count = this.renderables.length;
    const maxWidth = options.maxWidth;
    const gap = this.spacing.after + this.spacing.before;

    const declared = this._declaredWidth(options);
    const sizes = this.renderables.map((item) => declared ?? this._itemWidth(item, options));
    // A fold, not `Math.max(...sizes)`: spreading one argument per item
    // overflows the call stack at a few hundred thousand items.
    const widest = sizes.reduce((w, size) => Math.max(w, size), 0);
    const fits = this.equal ? sizes.map(() => widest) : sizes;

    // One attempt either fits in the offer or names the smaller count to try
    // next. `total` is `gridWidth(widths, gap)`, kept as the widths grow so
    // that a slot costs the same however many columns came before it.
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
    const widths = Array.from({ length: columns }, (_, col) =>
      rows.reduce((w, row) => {
        const index = row[col];
        return index === undefined ? w : Math.max(w, sizes[index]!);
      }, 0),
    );
    return { rows, widths, cap: this.equal ? widest : Infinity };
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

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // The maximum is the width the grid is laid out at, before `expand`: as a
    // `Table` reports, a stretch is what a Columns does with a width it is
    // given, not a width it asks for. Reported as the offer instead, `Panel` in
    // fit mode drew a 40-cell frame around five cells of content and an
    // unbounded offer came back unbounded.
    //
    // A floor of one cell is what Columns asks for, and the ceiling wins: a
    // bare `minimum: 1` measured into no width at all reported the range 1..0 —
    // a floor above its own ceiling, which the parent that asked cannot divide.
    const parsed = withCellWidth(rawOptions);
    if (this.renderables.length === 0) return { minimum: 0, maximum: 0 };
    const maximum = gridWidth(this._layout(parsed).widths, this.spacing.after + this.spacing.before);
    return { minimum: Math.min(1, maximum), maximum };
  }
}
