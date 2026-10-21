/**
 * A renderable drawn the way a host draws it in a frame for `t`: every
 * animation placed anywhere in it — an `Effected`, a tween mapped to a text —
 * draws at `t` and stamps its cells there, as it does under a `Live` or an
 * `App` whose frame is drawn for `t`. What a test that pins one moment of a
 * placed animation draws it through.
 */

import { Measurement } from "../../src/core/measure.js";
import { render, type Measurable, type Renderable, type RenderOptions } from "../../src/core/protocol.js";

export function inFrame(renderable: Renderable, t: number): Renderable & Measurable {
  const host = { frameTime: t };
  const at = (options: RenderOptions): RenderOptions => ({ ...options, frame: { time: t, host } });
  return { render: (options) => render(renderable, at(options)), measure: (options) => Measurement.get(at(options), renderable) };
}
