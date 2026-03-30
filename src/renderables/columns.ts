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

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const idx = this.columnFirst
          ? col * numRows + row
          : row * numCols + col;

        if (idx >= items.length) {
          if (col < numCols - 1) {
            yield new Segment(" ".repeat(colWidths[col]! + this.gutterWidth));
          }
          continue;
        }

        const item = items[idx]!;
        const cellWidth = colWidths[col]!;
        const cellOpts: RenderOptions = { ...options, maxWidth: cellWidth };
        const segs = [...item.render(cellOpts)];
        const lines = Segment.splitLines(segs);
        const firstLine = lines[0] ?? [];
        const adjusted = Segment.adjustLineLength(firstLine, cellWidth);
        yield* adjusted;

        if (col < numCols - 1) {
          yield new Segment(" ".repeat(this.gutterWidth));
        }
      }
      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
