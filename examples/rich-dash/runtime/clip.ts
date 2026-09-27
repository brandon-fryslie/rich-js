/**
 * Height adapter — keep the dashboard's rendered output bounded by the
 * terminal's height so Live's alt-screen buffer never scrolls.
 *
 * `InjectMaxHeight` renders a renderable in a caller-supplied region
 * (`height`, `exact`) and shapes what comes back to it, so the runtime can
 * push terminal height into Layout's RenderOptions without modifying core.
 *
 * [LAW:dataflow-not-control-flow]: same code path every frame, variability
 * lives in the height value.
 */

import type {
  Renderable,
  RenderOptions,
} from "../../../src/index.js";
import { Segment } from "../../../src/index.js";
import { fitHeight } from "../../../src/core/protocol.js";

export class InjectMaxHeight implements Renderable {
  constructor(
    private readonly inner: Renderable,
    private readonly getHeight: () => number,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const height = { rows: this.getHeight(), exact: true };
    const lines = Segment.splitLines(this.inner.render({ ...options, height }));
    for (const line of fitHeight(lines, height)) {
      yield* line;
      yield Segment.line();
    }
  }
}
