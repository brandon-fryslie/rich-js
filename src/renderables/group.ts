/**
 * Group — renders multiple renderables in sequence.
 * No visual chrome — purely a container.
 */

import type { Segment } from "../core/segment.js";
import { type Measurement, measureRenderables } from "../core/measure.js";
import type {
  Measurable,
  Renderable,
  RenderOptions,
} from "../core/protocol.js";
import { stackedHeight } from "../core/protocol.js";

export class Group implements Renderable, Measurable {
  readonly renderables: Renderable[];

  constructor(...renderables: Renderable[]) {
    this.renderables = renderables;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const memberOptions = { ...options, height: stackedHeight(options.height) };
    for (const renderable of this.renderables) {
      yield* renderable.render(memberOptions);
    }
  }

  /** As wide as its widest member: the reference's `measure_renderables`. */
  measure(options: RenderOptions): Measurement {
    return measureRenderables(options, this.renderables);
  }
}
