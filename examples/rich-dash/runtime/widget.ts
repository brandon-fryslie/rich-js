/**
 * Widget protocol — the only contract the dashboard runtime knows about.
 *
 * The runtime treats every widget identically: call `init` once, call `tick`
 * each frame to advance state, call `render` to project state into a
 * `Renderable`. There are no widget-identity branches anywhere — variability
 * lives in the state values returned by `tick`, not in control flow.
 *
 * [LAW:dataflow-not-control-flow] Same operations, same order, every frame.
 * State is the only thing that varies between widgets.
 */

import type { Renderable } from "../../../src/index.js";

export interface TickContext {
  /** Frame counter, monotonically increasing from 0. */
  readonly frame: number;
  /** Wall-clock time when this tick started, in ms. */
  readonly now: number;
  /** Milliseconds since the previous tick (0 on the first tick). */
  readonly deltaMs: number;
}

export interface WidgetSpec<S> {
  /** Stable identifier; must match the `name` of a Layout cell. */
  readonly id: string;
  /** Title shown in the wrapping panel. */
  readonly title: string;
  /** Border style for the wrapping panel (forwarded to Panel). */
  readonly borderStyle?: string;
  /** Build the widget's initial state. Called once at startup. */
  init(): S;
  /** Advance widget state for the next frame. Returning the same reference is fine. */
  tick(state: S, ctx: TickContext): S;
  /** Project state to a Renderable for this frame. Do not perform screen/runtime I/O here. */
  render(state: S): Renderable;
}

/**
 * Runtime-facing widget shape. The state-type parameter is erased at the
 * boundary so the runtime can hold a heterogeneous array uniformly. Always
 * construct with `defineWidget<MyState>({...})` — never implement this
 * interface directly.
 */
export interface Widget {
  readonly id: string;
  readonly title: string;
  readonly borderStyle?: string;
  init(): unknown;
  tick(state: unknown, ctx: TickContext): unknown;
  render(state: unknown): Renderable;
}

/**
 * Erase the state-type parameter at the boundary. Inside the spec everything
 * is fully typed; the runtime sees a uniform `Widget`. This is the same
 * pattern as `Renderable` — the contract is the seam, the implementation is
 * private.
 *
 * [LAW:locality-or-seam] The seam between widget authors and the runtime is
 * this one function. Adding a new widget never edits the runtime.
 */
export function defineWidget<S>(spec: WidgetSpec<S>): Widget {
  return spec as unknown as Widget;
}
