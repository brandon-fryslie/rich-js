/**
 * View — what a host draws, and the frame it draws from it at a host time on
 * its timeline: the lines, and what they say about when they change.
 *
 * A host — a `Live`, an `App` — reads its clock once a frame and draws its
 * view for that moment. The view is a renderable, drawn as it is now (a
 * table mutated in place between frames), at the time the host's `Timeline`
 * (`./timeline.ts`) maps its clock to, written on the frame
 * (`RenderOptions.frame`): every animation placed anywhere inside it draws
 * at that time and stamps its cells with when it changes, on that clock
 * (`placedRender`, `./animation.ts`). A program may hand a function for one
 * instead, asked each frame so a view of its state is built from the state
 * as it is then. It is handed no time, and `hostView` makes it the
 * renderable it stands for, so a host holds one shape of view and draws it
 * one way. [LAW:one-type-per-behavior]
 *
 * So a view says when it changes only through what it draws: what moves in
 * it is an animation placed there — `Animation.continuous` for a value
 * computed from the time — and never a time handed to the program.
 * [LAW:one-source-of-truth] Pausing, reversing, scrubbing and speeding up
 * what a host shows are changes to one value the host holds and not to
 * anything it draws. What the drawn frame says about when it changes is on
 * the timeline's clock, and `drawView` carries it back onto the host's by
 * running the frame through the same timeline: the frame is a sample held
 * for the intersection of its cells' holds (`Segment.lastChange`,
 * `Segment.nextChange`) and the holds it was told that no cell carries
 * (`RenderOptions.onHold`), and `Timeline.run` is the one place a hold is
 * mapped onto host time, forwards, backwards or paused.
 *
 * What a host does with that is its own policy, and it reads it off the
 * `DrawnView`. A view may also change without saying so — it reads state
 * the host cannot see — so a host that polls for such a change, a `Live`'s
 * auto-refresh, polls every frame.
 *
 * Tier 7 of `src/core/`: `./animation.ts`'s `Animation`, `./timeline.ts`,
 * `./segment.ts`, `./protocol.ts` and `./style.ts`'s `Hold`, nothing else.
 * [LAW:one-way-deps]
 */

import type { Animation } from "./animation.js";
import { render, type FrameHost, type Renderable, type RenderOptions } from "./protocol.js";
import { Segment } from "./segment.js";
import type { Hold } from "./style.js";
import { Timeline } from "./timeline.js";

/**
 * What a host draws: a renderable — an animation of renderables among them,
 * or anything holding one — or a function asked for one each frame.
 */
export type View = Renderable | (() => Renderable);

/** `view` as the renderable a host holds: a function is asked each time it is drawn. */
export function hostView(view: View): Renderable {
  return typeof view === "function" ? { render: (options) => render(view(), options) } : view;
}

/**
 * A host's time, its clock read once: `now` on that clock; `epoch`, the
 * moment on it the host began; and `timeline`, the map every view is drawn
 * through. Handed none, a host's timeline starts as `Timeline.play(epoch)`,
 * so a frame is drawn for the seconds since `epoch` until the timeline is
 * paused, sought, re-rated or replaced.
 */
export interface HostTime {
  readonly now: number;
  readonly epoch: number;
  readonly timeline: Timeline;
}

/**
 * The time a frame drawn at `time` is drawn for, on the clock its cells are
 * stamped on: the time the timeline maps `now` to. [LAW:single-enforcer]
 * `drawView` draws at it and hands it to the frame as
 * `RenderOptions.frame`, and a host reads it here for anything heard between
 * frames — a key — so a moment a widget keeps and the frame it is compared
 * against are on one clock.
 */
export function frameTime(time: HostTime): number {
  return Timeline.at(time.timeline, time.now);
}

/** What a frame drawn at host time `t` says about when it changes. */
export interface FrameSays {
  /** The host time the frame was drawn at. */
  readonly t: number;
  /** The first host moment, never before `t`, at which the frame may stop showing this: `t` while it moves, `Infinity` once it never will. */
  readonly nextChange: number;
}

/** A frame drawn from a view: its lines, and what it says. */
export interface DrawnView extends FrameSays {
  readonly lines: Segment[][];
}

/** What a frame not yet drawn at host time `t` says: nothing. */
export const undrawn = (t: number): FrameSays => ({ t, nextChange: Number.POSITIVE_INFINITY });

/** The hold of the frame `lines` draw, told `told` besides: the intersection of its cells' holds and it. */
const frameHold = (lines: Segment[][], told: Hold): Hold =>
  lines.reduce(
    (hold, row) => ({ lastChange: Math.max(hold.lastChange, Segment.lastChange(row)), nextChange: Math.min(hold.nextChange, Segment.nextChange(row)) }),
    told,
  );

/**
 * `view` drawn by `drawnBy` at `time` under `options`, its lines shaped by
 * `draw` — the host's own render under those options, with its height and
 * overflow — and when the frame changes on the host's clock: the hold its
 * cells say, carried back through the timeline. [LAW:one-source-of-truth]
 * `options` is the one place the frame reads the reader's preference for
 * motion, handed on to `draw` with the frame: the time it is drawn for
 * (`frameTime`) and `drawnBy`, the host whose time that is.
 */
export function drawView(
  view: Renderable,
  time: HostTime,
  drawnBy: FrameHost,
  options: RenderOptions,
  draw: (renderable: Renderable, options: RenderOptions) => Segment[][],
): DrawnView {
  const { now: host, timeline } = time;
  let told: Hold = { lastChange: Number.NEGATIVE_INFINITY, nextChange: Number.POSITIVE_INFINITY };
  const onHold = (hold: Hold): void => {
    told = { lastChange: Math.max(told.lastChange, hold.lastChange), nextChange: Math.min(told.nextChange, hold.nextChange) };
  };
  const lines = draw(view, { ...options, frame: { time: frameTime(time), host: drawnBy }, onHold });
  const hold = frameHold(lines, told);
  // The frame as the sample of the view it is, on the timeline's clock; the
  // timeline says when the host's clock leaves its hold.
  const sample: Animation<Segment[][]> = { at: () => lines, nextChange: () => hold.nextChange, lastChange: () => hold.lastChange, reduced: () => sample };
  const nextChange = Timeline.run(timeline, sample).nextChange(host);
  return { t: host, lines, nextChange };
}
