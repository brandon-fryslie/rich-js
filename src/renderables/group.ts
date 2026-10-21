/**
 * Group — renders multiple renderables in sequence.
 * No visual chrome — purely a container.
 */

import type { Segment } from "../core/segment.js";
import { type Measurement, measureRenderables } from "../core/measure.js";
import type {
  Composite,
  Measurable,
  Renderable,
  RenderOptions,
} from "../core/protocol.js";
import { render, stackedHeight } from "../core/protocol.js";

export class Group implements Renderable, Measurable, Composite {
  readonly renderables: readonly Renderable[];

  constructor(...renderables: Renderable[]) {
    this.renderables = renderables;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const memberOptions = { ...options, height: stackedHeight(options.height) };
    for (const renderable of this.renderables) {
      yield* render(renderable, memberOptions);
    }
  }

  /** As wide as its widest member: the reference's `measure_renderables`. */
  measure(options: RenderOptions): Measurement {
    return measureRenderables(options, this.renderables);
  }

  contents(): Iterable<Renderable> {
    return this.renderables;
  }
}
