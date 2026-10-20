/**
 * View — what a host draws, and the frame it draws from it at a host time on
 * its timeline: the lines, and what they say about when they change.
 *
 * A host — a `Live`, an `App` — reads its clock once a frame and draws its
 * view for that moment. The view is one of three shapes a program hands
 * over, and `hostView` tags it by what it can say before a frame is drawn.
 * A renderable is off the timeline: it is never handed a time, it is drawn
 * as it is now (a table mutated in place between frames), and whatever its
 * cells say about when they change they say on the host's clock, which is
 * the only one a renderable can read — a `Progress` stamps its spinner cells
 * at its own clock's now. A function of the time, asked for a renderable
 * each frame, and an `Animation<Renderable>` are on the timeline: each is
 * asked for the time the timeline maps the host's to, and what it says,
 * itself or on its cells, is on the timeline's clock. An animation is how a
 * value that is never drawn as cells tells the host when to look again — a
 * tween driving a width, mapped to the bar that shows it (`./animation.ts`).
 * [LAW:parse-dont-validate]
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
 * What a host does with that is its own policy, and it reads every fact the
 * policy needs off the `DrawnView` — when the frame changes, whether it may
 * change without saying so, whether it was drawn for a held time — so no
 * host asks again what kind of view it holds or what its timeline is doing.
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
import type { FrameHost, Motion, Renderable, RenderOptions } from "./protocol.js";
import { Segment } from "./segment.js";
import { Timeline } from "./timeline.js";

/**
 * What a host draws: a renderable as it is now, a renderable for a time —
 * `(t) => spinner.drawnAt(t)`, whose cells say when it next changes — or an
 * animation of one, which says itself when what it draws changes. An
 * animation's `at(t)` says nothing of when it changes (`frameAt` stamps it),
 * so a function view returning one never wakes. `t` is in seconds on the
 * host's timeline.
 */
export type View = Renderable | ((t: number) => Renderable) | Animation<Renderable>;

/**
 * A view as a host holds it, by what it can say: a renderable, off the
 * timeline; a function, on it, drawing from state the host cannot see as
 * well as from `t`; an animation, on it, saying itself when it changes.
 */
export type HostView =
  | { readonly kind: "renderable"; readonly renderable: Renderable }
  | { readonly kind: "function"; readonly animation: Animation<Renderable> }
  | { readonly kind: "animation"; readonly animation: Animation<Renderable> };

/**
 * A function view as the animation it is on the timeline: asked each frame,
 * saying nothing itself — its cells say when it changes, and nothing says
 * since when. Reduced, it is itself, still asked at the time: what the
 * program computes from `t` — a log it appends to, a clock it shows — is its
 * own and stays on time, and every animation it hands a renderable built for
 * the time is reduced where that renderable draws (`shownAt`).
 */
export function functionView(view: (t: number) => Renderable): Animation<Renderable> {
  const asked: Animation<Renderable> = { at: view, nextChange: () => Number.POSITIVE_INFINITY, lastChange: (t) => t, reduced: () => asked };
  return asked;
}

/** `view` as a host holds it. */
export function hostView(view: View): HostView {
  if (typeof view === "function") return { kind: "function", animation: functionView(view) };
  return "render" in view ? { kind: "renderable", renderable: view } : { kind: "animation", animation: view };
}

/**
 * `view` with every renderable it draws made by `f`, of the kind it was. `f`
 * is handed the asking, not its answer, so a function view is called
 * wherever `f` calls it — inside a tracked render, say.
 */
export function mapView(view: View, f: (renderable: () => Renderable) => Renderable): View {
  if (typeof view === "function") return (t) => f(() => view(t));
  if ("render" in view) return f(() => view);
  return mapAnimation(view, f);
}

function mapAnimation(view: Animation<Renderable>, f: (renderable: () => Renderable) => Renderable): Animation<Renderable> {
  return { at: (t) => f(() => view.at(t)), nextChange: (t) => view.nextChange(t), lastChange: (t) => view.lastChange(t), reduced: () => mapAnimation(view.reduced(), f) };
}

/** What a frame drawn at a time shows of an animation, and what that says. */
export interface Shown<T> {
  readonly value: T;
  /** The first moment, never before the time drawn at, the value may stop being this. */
  readonly nextChange: number;
  /** The animation the value is drawn from: the one handed in, or under reduced motion its reduced form. */
  readonly drawn: Animation<T>;
  /** Whether it is the animation reduced: drawn under reduced motion, changing only where content does. */
  readonly reduced: boolean;
}

/**
 * What a frame drawn at `t` shows of `animation` under `motion`, and when
 * that changes: the animation's, or under reduced motion its reduced form's
 * (`Animation.reduced`). [LAW:single-enforcer] The one place the preference
 * is read: a host drawing its view (`drawView`), and every renderable built
 * for the time it draws at — `Effected`, `GlyphEffected`, a spinner's
 * `drawnAt`, a `Frames`, `frameAt`'s frame of a renderable, the template
 * functions — choose here, so a host told once reduces every one.
 */
export function shownAt<T>(animation: Animation<T>, t: number, motion: Motion): Shown<T> {
  const reduced = motion.reducedMotion === true;
  const drawn = reduced ? animation.reduced() : animation;
  return { value: drawn.at(t), nextChange: drawn.nextChange(t), drawn, reduced };
}

/**
 * The time a frame of `view` drawn at host time `host` is drawn for, on the
 * clock its cells are stamped on: the host's own for a renderable, off the
 * timeline; the time `timeline` maps it to for a view on it.
 * [LAW:single-enforcer] `drawView` draws at it and hands it to the frame as
 * `RenderOptions.frame`, and a host reads it here for anything heard
 * between frames — a key — so a moment a widget keeps and the frame it is
 * compared against are on one clock.
 */
export function frameTime(view: HostView, timeline: Timeline, host: number): number {
  return view.kind === "renderable" ? host : Timeline.at(timeline, host);
}

/** What a frame drawn at host time `t` says about when it changes. */
export interface FrameSays {
  /** The host time the frame was drawn at. */
  readonly t: number;
  /** The first host moment, never before `t`, at which the frame may stop showing this: `t` while it moves, `Infinity` once it never will. */
  readonly nextChange: number;
  /**
   * Whether the frame may also change without saying so: drawn from a
   * renderable or a function, which read state the host cannot see, so a
   * host that polls for such a change — a `Live`'s auto-refresh — polls it.
   * An animation says everything it changes, and its frame is not polled.
   */
  readonly silent: boolean;
  /**
   * Whether nothing on the timeline moves from this frame: drawn for the held
   * time of a paused timeline, until it plays again, or an animation view
   * reduced, which says itself every moment its content changes — what a
   * program that said its view moves (`App.animate`) is not painted for
   * meanwhile. A function view computes from `t` what no animation says, so
   * reduced motion does not hold it. A renderable is off the timeline, and is
   * never held.
   */
  readonly held: boolean;
}

/** A frame drawn from a view: its lines, and what it says. */
export interface DrawnView extends FrameSays {
  readonly lines: Segment[][];
}

/** What a frame not yet drawn at host time `t` says: nothing, so a host that polls polls from `t`. */
export const undrawn = (t: number): FrameSays => ({ t, nextChange: Number.POSITIVE_INFINITY, silent: true, held: false });

/** The soonest moment any cell of `lines` says it changes, on whatever clock it was drawn at. */
const cellsChange = (lines: Segment[][]): number =>
  lines.reduce((soonest, row) => Math.min(soonest, Segment.nextChange(row)), Number.POSITIVE_INFINITY);

/**
 * `view` drawn at host time `host` through `timeline` under `options`, its
 * lines shaped by `draw` — the host's own render under those options, with
 * its height and overflow — and when the frame changes on the host's clock:
 * for a renderable, what its cells say; for a view on the timeline, the
 * sooner of what it says and what its cells say, carried back through the
 * timeline. [LAW:one-source-of-truth] `options` is the one place the frame
 * reads the reader's preference for motion: under reduced motion a view on
 * the timeline is drawn reduced (`shownAt`), and every animation drawn for
 * the host's time inside any view is reduced where it is drawn, through the
 * same options handed on to `draw`, which carry the frame: the time it is
 * drawn for (`frameTime`) and `drawnBy`, the host whose time that is.
 */
export function drawView(
  view: HostView,
  timeline: Timeline,
  host: number,
  drawnBy: FrameHost,
  options: RenderOptions,
  draw: (renderable: Renderable, options: RenderOptions) => Segment[][],
): DrawnView {
  const t = frameTime(view, timeline, host);
  const drawing: RenderOptions = { ...options, frame: { time: t, host: drawnBy } };
  if (view.kind === "renderable") {
    const lines = draw(view.renderable, drawing);
    return { t: host, lines, nextChange: Math.max(host, cellsChange(lines)), silent: true, held: false };
  }
  const { animation } = view;
  const shown = shownAt(animation, t, options);
  const lines = draw(shown.value, drawing);
  const cells = cellsChange(lines);
  // The frame as the sample of the view it is, on the timeline's clock; the
  // timeline says when the host's clock leaves its hold. Cells say only when
  // they next change, never since when, so a frame whose cells change at all
  // cannot say when it began and answers `t`: run backwards, an effect still
  // moving after its tween has arrived is drawn at the rate, not frozen
  // until the tween's end comes round.
  const sample: Animation<Segment[][]> = {
    at: () => lines,
    nextChange: () => Math.min(shown.nextChange, cells),
    lastChange: () => (cells < Number.POSITIVE_INFINITY ? t : shown.drawn.lastChange(t)),
    reduced: () => sample,
  };
  const nextChange = Timeline.run(timeline, sample).nextChange(host);
  const silent = view.kind === "function";
  return { t: host, lines, nextChange, silent, held: !timeline.playing || (shown.reduced && !silent) };
}
