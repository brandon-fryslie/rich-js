/**
 * Align — wraps a renderable and aligns its output horizontally.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable } from "../core/protocol.js";

export type Alignment = "left" | "center" | "right";

export class Align implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly align: Alignment;

  constructor(renderable: Renderable, align: Alignment = "center") {
    this.renderable = renderable;
    this.align = align;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const maxWidth = options.maxWidth;
    const segments = [...this.renderable.render(options)];
    const lines = Segment.splitLines(segments);

    for (const line of lines) {
      const lineWidth = Segment.getLineLength(line);
      const gap = maxWidth - lineWidth;

      // [LAW:dataflow-not-control-flow] Always compute padding; gap <= 0 produces empty strings
      const leftPad =
        this.align === "right"
          ? gap
          : this.align === "center"
            ? Math.floor(gap / 2)
            : 0;

      if (leftPad > 0) yield new Segment(" ".repeat(leftPad));
      yield* line;

      const rightPad = gap - leftPad;
      if (rightPad > 0) yield new Segment(" ".repeat(rightPad));

      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    if (isMeasurable(this.renderable)) {
      const measurement = Measurement.get(options, this.renderable);
      return {
        minimum: Math.max(1, measurement.minimum),
        maximum: measurement.maximum,
      };
    }
    return { minimum: 1, maximum: options.maxWidth };
  }
}
