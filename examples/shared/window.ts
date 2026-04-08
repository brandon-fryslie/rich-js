/**
 * Window — clips an inner Renderable to exactly `maxLines` vertical lines,
 * starting at `offset`. Short content is padded with blank lines so the
 * output is always exactly maxLines tall. Used to keep pane heights fixed
 * inside a Layout so adjacent panes (footer, sidebar) stay in place.
 */

import { Segment } from "../../src/index.js";
import type { Renderable, RenderOptions } from "../../src/index.js";

export class Window implements Renderable {
  constructor(
    private readonly inner: Renderable,
    private readonly maxLines: number,
    private readonly offset: number = 0,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
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

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
  }
}
