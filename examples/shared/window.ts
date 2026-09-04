/**
 * Window — clips an inner Renderable to exactly `maxLines` vertical lines,
 * starting at `offset`. Short content is padded with blank lines so the
 * output is always exactly maxLines tall. Used to keep pane heights fixed
 * inside a Layout so adjacent panes (footer, sidebar) stay in place.
 */

import { Segment, withCellWidth } from "../../src/index.js";
import type { Renderable, RenderOptions } from "../../src/index.js";

export class Window implements Renderable {
  constructor(
    private readonly inner: Renderable,
    private readonly maxLines: number,
    private readonly offset: number = 0,
  ) {}

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    // A custom renderable is a width checkpoint like any built-in one — see
    // the width contract in docs/protocol.md. The parsed options are what
    // reaches `inner`, so the caller's raw number stops here.
    const options = withCellWidth(rawOptions);
    const segs = [...this.inner.render(options)];
    const lines = Segment.splitLines(segs);
    const start = Math.max(0, this.offset);
    const slice = lines.slice(start, start + this.maxLines);
    while (slice.length < this.maxLines) {
      slice.push([]);
    }
    for (const line of slice) {
      yield* line;
      yield Segment.line();
    }
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // Window clips vertically and takes whatever width it is offered, so its
    // range is the whole offer. Stated as `MAX_SAFE_INTEGER` it was a ceiling
    // no parent could divide against.
    const { maxWidth } = withCellWidth(rawOptions);
    return { minimum: Math.min(1, maxWidth), maximum: maxWidth };
  }
}
