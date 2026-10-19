/**
 * Animation — a value for a time, and when it next changes: the one type
 * anything in rich-js that changes with time is an instance of.
 *
 * `at(t)` is the value at `t` seconds. `nextChange(t)` is the first moment,
 * on `t`'s own timeline, at which the value may stop being `at(t)`: never
 * before `t`. A later time says the value is held until then, `Infinity`
 * that it never changes again, and `t` itself that it is moving at `t` — it
 * changes every frame, however close together they are drawn. An early
 * answer costs a host a frame that draws what the last one did; a late one
 * skips a change. So an animation that cannot say answers `t`, as
 * `continuous` does. A value drawn as cells carries this answer on every
 * cell (`Style.nextChange`), so a host holding the composed frame reads it
 * there (`Segment.nextChange`); a value that is not drawn — a number, a
 * colour — has `nextChange` as its only way to say when to look again.
 *
 * The instances already in the tree: a `Beat` is an animation of which hold
 * is in progress (`./easing.ts`), a `FrameSequence` of the frame shown and a
 * `Spinner` of the spinner drawn (`../renderables/`), and an `Effect` is, for
 * what an element draws in a frame, an animation of how its cells' colours
 * move (`../renderables/effect.ts`). Every kind of motion is one more.
 *
 * [LAW:no-ambient-temporal-coupling] Pure: `t` is an argument and never a
 * clock read (`./clock.ts`), the same `t` gives the same value, nothing is
 * kept between calls, and a call costs the same at `t = 0` and `t = 10⁶`, so
 * a host sampling once a second and one sampling sixty times see the same
 * value at every `t` they share.
 *
 * [LAW:one-type-per-behavior] The combinators here are the ones every kind
 * of motion is built from — a constant, a value moving every moment, a map
 * over the value, several at once, and one animation after another — and each says how
 * `nextChange` composes, so an animation built from them answers it without
 * its author doing anything.
 */

import { positiveSeconds, walkUp } from "./easing.js";

/** A value of `T` at a time in seconds, and the first moment that value may change. */
export interface Animation<T> {
  /** The value at `t` seconds. */
  at(t: number): T;
  /** The first moment, never before `t`, at which the value may stop being `at(t)`: `t` while it moves, `Infinity` once it never will. */
  nextChange(t: number): number;
}

export const Animation = {
  /** `value` at every time, never changing. */
  constant<T>(value: T): Animation<T> {
    return { at: () => value, nextChange: () => Number.POSITIVE_INFINITY };
  },

  /**
   * The value `at` gives, taken to move at every moment: what an animation
   * that cannot say when it holds still is, so a host draws it every frame.
   */
  continuous<T>(at: (t: number) => T): Animation<T> {
    return { at, nextChange: (t) => t };
  },

  /**
   * `animation`'s value through `f`, changing when it does. Two values `f`
   * maps alike make an early answer, which the contract allows.
   */
  map<T, U>(animation: Animation<T>, f: (value: T) => U): Animation<U> {
    return { at: (t) => f(animation.at(t)), nextChange: (t) => animation.nextChange(t) };
  },

  /**
   * Every one of `animations` at once, their values in order, changing when
   * the soonest of them does — so a stack of effects drawn together holds
   * still exactly while each of them does. None never changes.
   */
  all<T>(animations: readonly Animation<T>[]): Animation<T[]> {
    return {
      at: (t) => animations.map((animation) => animation.at(t)),
      nextChange: (t) => Math.min(...animations.map((animation) => animation.nextChange(t))),
    };
  },

  /**
   * `first` until `seconds`, then `then`, handed the time since it began —
   * each part on its own clock from 0, as every effect is. Before the switch
   * the value next changes when `first`'s does or at the switch, whichever is
   * sooner; after it, when `then`'s does, carried back onto this timeline.
   */
  sequence<T>(first: Animation<T>, seconds: number, then: Animation<T>): Animation<T> {
    positiveSeconds("Animation.sequence seconds", seconds);
    return {
      at: (t) => (t - seconds >= 0 ? then.at(t - seconds) : first.at(t)),
      nextChange(t) {
        const into = t - seconds;
        if (into < 0) return Math.min(first.nextChange(t), seconds);
        const local = then.nextChange(into);
        // `local + seconds` can round under the first moment whose time since
        // the switch reaches `local`, where `at` still shows the old value.
        const moment = walkUp(local + seconds, (x) => x - seconds >= local, () => `Animation.sequence: no time resolves ${local} s after a switch at ${seconds} s`);
        return Math.max(t, moment);
      },
    };
  },
};
