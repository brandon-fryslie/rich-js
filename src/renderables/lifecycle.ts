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
 * Each half is a `Transition` on its own clock from 0, handed the time since
 * its moment, and its schedule carried onto the host's clock by
 * `Timeline.run` is that half's hold — every frame for a fade, once a hold
 * for one on a beat — so the transition's schedule, and `done` read off it,
 * stays the one rule for where a one-shot ends and when its frame changes,
 * and nothing here measures progress itself. The frames carry no word of
 * their own on when they change (`./frames.ts`): drawn at a host time, the
 * host reads the hold through `frameAt`. The exit veils whatever the
 * arrival draws, so an element told to leave while it is still arriving leaves
 * from where it is, never shown whole first. [LAW:dataflow-not-control-flow]
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
import { Recolored } from "./effect.js";
import type { Transition } from "./effects.js";

/** How an element arrives and leaves, and what it is drawn on. */
export interface LifecycleOptions {
  /** The transition it arrives through, made for this element alone — `fadeIn(curve, z)`. */
  readonly enter: Transition;
  /** The transition it leaves through, made for this element alone — `dissolveOut(curve, z)`. */
  readonly exit: Transition;
  /** Names the element for its effects' seeds, as `Effected`'s key does. */
  readonly key: string;
  /** The terminal it is drawn on, whose ground it arrives from and leaves to. */
  readonly theme: TerminalTheme;
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

/** `element` entering at host time `entered`, through `options.enter`, and staying until it is told to `leave`. */
export function lifecycle(element: Renderable, options: LifecycleOptions, entered: number): Lifecycle {
  if (!Number.isFinite(entered)) throw new RangeError(`lifecycle: entered must be a finite time, got ${entered}`);
  return life(element, options, entered, Number.POSITIVE_INFINITY);
}

/**
 * The first host moment `transition`, begun at host time `start`, is done:
 * its own `done` read on host time, never a sum `start + seconds`, which can
 * round to either side of it, as `Animation.sequence` carries its switch.
 * [LAW:single-enforcer] Since `x - start` never falls as `x` rises, a host time
 * is at or past this moment exactly when `done` holds there.
 */
function doneAt(transition: Transition, start: number): number {
  return Number.isFinite(start) ? firstReaching(start, (x) => transition.done(x - start)) : start;
}

function life(element: Renderable, options: LifecycleOptions, entered: number, left: number): Lifecycle {
  const { enter, exit, key, theme } = options;
  const arrived = doneAt(enter, entered);
  const goneAt = doneAt(exit, left);
  // The arrival's schedule on the host's clock: when its frame next changes, and since when it has been what it is.
  const arriving = Timeline.run(Timeline.play(entered), enter.schedule);
  // What the element draws by `t` if it is not leaving: arriving through `enter`, then itself.
  const shown = (t: number): Renderable => (t < arrived ? new Recolored(element, enter.effect, { t: t - entered, key, theme }) : element);
  const held = (schedule: Animation<unknown>, t: number) => ({ last: schedule.lastChange(t), next: schedule.nextChange(t) });
  // [LAW:one-source-of-truth] Each phase's frame and its hold, side by side, so the two cannot disagree.
  // The frames say nothing of when they change — the hold does — so drawn at a host time (`frameAt`) the host reads the hold.
  const phase = (t: number): { readonly frame: Renderable; readonly last: number; readonly next: number } => {
    if (t < entered) return { frame: NOTHING, last: Number.NEGATIVE_INFINITY, next: entered };
    if (t >= goneAt) return { frame: NOTHING, last: goneAt, next: Number.POSITIVE_INFINITY };
    // Leaving veils whatever arriving draws, so both schedules count; once arrived, the arrival's never changes again.
    if (t >= left) {
      const leaving = Animation.all([arriving, Timeline.run(Timeline.play(left), exit.schedule)]);
      return { frame: new Recolored(shown(t), exit.effect, { t: t - left, key, theme }), ...held(leaving, t) };
    }
    if (t < arrived) return { frame: shown(t), ...held(arriving, t) };
    return { frame: element, last: arrived, next: left };
  };
  // [LAW:dataflow-not-control-flow] The same three spans `phase` draws, the transitions gone from them.
  const there = (t: number): { readonly frame: Renderable; readonly last: number; readonly next: number } =>
    t < entered
      ? { frame: NOTHING, last: Number.NEGATIVE_INFINITY, next: entered }
      : t < left
        ? { frame: element, last: entered, next: left }
        : { frame: NOTHING, last: left, next: Number.POSITIVE_INFINITY };
  const present: Animation<Renderable> = {
    at: (t) => there(t).frame,
    nextChange: (t) => there(t).next,
    lastChange: (t) => there(t).last,
    reduced: () => present,
  };
  return {
    entered,
    left,
    at: (t) => phase(t).frame,
    nextChange: (t) => phase(t).next,
    lastChange: (t) => phase(t).last,
    // Reduced, the element is there from when it entered until it is told to leave: no arrival or exit to show, and the times kept.
    reduced: () => present,
    // [LAW:one-source-of-truth] The moment `phase` draws nothing from, so an element not yet told to leave is never asked its exit at -Infinity.
    gone: (t) => t >= goneAt,
    leave(at) {
      if (Number.isFinite(left)) throw new RangeError(`lifecycle: already told to leave at ${left}, told again at ${at}`);
      if (!(Number.isFinite(at) && at >= entered)) throw new RangeError(`lifecycle: leave must be a finite time from entered (${entered}) on, got ${at}`);
      return life(element, options, entered, at);
    },
  };
}
