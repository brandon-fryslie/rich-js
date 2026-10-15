/**
 * ListView — items stacked down a `Viewport`, scrolled to keep the selected
 * one in view, and `moveSelection`, the cursor that picks it.
 *
 * An item can wrap, so the lines the selected one covers exist only at the
 * width it is drawn at, which a render is handed and whoever builds the frame
 * is not. So the items are drawn here, at the viewport's content width and
 * with no height — the lines the viewport scrolls — and the viewport is handed
 * those lines and the selected item's range.
 * [LAW:single-enforcer] Where the window sits is the viewport's call; this
 * only says which lines the selection is.
 *
 * The viewport is handed in rather than made here: the scroll position lives
 * in it, and a frame rebuilt on every key would otherwise start each one at
 * the top. The pieces stay apart — a cursor, a viewport, a list drawn through
 * it — so a consumer can take one without the others.
 */

import { Segment } from "../core/segment.js";
import { Measurement, measureRenderables } from "../core/measure.js";
import { withBoundedWidth, withCellWidth } from "../core/protocol.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import type { Viewport } from "./viewport.js";

/**
 * The selection `delta` items on from `index` in a list of `length`, held to
 * the list's ends: `-Infinity` is the first item and `Infinity` the last. A
 * move that cannot go anywhere returns `index` itself, so `next === index`
 * says nothing moved and the caller can skip a repaint. An empty list has
 * nowhere to move to and returns `index`.
 */
export function moveSelection(index: number, delta: number, length: number): number {
  return length === 0 ? index : Math.max(0, Math.min(length - 1, index + delta));
}

export interface ListViewOptions {
  /** Blank lines between one item and the next. Absent, none. */
  gap?: number;
  /**
   * Lines kept in view above and below the selected item, where the list has
   * them: the neighbour a cursor is about to move onto. Absent, none.
   */
  context?: number;
}

function lineCount(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`ListView: ${name} ${value} is not a whole number of lines`);
  return value;
}

export class ListView implements Renderable, Measurable {
  readonly gap: number;
  readonly context: number;

  constructor(
    readonly viewport: Viewport,
    readonly items: readonly Renderable[],
    readonly selected: number,
    options: ListViewOptions = {},
  ) {
    this.gap = lineCount("gap", options.gap ?? 0);
    this.context = lineCount("context", options.context ?? 0);
    // An empty list's selection is 0: there is nothing for it to name.
    if (!Number.isInteger(selected) || selected < 0 || selected >= Math.max(1, items.length)) {
      throw new RangeError(`ListView: selected ${selected} is not an index of ${items.length} items`);
    }
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const bounded = withBoundedWidth(rawOptions, this);
    const { height: _height, ...rest } = bounded;
    const options = { ...rest, maxWidth: this.viewport.contentWidth(rest.maxWidth) };
    const gap: Segment[][] = Array.from({ length: this.gap }, () => []);
    // Each item's lines, then the gap under it — the last item's included, so
    // every item spans the same shape and the selected one's range is a sum.
    const drawn = this.items.map((item) => [...Segment.splitLines(item.render(options)), ...gap]);
    const linesIn = (from: number, to: number): number =>
      drawn.slice(from, to).reduce((total, lines) => total + lines.length, 0);
    const start = linesIn(0, this.selected);
    // The selected item's range stops short of the gap under it.
    const end = linesIn(0, this.selected + 1) - this.gap;
    const lines = drawn.flat();
    this.viewport.content = {
      *render(): Iterable<Segment> {
        for (const line of lines) {
          yield* line;
          yield Segment.line();
        }
      },
    };
    // A range reaching past either end is clamped by the viewport, which holds
    // its offset to the lines that exist. Followed, not ensured: the wheel can
    // scroll away from the selection until the selection moves.
    this.viewport.follow(start - this.context, end + this.context);
    yield* this.viewport.render(bounded);
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // Stacked, the items are as wide as the widest of them, plus whatever
    // gutter the viewport's scrollbar takes. `withCellWidth` and not
    // `withBoundedWidth`: the bounded parse asks this very method.
    const options = withCellWidth(rawOptions);
    const contentWidth = this.viewport.contentWidth(options.maxWidth);
    const gutter = this.viewport.gutter;
    const items = measureRenderables({ ...options, maxWidth: contentWidth }, this.items);
    return new Measurement(items.minimum + gutter, items.maximum + gutter).withMaximum(options.maxWidth);
  }
}
