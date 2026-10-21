/**
 * A renderable drawn the way a host draws it in a frame for `t`: every
 * animation placed anywhere in it — an `Effected`, a tween mapped to a text —
 * draws at `t` and stamps its cells there, as it does under a `Live` or an
 * `App` whose frame is drawn for `t`. What a test that pins one moment of a
 * placed animation draws it through.
 */

import { Measurement } from "../../src/core/measure.js";
import { render, type Measurable, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { Timeline } from "../../src/core/timeline.js";
import { drawView, hostView, type DrawnView } from "../../src/core/view.js";

export function inFrame(renderable: Renderable, t: number): Renderable & Measurable {
  const host = { frameTime: t };
  const at = (options: RenderOptions): RenderOptions => ({ ...options, frame: { time: t, host } });
  return { render: (options) => render(renderable, at(options)), measure: (options) => Measurement.get(at(options), renderable) };
}

/**
 * `renderable` drawn by a host whose timeline plays from 0, at host time `t`:
 * the lines, and when the frame says it next changes — what its cells carry
 * and what it was told no cell carries (`RenderOptions.onHold`) — read by
 * `drawView`, the one place a host reads it.
 */
export function drawnAt(renderable: Renderable, t: number, options: RenderOptions): DrawnView {
  return drawView(hostView(renderable), { now: t, epoch: 0, timeline: Timeline.play(0) }, { frameTime: t }, options, (r, under) =>
    Segment.splitLines(render(r, under)),
  );
}
