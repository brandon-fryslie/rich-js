/**
 * An element's lifecycle: it enters, stays, is told to leave, leaves, and is
 * gone — a row added to a table, a line appended to a log, a panel closing.
 * Drawn on the host's clock as an `Animation<Renderable>`, so it is a view a
 * `Live` or an `App` draws as it stands, and a list of them is
 * `Animation.all` of them mapped to whatever lays them out.
 *
 * The two times are handed in, never read: when the element entered, and when
 * it was told to leave — `Infinity` until it is, a time like any other, so no
 * part of the drawing asks whether it is leaving. Telling it is a new value
 * (`leave`), as every `Timeline` operation is. [LAW:no-ambient-temporal-coupling]
 *
 * Each half is a `Half`: handed the element, an `Animation<Renderable>` of
 * it on the half's own clock from 0, in the shape of the library's other
 * one-shot from renderables to an animation (`Change`, `./change.ts`). One
 * value carries the half's frames and its holds, so neither is kept in
 * agreement with the other by hand, and nothing here measures progress
 * itself: a half's schedule carried onto the host's clock by `Timeline.run`
 * is that half's hold — every frame for a fade, once a hold for one on a
 * beat — and the moment it says it never changes again (`Animation.done`)
 * is where the arrival ends and where the element is gone. The frames carry
 * no word of their own on when they change: placed, the lifecycle stamps
 * them with its hold at the frame's time (`placedRender`). The exit is
 * drawn over whatever the arrival draws, so an element told to leave while
 * it is still arriving leaves from where it is, never shown whole first —
 * though a colour exit is spread over the cells each frame shows, so a cell
 * the arrival adds can move one already leaving back toward whole
 * (`ownChange`, `./effects.ts`). [LAW:dataflow-not-control-flow]
 *
 * A half draws the element through a colour transition (`throughColors`, a
 * `fadeIn`) or a glyph one (`throughGlyphs`, a `typewriter`): each binds its
 * transition to the one wrapper that draws it, and to what that wrapper
 * needs — a theme for colours, nothing for glyphs — so nothing here asks which
 * kind a half is, and a line can type itself in and dissolve out. A half
 * written by hand is any function of that shape — an arrival that slides the
 * element in, which no effect draws. An exit is a half that ends with nothing
 * drawn — `dissolveOut`, `backspace`, `scrambleOut` — so the element has
 * already gone from sight when it is gone.
 *
 * Gone is a fact the host reads (`gone(t)`) to drop the element, and from then
 * the lifecycle draws nothing and never changes, so a host still holding it
 * wakes for nothing. Before it entered — asked by a timeline running
 * backwards — it draws nothing too, but is not gone.
 */

import { Animation } from "../core/animation.js";
import type { TerminalTheme } from "../core/color.js";
import { firstReaching } from "../core/easing.js";
import type { Measurable, Renderable } from "../core/protocol.js";
import { Timeline } from "../core/timeline.js";
import { Effected } from "./effect.js";
import type { Transition } from "./effects.js";
import { GlyphEffected } from "./glyph-effect.js";
import type { GlyphTransition } from "./glyph-effects.js";

/**
 * One half of an element's lifecycle: handed the element and `key`, which
 * names it for the half's seeds, the element as the half draws it from
 * `t = 0`, the moment the half began, on its own clock. Its holds are the
 * half's own, whatever element it is handed, and it is done from the first
 * moment it says it never changes again (`Animation.done`): an arrival is
 * the element from then, and an exit is gone. A half that never ends is
 * refused when the lifecycle is made: an `Effected` or `GlyphEffected`
 * handed in bare is one, since its own word is "now" at every time;
 * `throughColors` and `throughGlyphs` lend one the transition's schedule.
 */
export type Half = (element: Renderable, key: string) => Animation<Renderable>;

/** `transition`'s colours drawn over an element on `theme`, whose ground it arrives from and leaves to. */
export function throughColors(transition: Transition, theme: TerminalTheme): Half {
  return (element, key) => scheduled(new Effected(element, transition.effect, { key, theme }), transition.schedule);
}

/** `transition`'s glyphs drawn over an element, at every depth, with no colour too. */
export function throughGlyphs(transition: GlyphTransition): Half {
  return (element, key) => scheduled(new GlyphEffected(element, transition.effect, { key }), transition.schedule);
}

/**
 * `placed` — an element under a transition's effect — changing when
 * `schedule`, the transition's own, says: its frames with the one word on
 * when they change that the transition has and the wrapper lacks, whose own
 * answer is "now" until it is drawn. [LAW:one-source-of-truth] Reduced,
 * both are reduced together, as `onBeat` steps both: a one-shot's effect
 * and its schedule each reduce to a cut at 0 (`transition`, `./effects.ts`).
 */
function scheduled(placed: Animation<Renderable>, schedule: Animation<unknown>): Animation<Renderable> {
  return Animation.of({
    at: (t: number) => placed.at(t),
    nextChange: (t: number) => schedule.nextChange(t),
    lastChange: (t: number) => schedule.lastChange(t),
    reduced: () => scheduled(placed.reduced(), schedule.reduced()),
  });
}

/** How an element arrives and leaves, and what it is named for their seeds. */
export interface LifecycleOptions {
  /** The half it arrives through — `throughColors(fadeIn(curve, z), theme)`. */
  readonly enter: Half;
  /** The half it leaves through — `throughGlyphs(scrambleOut(timing, z))`. */
  readonly exit: Half;
  /** Names the element for both halves' seeds, as `Effected`'s and `GlyphEffected`'s key does. */
  readonly key: string;
}

/** An element on the host's clock, from before it entered to after it is gone. */
export interface Lifecycle extends Animation<Renderable> {
  /** The host time it entered. */
  readonly entered: number;
  /** The host time it was told to leave: `Infinity` until it is. */
  readonly left: number;
  /** Whether it has finished leaving by `t`, so a host drops it. */
  gone(t: number): boolean;
  /** This element told to leave at host time `at`. Throws if it was already told, or `at` is before it entered. */
  leave(at: number): Lifecycle;
}

/** What an element draws before it entered and once it is gone: no cells, and no width. */
const NOTHING: Renderable & Measurable = { render: () => [], measure: () => ({ minimum: 0, maximum: 0 }) };

/**
 * The two halves over the element, and where the arrival ends on the host's
 * clock: found once, when the lifecycle is made, and carried into every
 * `leave`, which changes none of them.
 */
interface Halves {
  readonly arrival: Animation<Renderable>;
  readonly arrived: number;
  readonly departure: Animation<Renderable>;
}

/** `element` entering at host time `entered`, through `options.enter`, and staying until it is told to `leave`. */
export function lifecycle(element: Renderable, options: LifecycleOptions, entered: number): Lifecycle {
  if (!Number.isFinite(entered)) throw new RangeError(`lifecycle: entered must be a finite time, got ${entered}`);
  const { enter, exit, key } = options;
  const arrival = ending(enter(element, key), "enter", key);
  const departure = ending(exit(element, key), "exit", key);
  return life(element, options, { arrival, arrived: doneAt(arrival, entered), departure }, entered, Number.POSITIVE_INFINITY);
}

/**
 * The first host moment `half`, begun at host time `start`, is done: its own
 * answer read on host time, never a sum `start + seconds`, which can round
 * to either side of it, as `Animation.sequence` carries its switch.
 * [LAW:single-enforcer] Since `x - start` never falls as `x` rises, a host
 * time is at or past this moment exactly when `done` holds there. Done is
 * for good, so a half done as it begins — the element at once — is done at
 * `start`, and from a start it is not done at the walk is upward only: no
 * half is asked about a time before it began.
 */
function doneAt(half: Animation<Renderable>, start: number): number {
  if (!Number.isFinite(start) || Animation.done(half, 0)) return start;
  return firstReaching(start, (x) => Animation.done(half, x - start));
}

/**
 * `half` over the element, asked where it ends on its own clock, or refused
 * by its `role` and the element's `key` when it never does. [LAW:no-silent-failure]
 * Kept, it would never arrive, or never be gone, and wake the host every frame
 * for good; asked here, the refusal lands where the options were written and
 * not at the first `leave`. A half on a beat that never ends is refused by the
 * beat instead, where the walk asks it past what its holds resolve.
 */
function ending(half: Animation<Renderable>, role: "enter" | "exit", key: string): Animation<Renderable> {
  if (doneAt(half, 0) === Number.POSITIVE_INFINITY) {
    throw new RangeError(
      `lifecycle "${key}": the ${role} half never ends: its animation never says it has stopped changing (Animation.done). An Effected or GlyphEffected on its own does not; throughColors(transition, theme) and throughGlyphs(transition) lend one the transition's schedule`,
    );
  }
  return half;
}

function life(element: Renderable, options: LifecycleOptions, halves: Halves, entered: number, left: number): Lifecycle {
  const { exit, key } = options;
  const { arrival, arrived, departure } = halves;
  // Where the exit is gone, and the exit's hold, are read off the exit over the element; the frame while
  // leaving is the exit over what is shown, whose holds are the same by `Half`'s contract.
  const goneAt = doneAt(departure, left);
  // The arrival on the host's clock: when its frame next changes, and since when it has been what it is.
  const arriving = Timeline.run(Timeline.play(entered), arrival);
  // What the element draws by `t` if it is not leaving: arriving through `enter`, then itself.
  const shown = (t: number): Renderable => (t < arrived ? arrival.at(t - entered) : element);
  const held = (schedule: Animation<unknown>, t: number) => ({ last: schedule.lastChange(t), next: schedule.nextChange(t) });
  // [LAW:one-source-of-truth] Each phase's frame and its hold, side by side, so the two cannot disagree.
  // The frames say nothing of when they change — the hold does, stamped where the lifecycle is placed.
  const phase = (t: number): { readonly frame: Renderable; readonly last: number; readonly next: number } => {
    if (t < entered) return { frame: NOTHING, last: Number.NEGATIVE_INFINITY, next: entered };
    if (t >= goneAt) return { frame: NOTHING, last: goneAt, next: Number.POSITIVE_INFINITY };
    // Leaving is drawn over whatever arriving draws, so both schedules count; once arrived, the arrival's never changes again.
    if (t >= left) {
      const leaving = Animation.all([arriving, Timeline.run(Timeline.play(left), departure)]);
      return { frame: exit(shown(t), key).at(t - left), ...held(leaving, t) };
    }
    if (t < arrived) return { frame: shown(t), ...held(arriving, t) };
    return { frame: element, last: arrived, next: left };
  };
  // [LAW:dataflow-not-control-flow] The spans `phase` draws, the transitions gone from them: told to
  // leave, nothing shows, and the moment it is `gone` is still one a host is woken for, so it drops it on time.
  const there = (t: number): { readonly frame: Renderable; readonly last: number; readonly next: number } =>
    t < entered
      ? { frame: NOTHING, last: Number.NEGATIVE_INFINITY, next: entered }
      : t < left
        ? { frame: element, last: entered, next: left }
        : { frame: NOTHING, last: left, next: t < goneAt ? goneAt : Number.POSITIVE_INFINITY };
  const present: Animation<Renderable> = Animation.of({
    at: (t: number) => there(t).frame,
    nextChange: (t: number) => there(t).next,
    lastChange: (t: number) => there(t).last,
    reduced: () => present,
  });
  return Animation.of({
    entered,
    left,
    at: (t: number) => phase(t).frame,
    nextChange: (t: number) => phase(t).next,
    lastChange: (t: number) => phase(t).last,
    // Reduced, the element is there from when it entered until it is told to leave: no arrival or exit to show, and the times kept.
    reduced: () => present,
    // [LAW:one-source-of-truth] The moment `phase` draws nothing from, so an element not yet told to leave is never asked its exit at -Infinity.
    gone: (t: number) => t >= goneAt,
    leave(at: number): Lifecycle {
      if (Number.isFinite(left)) throw new RangeError(`lifecycle: already told to leave at ${left}, told again at ${at}`);
      if (!(Number.isFinite(at) && at >= entered)) throw new RangeError(`lifecycle: leave must be a finite time from entered (${entered}) on, got ${at}`);
      return life(element, options, halves, entered, at);
    },
  });
}
