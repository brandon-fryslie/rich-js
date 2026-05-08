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

import { Segment } from "../core/segment.js";
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
    // [LAW:single-enforcer] Segment.splitLines + Segment.getShape are the
    // canonical authority on how segment streams split into lines and what
    // their pixel shape is. Reusing them keeps measurement consistent with
    // Screen's render pipeline even when the renderable emits embedded
    // newlines inside a single Segment.text (which Segment.splitLines
    // supports but a per-segment `text === "\n"` check does not).
    const lines = Segment.splitLines(this.renderFn(options));
    const [width] = Segment.getShape(lines);
    return { minimum: width, maximum: width };
  }
}
