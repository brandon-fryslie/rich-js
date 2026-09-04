/**
 * Columns — arranges renderables in a multi-column layout.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import { RichText } from "../core/text.js";
import type { PaddingDimensions } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { cellCount } from "../core/cells.js";

export interface ColumnsOptions {
  expand?: boolean;
  equal?: boolean;
  width?: number;
  padding?: PaddingDimensions;
  columnFirst?: boolean;
}

function toRenderable(item: unknown): Renderable & Partial<Measurable> {
  if (typeof item === "object" && item !== null && "render" in item) {
    return item as Renderable & Partial<Measurable>;
  }
  return new RichText(String(item ?? ""), { end: "" });
}

export class Columns implements Renderable, Measurable {
  renderables: (Renderable & Partial<Measurable>)[];
  readonly expand: boolean;
  readonly equal: boolean;
  readonly colWidth: number | undefined;
  readonly columnFirst: boolean;
  readonly gutterWidth: number;

  constructor(items?: Iterable<unknown>, options?: ColumnsOptions) {
    this.renderables = items ? [...items].map(toRenderable) : [];
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
    this.gutterWidth = 2; // default gutter between columns
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const items = this.renderables;
    if (items.length === 0) return;

    // The parsed options, not just a parsed local: `_divide` hands them to
    // `Measurement.get`, and a raw NaN reaching it comes back as a NaN item
    // width, then a NaN column count, then `Invalid array length` out of
    // `new Array(numCols)` before a single column is laid out. An unbounded
    // width reaches the same `new Array` by the same route, which is why the
    // parse here is the bounded one.
    const options = withBoundedWidth(rawOptions, this);
    const { numCols, colWidths } = this._divide(options);

    // Layout items into rows
    const numRows = Math.ceil(items.length / numCols);

    // [LAW:types-are-the-program] The element type is Renderable — any number
    // of lines. Each grid cell renders to its full set of lines; an out-of-range
    // slot (the last row is rarely full) is an empty cell. mergeHorizontal then
    // stacks every row of every cell line-by-line, so multi-line children
    // (Panels, Tables) compose instead of being truncated to their first row.
    for (let row = 0; row < numRows; row++) {
      const cells = colWidths.map((width, col) => {
        const idx = this.columnFirst ? col * numRows + row : row * numCols + col;
        const item = items[idx];
        const lines =
          item === undefined
            ? []
            : Segment.splitLines([
                ...item.render({ ...options, maxWidth: width }),
              ]);
        return { lines, width };
      });
      yield* Segment.mergeHorizontal(cells, this.gutterWidth);
    }
  }

  /**
   * The requested width divided into columns, once.
   *
   * [LAW:single-enforcer] The three modes disagree only about how many columns
   * there are and how wide each one is, so they disagree in one place. `render`
   * lays out against this division and `_naturalWidth` is the width at which it
   * comes out as one row of every item.
   */
  private _divide(options: RenderOptions): { numCols: number; colWidths: number[] } {
    const maxWidth = options.maxWidth;
    const gutter = this.gutterWidth;

    if (this.colWidth !== undefined) {
      const numCols = Math.max(1, Math.floor((maxWidth + gutter) / (this.colWidth + gutter)));
      return { numCols, colWidths: new Array(numCols).fill(this.colWidth) as number[] };
    }

    if (this.equal) {
      const itemWidth = this._itemWidth(options);
      const numCols = Math.max(1, Math.floor((maxWidth + gutter) / (itemWidth + gutter)));
      const equalWidth = Math.floor((maxWidth - gutter * (numCols - 1)) / numCols);
      return { numCols, colWidths: new Array(numCols).fill(equalWidth) as number[] };
    }

    // Auto: as many columns as the widest item fits into, capped at the item
    // count. Sized from the content rather than from a flat four cells per
    // column, because `_naturalWidth` below is the inverse of *this* expression
    // and a constant has no inverse: six two-cell items reported a natural
    // width of 22 and then wrapped into two rows at 22, since `floor(22 / 4)`
    // is five columns no matter how narrow the items are.
    const itemWidth = this._itemWidth(options);
    const numCols = Math.min(
      this.renderables.length,
      Math.max(1, Math.floor((maxWidth + gutter) / (itemWidth + gutter))),
    );
    const colW = Math.floor((maxWidth - gutter * (numCols - 1)) / numCols);
    return { numCols, colWidths: new Array(numCols).fill(colW) as number[] };
  }

  /** The widest any one item wants to be. An item with no `measure` counts as one cell. */
  private _itemWidth(options: RenderOptions): number {
    let widest = 1;
    for (const item of this.renderables) {
      if (isMeasurable(item)) {
        widest = Math.max(widest, Measurement.get(options, item).maximum);
      }
    }
    return widest;
  }

  /** The width at which every item sits on one row: n columns and the gutters between them. */
  private _naturalWidth(options: RenderOptions): number {
    const count = this.renderables.length;
    if (count === 0) return 0;
    const width = this.colWidth ?? this._itemWidth(options);
    return count * width + this.gutterWidth * (count - 1);
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // A floor of one cell is what Columns asks for; the ceiling is what it was
    // offered, and the ceiling wins. Stated as a bare `minimum: 1`, a Columns
    // measured into no width at all reported the range 1..0 — a floor above
    // its own ceiling, which the parent that asked cannot divide.
    //
    // The ceiling is not the whole answer, though: reported as the offer alone,
    // a Columns claimed every cell it was shown, so `Panel` in fit mode drew a
    // 40-cell frame around five cells of content and an unbounded offer came
    // back unbounded.
    const parsed = withCellWidth(rawOptions);
    const maximum = Math.min(this._naturalWidth(parsed), parsed.maxWidth);
    return { minimum: Math.min(1, maximum), maximum };
  }
}
