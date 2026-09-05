/**
 * Window — clips an inner Renderable to exactly `maxLines` vertical lines,
 * starting at `offset`. Short content is padded with blank lines so the
 * output is always exactly maxLines tall. Used to keep pane heights fixed
 * inside a Layout so adjacent panes (footer, sidebar) stay in place.
 */

import {
  Measurement,
  Segment,
  isMeasurable,
  withBoundedWidth,
  withCellWidth,
} from "../../src/index.js";
import type { Measurable, Renderable, RenderOptions } from "../../src/index.js";

export class Window implements Renderable, Measurable {
  constructor(
    private readonly inner: Renderable,
    private readonly maxLines: number,
    private readonly offset: number = 0,
  ) {}

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    // A custom renderable is a width checkpoint like any built-in one — see
    // the width contract in docs/protocol.md. The parsed options are what
    // reaches `inner`, so the caller's raw number stops here.
    const options = withBoundedWidth(rawOptions, this);
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
    // Window clips vertically and changes nothing horizontally, so its width is
    // whatever `inner` wants — not the whole offer, which is what it used to
    // claim and which made every parent in fit mode draw itself full-width
    // around it. `Measurement.get` caps the answer at the offer already.
    //
    // `withCellWidth` and not `withBoundedWidth`: the bounded parse asks this
    // very method what the natural width is, so calling it from here would ask
    // the question with itself.
    const options = withCellWidth(rawOptions);
    if (!isMeasurable(this.inner)) {
      return { minimum: Math.min(1, options.maxWidth), maximum: options.maxWidth };
    }
    return Measurement.get(options, this.inner);
  }
}
