/**
 * Align — wraps a renderable and places its output horizontally, as one block.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth } from "../core/protocol.js";
import { placeBlock, type Alignment } from "../core/place.js";

export class Align implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly align: Alignment;

  constructor(renderable: Renderable, align: Alignment = "center") {
    this.renderable = renderable;
    this.align = align;
  }

  // [LAW:one-source-of-truth] `placeBlock` is the placement; `Console.print`'s
  // `justify` uses the same one.
  *render(options: RenderOptions): Iterable<Segment> {
    for (const line of placeBlock(this.renderable, this.align, withBoundedWidth(options, this))) {
      yield* line;
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
