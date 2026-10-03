/**
 * Constrain — wraps a renderable and constrains its maximum width.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export class Constrain implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly width: number | undefined;

  constructor(renderable: Renderable, width?: number) {
    this.renderable = renderable;
    this.width = width;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    // [LAW:dataflow-not-control-flow] Always compute constrainedWidth; undefined means no constraint
    const constrainedWidth =
      this.width !== undefined
        ? Math.min(this.width, options.maxWidth)
        : options.maxWidth;

    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: constrainedWidth,
    };

    yield* this.renderable.render(innerOptions);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    // Measured at the width it will be drawn at, as Rich's `update_width` does;
    // `Measurement.get` then holds the answer inside that offer.
    const maxWidth =
      this.width !== undefined
        ? Math.min(this.width, options.maxWidth)
        : options.maxWidth;
    return Measurement.get({ ...options, maxWidth }, this.renderable);
  }
}
