/**
 * Height adapters — keep the dashboard's rendered output bounded by the
 * terminal's height so Live's alt-screen buffer never scrolls.
 *
 * Two pieces:
 *   - `ClipHeight` wraps a renderable and slices its line output to fit the
 *     incoming `height`.
 *   - `InjectMaxHeight` re-runs a renderable in a caller-supplied
 *     region (`height`, `exact`), so the runtime can push terminal height into Layout's
 *     RenderOptions without modifying core.
 *
 * Both follow [LAW:dataflow-not-control-flow]: same code path every frame,
 * variability lives in the height value.
 */

import type {
  Renderable,
  RenderOptions,
} from "../../../src/index.js";
import { Segment } from "../../../src/index.js";

export class ClipHeight implements Renderable {
  constructor(private readonly inner: Renderable) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const segs = [...this.inner.render(options)];
    const lines = Segment.splitLines(segs);
    const cap = Math.max(1, options.height?.rows ?? lines.length);
    const clipped = lines.slice(0, cap);
    for (let i = 0; i < clipped.length; i++) {
      yield* clipped[i]!;
      if (i < clipped.length - 1) yield Segment.line();
    }
  }
}

export class InjectMaxHeight implements Renderable {
  constructor(
    private readonly inner: Renderable,
    private readonly getHeight: () => number,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this.inner.render({
      ...options,
      height: { rows: this.getHeight(), exact: true },
    });
  }
}
