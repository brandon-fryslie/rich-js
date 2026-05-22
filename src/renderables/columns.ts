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
import { isMeasurable } from "../core/protocol.js";

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
    this.colWidth = options?.width;
    this.columnFirst = options?.columnFirst ?? false;
    this.gutterWidth = 2; // default gutter between columns
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const items = this.renderables;
    if (items.length === 0) return;

    const maxWidth = options.maxWidth;

    // Determine column widths
    let numCols: number;
    let colWidths: number[];

    if (this.colWidth !== undefined) {
      numCols = Math.max(1, Math.floor((maxWidth + this.gutterWidth) / (this.colWidth + this.gutterWidth)));
      colWidths = new Array(numCols).fill(this.colWidth) as number[];
    } else if (this.equal) {
      // Measure all items to find the widest
      let maxItemWidth = 1;
      for (const item of items) {
        if (isMeasurable(item)) {
          const m = Measurement.get(options, item);
          maxItemWidth = Math.max(maxItemWidth, m.maximum);
        }
      }
      numCols = Math.max(1, Math.floor((maxWidth + this.gutterWidth) / (maxItemWidth + this.gutterWidth)));
      const equalWidth = Math.floor((maxWidth - this.gutterWidth * (numCols - 1)) / numCols);
      colWidths = new Array(numCols).fill(equalWidth) as number[];
    } else {
      // Auto: fit as many columns as possible
      numCols = Math.min(items.length, Math.max(1, Math.floor(maxWidth / 4)));
      const colW = Math.floor((maxWidth - this.gutterWidth * (numCols - 1)) / numCols);
      colWidths = new Array(numCols).fill(colW) as number[];
    }

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

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
