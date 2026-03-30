/**
 * Group — renders multiple renderables in sequence.
 * No visual chrome — purely a container.
 */

import { Segment } from "../core/segment.js";
import type {
  Renderable,
  RenderOptions,
} from "../core/protocol.js";

export class Group implements Renderable {
  readonly renderables: Renderable[];

  constructor(...renderables: Renderable[]) {
    this.renderables = renderables;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    for (const renderable of this.renderables) {
      yield* renderable.render(options);
    }
  }
}
