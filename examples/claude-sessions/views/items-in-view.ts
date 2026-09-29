/**
 * Items stacked a blank line apart, in a viewport scrolled to show the
 * selected one.
 *
 * An item can wrap, so the lines the selected one covers exist only at the
 * width it is drawn at, which a render is handed and a frame builder is not.
 * So the items are drawn here, at the width and with no height the viewport
 * draws its content at — so these are the lines it scrolls — and the viewport
 * is handed those lines and the selected item's range.
 * [LAW:single-enforcer] Where the window sits is the viewport's call; this
 * only says which lines the selection is.
 *
 * The viewport is handed in rather than made here: the scroll position lives
 * in it, and the frame this belongs to is rebuilt on every key.
 */

import {
  Segment,
  isMeasurable,
  measureRenderables,
  withBoundedWidth,
  withCellWidth,
} from "../../../src/index.js";
import type { Measurable, Renderable, RenderOptions, Viewport } from "../../../src/index.js";

/** What an item that cannot measure itself wants: the whole offer. */
const WHOLE_OFFER: Measurable = {
  measure: ({ maxWidth }) => ({ minimum: Math.min(1, maxWidth), maximum: maxWidth }),
};

export class ItemsInView implements Renderable, Measurable {
  constructor(
    private readonly viewport: Viewport,
    private readonly items: readonly Renderable[],
    private readonly selected: number,
  ) {}

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const bounded = withBoundedWidth(rawOptions, this);
    const { height: _height, ...rest } = bounded;
    const options = { ...rest, maxWidth: this.viewport.contentWidth(rest.maxWidth) };
    const drawn = this.items.map((item) => [...Segment.splitLines(item.render(options)), []]);
    const linesIn = (from: number, to: number): number =>
      drawn.slice(from, to).reduce((total, lines) => total + lines.length, 0);
    const start = linesIn(0, this.selected);
    const lines = drawn.flat();
    this.viewport.content = {
      *render(): Iterable<Segment> {
        for (const line of lines) {
          yield* line;
          yield Segment.line();
        }
      },
    };
    // The selected item's range stops short of the blank line under it.
    this.viewport.ensureVisible(start, start + linesIn(this.selected, this.selected + 1) - 1);
    yield* this.viewport.render(bounded);
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // Stacked, the items are as wide as the widest of them. `withCellWidth`
    // and not `withBoundedWidth`: the bounded parse asks this very method.
    const options = withCellWidth(rawOptions);
    return measureRenderables(options, this.items.map((item) => (isMeasurable(item) ? item : WHOLE_OFFER)));
  }
}
