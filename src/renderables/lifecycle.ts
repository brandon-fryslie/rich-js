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
 * its moment, so `transition`'s `done` stays the one rule for where a one-shot
 * ends and nothing here measures progress itself. The exit veils whatever the
 * arrival draws, so an element told to leave while it is still arriving leaves
 * from where it is, never shown whole first. [LAW:dataflow-not-control-flow]
 *
 * Gone is a fact the host reads (`gone(t)`) to drop the element, and from then
 * the lifecycle draws nothing and never changes, so a host still holding it
 * wakes for nothing. Before it entered — asked by a timeline running
 * backwards — it draws nothing too, but is not gone.
 */

import type { Animation } from "../core/animation.js";
import type { TerminalTheme } from "../core/color.js";
import { firstReaching } from "../core/easing.js";
import { Measurement } from "../core/measure.js";
import type { Composite, Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { Effected } from "./effect.js";
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
 * its own `done` read on host time, never the sum `start + seconds`, which can
 * round to either side of it, as `Animation.sequence` carries its switch.
 * [LAW:single-enforcer] Since `x - start` never falls as `x` rises, a host time
 * is at or past this moment exactly when `done` holds there.
 */
function doneAt(transition: Transition, start: number): number {
  return Number.isFinite(start) ? firstReaching(start + transition.seconds, (x) => transition.done(x - start)) : start;
}

function life(element: Renderable, options: LifecycleOptions, entered: number, left: number): Lifecycle {
  const { enter, exit, key, theme } = options;
  const arrived = doneAt(enter, entered);
  const goneAt = doneAt(exit, left);
  // What the element draws by `t` if it is not leaving: arriving through `enter`, then itself.
  const shown = (t: number): Renderable => (t < arrived ? new Effected(element, enter.effect, { t: t - entered, key, theme }) : element);
  // [LAW:one-source-of-truth] Each phase's frame and its hold, side by side, so the two cannot disagree.
  const phase = (t: number): { readonly frame: Renderable; readonly last: number; readonly next: number } => {
    if (t < entered) return { frame: NOTHING, last: Number.NEGATIVE_INFINITY, next: entered };
    if (t >= goneAt) return { frame: NOTHING, last: goneAt, next: Number.POSITIVE_INFINITY };
    if (t >= left) return { frame: new Effected(shown(t), exit.effect, { t: t - left, key, theme }), last: t, next: t };
    if (t < arrived) return { frame: shown(t), last: t, next: t };
    return { frame: element, last: arrived, next: left };
  };
  return {
    entered,
    left,
    at(t) {
      const { frame, next } = phase(t);
      return new LifecycleFrame(frame, next);
    },
    nextChange: (t) => phase(t).next,
    lastChange: (t) => phase(t).last,
    gone: (t) => exit.done(t - left),
    leave(at) {
      if (Number.isFinite(left)) throw new RangeError(`lifecycle: already told to leave at ${left}, told again at ${at}`);
      if (!(Number.isFinite(at) && at >= entered)) throw new RangeError(`lifecycle: leave must be a finite time from entered (${entered}) on, got ${at}`);
      return life(element, options, entered, at);
    },
  };
}

/**
 * A lifecycle's frame: what it draws, its cells stamped with when it next
 * changes. With no colour output an `Effected` hands its child's cells back
 * unstamped, and the cut from leaving to gone changes no colour, so the frame
 * says it itself or a host drawing it inside a function view never wakes for it.
 */
class LifecycleFrame implements Renderable, Measurable, Composite {
  constructor(
    readonly frame: Renderable,
    readonly nextChange: number,
  ) {}

  render(options: RenderOptions): Iterable<Segment> {
    return Segment.applyStyle(render(this.frame, options), new Style({ nextChange: this.nextChange }));
  }

  *contents(): Iterable<Renderable> {
    yield this.frame;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.frame);
  }
}
