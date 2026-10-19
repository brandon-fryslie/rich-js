/**
 * View — what a host draws, and the frame it draws from it at a host time on
 * its timeline: the lines, and when they change on the host's clock.
 *
 * A host — a `Live`, an `App` — reads its clock once a frame and draws its
 * view for that moment. The view is one of three shapes a program hands
 * over, and `hostView` makes them the two a host holds before a frame is
 * drawn. A renderable is off the timeline: it is never handed a time, it is
 * drawn as it is now (a table mutated in place between frames), and whatever
 * its cells say about when they change they say on the host's clock, which
 * is the only one a renderable can read — a `Progress` stamps its spinner
 * cells at its own clock's now. A function of the time, asked for a
 * renderable each frame, and an `Animation<Renderable>` are on the timeline:
 * each is asked for the time the timeline maps the host's to, and what it
 * says, itself or on its cells, is on the timeline's clock. An animation is
 * how a value that is never drawn as cells tells the host when to look again
 * — a tween driving a width, mapped to the bar that shows it
 * (`./animation.ts`). [LAW:parse-dont-validate]
 *
 * The time a view on the timeline is asked for is the host's time through
 * its `Timeline` (`./timeline.ts`), so pausing, reversing, scrubbing and
 * speeding up what a host shows are changes to one value the host holds and
 * not to anything it draws. What the drawn frame says about when it changes
 * is then on the timeline's clock, and `drawView` carries it back onto the
 * host's by running the frame through the same timeline: the frame is the
 * sample of the view it is — held until the sooner of what the view says
 * (`nextChange`) and what its cells say (`Segment.nextChange`, the stamp
 * every `Frames` and `Effected` leaves), since when the view says — and
 * `Timeline.run` is the one place a hold is mapped onto host time, forwards,
 * backwards or paused. [LAW:one-source-of-truth]
 *
 * A function view says nothing itself: its cells say when the frame changes,
 * and nothing says since when, so run backwards it is drawn at the host's
 * rate — a hold with one side known is a hold the host may leave any moment
 * in the other direction, and an early answer costs a frame where a late one
 * skips a change. An animation's frame whose cells change is the same.
 *
 * A view on the timeline is drawn at the time it is handed, and its cells
 * are stamped on that clock; a renderable inside it that reads a clock of
 * its own — a `Progress` — stamps the host's instead, which the timeline
 * would carry somewhere else. Hand such a renderable over as the view
 * itself, off the timeline.
 *
 * Tier 4 of `src/core/`: `./animation.ts`, `./timeline.ts`, `./segment.ts`
 * and `./protocol.ts`, nothing else. [LAW:one-way-deps]
 */

import type { Animation } from "./animation.js";
import type { Renderable } from "./protocol.js";
import { Segment } from "./segment.js";
import { Timeline } from "./timeline.js";

/**
 * What a host draws: a renderable as it is now, a renderable for a time —
 * `(t) => spinner.at(t)` — or an animation of one, which says itself when
 * what it draws changes. `t` is in seconds on the host's timeline.
 */
export type View = Renderable | ((t: number) => Renderable) | Animation<Renderable>;

/** A view as a host holds it: a renderable off the timeline, or an animation of one on it. */
export type HostView = Renderable | Animation<Renderable>;

/** A function view as the animation it is on the timeline: asked each frame, saying nothing itself — its cells say when it changes, and nothing says since when. */
export function functionView(view: (t: number) => Renderable): Animation<Renderable> {
  return { at: view, nextChange: () => Number.POSITIVE_INFINITY, lastChange: (t) => t };
}

/** `view` as a host holds it. */
export function hostView(view: View): HostView {
  return typeof view === "function" ? functionView(view) : view;
}

/**
 * `view` with every renderable it draws made by `f`, on or off the timeline
 * as it was. `f` is handed the asking, not its answer, so a function view is
 * called wherever `f` calls it — inside a tracked render, say.
 */
export function mapView(view: HostView, f: (renderable: () => Renderable) => Renderable): HostView {
  return "render" in view
    ? f(() => view)
    : { at: (t) => f(() => view.at(t)), nextChange: (t) => view.nextChange(t), lastChange: (t) => view.lastChange(t) };
}

/**
 * Whether `view` is held still by `timeline`: on it, and the timeline
 * paused, so nothing it draws changes until the timeline plays again and a
 * host waits on nothing — not its rate, not its `animate()`. A renderable is
 * off the timeline, and pausing it holds nothing.
 */
export function frozen(view: HostView, timeline: Timeline): boolean {
  return !("render" in view) && !timeline.playing;
}

/** A frame drawn from a view: the lines, when on the host's clock they change, and the host time they were drawn at. */
export interface DrawnView {
  /** The host time the frame was drawn at. */
  readonly t: number;
  readonly lines: Segment[][];
  /** The first host moment, never before `t`, at which the frame may stop showing this: `t` while it moves, `Infinity` once it never will. */
  readonly nextChange: number;
}

/** The soonest moment any cell of `lines` says it changes, on whatever clock it was drawn at. */
const cellsChange = (lines: Segment[][]): number =>
  lines.reduce((soonest, row) => Math.min(soonest, Segment.nextChange(row)), Number.POSITIVE_INFINITY);

/**
 * `view` drawn at host time `host` through `timeline`, its lines shaped by
 * `draw` — the host's own render, with its width, height and overflow — and
 * when the frame changes on the host's clock: for a renderable, what its
 * cells say; for an animation, the sooner of what it says and what its cells
 * say, carried back through the timeline.
 */
export function drawView(view: HostView, timeline: Timeline, host: number, draw: (renderable: Renderable) => Segment[][]): DrawnView {
  if ("render" in view) {
    const lines = draw(view);
    return { t: host, lines, nextChange: Math.max(host, cellsChange(lines)) };
  }
  const t = Timeline.at(timeline, host);
  const lines = draw(view.at(t));
  const cells = cellsChange(lines);
  // The frame as the sample of the view it is, on the timeline's clock; the
  // timeline says when the host's clock leaves its hold. Cells say only when
  // they next change, never since when, so a frame whose cells change at all
  // cannot say when it began and answers `t`: run backwards, an effect still
  // moving after its tween has arrived is drawn at the rate, not frozen
  // until the tween's end comes round.
  const held: Animation<Segment[][]> = {
    at: () => lines,
    nextChange: () => Math.min(view.nextChange(t), cells),
    lastChange: () => (cells < Number.POSITIVE_INFINITY ? t : view.lastChange(t)),
  };
  return { t: host, lines, nextChange: Timeline.run(timeline, held).nextChange(host) };
}
