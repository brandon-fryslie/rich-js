/**
 * View — what a host draws, and the frame it draws from it at a host time on
 * its timeline: the lines, and what they say about when they change.
 *
 * A host — a `Live`, an `App` — reads its clock once a frame and draws its
 * view for that moment. The view is one of two shapes a program hands over,
 * and `hostView` tags it. A renderable is drawn as it is now (a table
 * mutated in place between frames), at the time the host's `Timeline`
 * (`./timeline.ts`) maps its clock to, written on the frame
 * (`RenderOptions.frame`): every animation placed anywhere inside it draws
 * at that time and stamps its cells with when it changes, on that clock
 * (`placedRender`, `./animation.ts`). A function of the time is asked for a
 * renderable each frame, at the same time. [LAW:parse-dont-validate]
 *
 * So pausing, reversing, scrubbing and speeding up what a host shows are
 * changes to one value the host holds and not to anything it draws. What the
 * drawn frame says about when it changes is on the timeline's clock, and
 * `drawView` carries it back onto the host's by running the frame through
 * the same timeline: the frame is a sample held for the intersection of its
 * cells' holds (`Segment.lastChange`, `Segment.nextChange`) and the holds it
 * was told that no cell carries (`RenderOptions.onHold`), and
 * `Timeline.run` is the one place a hold is mapped onto host time, forwards,
 * backwards or paused. [LAW:one-source-of-truth]
 *
 * What a host does with that is its own policy, and it reads every fact the
 * policy needs off the `DrawnView` — when the frame changes, and whether it
 * was drawn for a held time — so no host asks again what kind of view it
 * holds or what its timeline is doing. Either kind may also change without
 * saying so — it reads state the host cannot see — so a host that polls for
 * such a change, a `Live`'s auto-refresh, polls every frame.
 *
 * A function view says nothing since when: its cells say when the frame
 * changes, and run backwards it is drawn at the host's rate — a hold with
 * one side known is a hold the host may leave any moment in the other
 * direction, and an early answer costs a frame where a late one skips a
 * change.
 *
 * Tier 7 of `src/core/`: `./animation.ts`, `./timeline.ts`, `./segment.ts`,
 * `./protocol.ts` and `./style.ts`'s `Hold`, nothing else. [LAW:one-way-deps]
 */

import { Animation, shownAt } from "./animation.js";
import type { FrameHost, Renderable, RenderOptions } from "./protocol.js";
import { Segment } from "./segment.js";
import type { Hold } from "./style.js";
import { Timeline } from "./timeline.js";

/**
 * What a host draws: a renderable — an animation of renderables among them,
 * or anything holding one — or a renderable for a time, `t` in seconds on
 * the host's timeline.
 */
export type View = Renderable | ((t: number) => Renderable);

/** A view as a host holds it: a renderable, or a function drawing from state the host cannot see as well as from `t`. */
export type HostView =
  | { readonly kind: "renderable"; readonly renderable: Renderable }
  | { readonly kind: "function"; readonly animation: Animation<Renderable> };

/**
 * A function view as the animation it is on the timeline: asked each frame,
 * saying nothing itself — its cells say when it changes, and nothing says
 * since when. Reduced, it is itself, still asked at the time: what the
 * program computes from `t` — a log it appends to, a clock it shows — is its
 * own and stays on time, and every animation placed in what it returns is
 * reduced where it is drawn (`shownAt`).
 */
export function functionView(view: (t: number) => Renderable): Animation<Renderable> {
  const asked: Animation<Renderable> = Animation.of({ at: view, nextChange: () => Number.POSITIVE_INFINITY, lastChange: (t: number) => t, reduced: () => asked });
  return asked;
}

/** `view` as a host holds it. */
export function hostView(view: View): HostView {
  return typeof view === "function" ? { kind: "function", animation: functionView(view) } : { kind: "renderable", renderable: view };
}

/**
 * `view` with every renderable it draws made by `f`, of the kind it was. `f`
 * is handed the asking, not its answer, so a function view is called
 * wherever `f` calls it — inside a tracked render, say.
 */
export function mapView(view: View, f: (renderable: () => Renderable) => Renderable): View {
  return typeof view === "function" ? (t) => f(() => view(t)) : f(() => view);
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
  /**
   * Whether nothing on the timeline moves from this frame: drawn for the held
   * time of a paused timeline, until it plays again — what a program that
   * said its view moves (`App.animate`) is not painted for meanwhile.
   */
  readonly held: boolean;
}

/** A frame drawn from a view: its lines, and what it says. */
export interface DrawnView extends FrameSays {
  readonly lines: Segment[][];
}

/** What a frame not yet drawn at host time `t` says: nothing. */
export const undrawn = (t: number): FrameSays => ({ t, nextChange: Number.POSITIVE_INFINITY, held: false });

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
  view: HostView,
  time: HostTime,
  drawnBy: FrameHost,
  options: RenderOptions,
  draw: (renderable: Renderable, options: RenderOptions) => Segment[][],
): DrawnView {
  const { now: host, timeline } = time;
  const t = frameTime(time);
  let told: Hold = { lastChange: Number.NEGATIVE_INFINITY, nextChange: Number.POSITIVE_INFINITY };
  const onHold = (hold: Hold): void => {
    told = { lastChange: Math.max(told.lastChange, hold.lastChange), nextChange: Math.min(told.nextChange, hold.nextChange) };
  };
  const lines = draw(view.kind === "renderable" ? view.renderable : shownAt(view.animation, t, options).value, { ...options, frame: { time: t, host: drawnBy }, onHold });
  const hold = frameHold(lines, told);
  // The frame as the sample of the view it is, on the timeline's clock; the
  // timeline says when the host's clock leaves its hold. A function view
  // says nothing since when, so it answers `t` there.
  const began = view.kind === "renderable" ? hold.lastChange : t;
  const sample: Animation<Segment[][]> = { at: () => lines, nextChange: () => hold.nextChange, lastChange: () => began, reduced: () => sample };
  const nextChange = Timeline.run(timeline, sample).nextChange(host);
  return { t: host, lines, nextChange, held: !timeline.playing };
}
