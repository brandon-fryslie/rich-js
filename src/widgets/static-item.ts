/**
 * StaticItem — a non-focusable, non-interactive Renderable wrapped to fit
 * the InteractiveWidget surface so it can be mounted by Screen alongside
 * real widgets.
 *
 * [LAW:one-type-per-behavior] Screen.mount accepts a uniform array of
 * InteractiveWidget. Static text, panels, swatches, and other display-only
 * Renderables flow through the same pipeline by being expressed as the
 * same type. The differences (no focus, no event handling) are configured
 * via `focusable: false` plus the no-op handlers WidgetBase already
 * provides — there is no second type, no "static vs interactive" branch in
 * Screen's render loop.
 *
 * The wrapped renderable can be a function that re-evaluates each frame
 * (so the host can read MobX observables inside `render` and have Screen
 * re-render reactively) or a plain object that returns the same segments
 * every time.
 */

import type { Segment } from "../core/segment.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent } from "./types.js";

export interface StaticItemOptions {
  id: string;
  // The renderable body. Either a Renderable instance or a function that
  // returns the segments for the current frame. The function form is what
  // hosts use when they want frame-by-frame reactivity from observables.
  render: Renderable | ((options: RenderOptions) => Iterable<Segment>);
  // Optional measure. If omitted, StaticItem measures by rendering and
  // reading the line shape — fine for static content; hosts that need
  // tight measure semantics can pass an explicit Measurable.measure.
  measure?: Measurable["measure"];
}

export class StaticItem extends WidgetBase {
  readonly id: string;
  readonly focusable = false;

  private readonly renderFn: (options: RenderOptions) => Iterable<Segment>;
  private readonly measureFn: Measurable["measure"] | undefined;

  constructor(options: StaticItemOptions) {
    super();
    this.id = options.id;
    const r = options.render;
    this.renderFn =
      typeof r === "function"
        ? (opts: RenderOptions) => r(opts)
        : (opts: RenderOptions) => r.render(opts);
    this.measureFn = options.measure;
  }

  // Static items don't respond to keys. WidgetBase.handleMouse / handleFocus
  // are already no-ops, so we only need to satisfy the abstract handleKey.
  handleKey(_event: KeyEvent): void {}

  render(options: RenderOptions): Iterable<Segment> {
    return this.renderFn(options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    if (this.measureFn) return this.measureFn(options);
    // Render once and use the resulting line width as both min and max.
    let max = 0;
    let cur = 0;
    for (const seg of this.renderFn(options)) {
      if (seg.text === "\n") {
        if (cur > max) max = cur;
        cur = 0;
      } else {
        cur += seg.cellLength;
      }
    }
    if (cur > max) max = cur;
    return { minimum: max, maximum: max };
  }
}
