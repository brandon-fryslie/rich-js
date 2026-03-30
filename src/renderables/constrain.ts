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
import { isMeasurable } from "../core/protocol.js";

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
    if (isMeasurable(this.renderable)) {
      const measurement = Measurement.get(options, this.renderable);
      const maxWidth =
        this.width !== undefined
          ? Math.min(this.width, options.maxWidth)
          : options.maxWidth;
      return {
        minimum: measurement.minimum,
        maximum: Math.min(measurement.maximum, maxWidth),
      };
    }
    return { minimum: 1, maximum: options.maxWidth };
  }
}
