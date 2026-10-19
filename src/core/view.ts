/**
 * View — what a host draws, and the frame it draws from it at a host time on
 * its timeline: the lines, and when they change on the host's clock.
 *
 * A host — a `Live`, an `App` — reads its clock once a frame and draws its
 * view for that moment. The view is one of three shapes a program hands
 * over, and `viewAnimation` makes them one before a frame is drawn: a
 * renderable, the view that is the same at every time (a table mutated in
 * place between frames); a function of the time, asked for a renderable each
 * frame, as every host's view was before the `Animation` type existed; and
 * an `Animation<Renderable>`, which says itself when what it draws changes —
 * a tween driving a width, mapped to the bar that shows it, is one, and it
 * is how a value that is never drawn as cells tells the host when to look
 * again (`./animation.ts`). [LAW:parse-dont-validate]
 *
 * The time a view is asked for is the host's time through its `Timeline`
 * (`./timeline.ts`), so pausing, reversing, scrubbing and speeding up what a
 * host shows are changes to one value the host holds and not to anything it
 * draws. What the drawn frame says about when it changes is then on the
 * timeline's clock, and `drawView` carries it back onto the host's by
 * running the frame through the same timeline: the frame is the sample of
 * the view it is — held until the sooner of what the view says
 * (`nextChange`) and what its cells say (`Segment.nextChange`, the stamp
 * every `Frames` and `Effected` leaves), since when the view says — and
 * `Timeline.run` is the one place a hold is mapped onto host time, forwards,
 * backwards or paused. [LAW:one-source-of-truth]
 *
 * A function view says nothing itself: its cells say when the frame changes,
 * and nothing says since when, so run backwards it is drawn at the host's
 * rate — a hold with one side known is a hold the host may leave any moment
 * in the other direction, and an early answer costs a frame where a late one
 * skips a change. A renderable is `Animation.constant`: it never says it
 * changes, and a host that draws it at its rate draws it at its rate.
 *
 * Tier 4 of `src/core/`: `./animation.ts`, `./timeline.ts`, `./segment.ts`
 * and `./protocol.ts`, nothing else. [LAW:one-way-deps]
 */

import { Animation } from "./animation.js";
import type { Renderable } from "./protocol.js";
import { Segment } from "./segment.js";
import { Timeline } from "./timeline.js";

/**
 * What a host draws: a renderable the same at every time, a renderable for a
 * time — `(t) => spinner.at(t)` — or an animation of one, which says itself
 * when what it draws changes. `t` is in seconds on the host's timeline.
 */
export type View = Renderable | ((t: number) => Renderable) | Animation<Renderable>;

/** `view` as the one shape a host draws: a renderable is constant, a function is asked each frame and says nothing itself. */
export function viewAnimation(view: View): Animation<Renderable> {
  if (typeof view === "function") return { at: view, nextChange: () => Number.POSITIVE_INFINITY, lastChange: (t) => t };
  return "render" in view ? Animation.constant(view) : view;
}

/** A frame drawn from a view: the lines, when on the host's clock they change, and the host time they were drawn at. */
export interface DrawnView {
  /** The host time the frame was drawn at. */
  readonly t: number;
  readonly lines: Segment[][];
  /** The first host moment, never before `t`, at which the frame may stop showing this: `t` while it moves, `Infinity` once it never will. */
  readonly nextChange: number;
}

/**
 * `view` drawn at host time `host` through `timeline`, its lines shaped by
 * `draw` — the host's own render, with its width, height and overflow — and
 * when the frame changes on the host's clock: the sooner of what the view
 * says and what its cells say, carried back through the timeline.
 */
export function drawView(view: Animation<Renderable>, timeline: Timeline, host: number, draw: (renderable: Renderable) => Segment[][]): DrawnView {
  const t = Timeline.at(timeline, host);
  const lines = draw(view.at(t));
  // The frame as the sample of the view it is, on the timeline's clock; the
  // timeline says when the host's clock leaves its hold.
  const held: Animation<Segment[][]> = {
    at: () => lines,
    nextChange: () => Math.min(view.nextChange(t), lines.reduce((soonest, row) => Math.min(soonest, Segment.nextChange(row)), Number.POSITIVE_INFINITY)),
    lastChange: () => view.lastChange(t),
  };
  return { t: host, lines, nextChange: Timeline.run(timeline, held).nextChange(host) };
}
