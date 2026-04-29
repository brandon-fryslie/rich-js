/**
 * Height adapters — keep the dashboard's rendered output bounded by the
 * terminal's height so Live's alt-screen buffer never scrolls.
 *
 * Two pieces:
 *   - `ClipHeight` wraps a renderable and slices its line output to fit the
 *     incoming `maxHeight`. Optional `reserve` accounts for borders or
 *     padding that the caller has already committed to (e.g. a Panel's two
 *     border rows).
 *   - `InjectMaxHeight` re-runs a renderable with a caller-supplied
 *     `maxHeight`, so the runtime can push terminal height into Layout's
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
  constructor(
    private readonly inner: Renderable,
    private readonly reserve: number = 0,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const segs = [...this.inner.render(options)];
    const lines = Segment.splitLines(segs);
    const ceiling = options.maxHeight ?? lines.length;
    const cap = Math.max(1, ceiling - this.reserve);
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
    const maxHeight = this.getHeight();
    yield* this.inner.render({ ...options, maxHeight, height: maxHeight });
  }
}
