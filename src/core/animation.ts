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
 * `lastChange(t)` is the other end of the same hold: the last moment, never
 * after `t`, at which the value may have become `at(t)` — `-Infinity` if it
 * always was, `t` while it moves. Together they bound the hold, `[lastChange(t),
 * nextChange(t))`, and the answer may be narrower than the truth and never
 * wider. It is what a host running the animation backwards reads
 * (`./timeline.ts`): run down the timeline, the value next changes where it
 * began. An animation that cannot say answers `t` here too.
 *
 * `reduced()` is the same animation with its motion taken out: what it shows,
 * and when it starts and stops showing it, kept; every moment between two
 * values skipped. A loop holds its first value, a one-shot its end, a
 * transition its new state, a stagger has everyone arrived, and an element is
 * there from when it entered until it is told to leave. Terminals have no
 * `prefers-reduced-motion`, so a host is told (`reducedMotion`,
 * `./protocol.ts`), and under it draws every animation's reduced form, which
 * wakes it only where content changes. It is the one place the preference is
 * honoured for every kind at once, because every kind is this type, and each
 * combinator says its reduced form so a built animation answers it too.
 * [LAW:types-are-the-program] It is an animation and not a value because
 * which content shows is a fact about time that motion is not: a value with
 * no time could only show a scheduled exit as already gone.
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

import { firstReaching, positiveSeconds, type Beat } from "./easing.js";

/** A value of `T` at a time in seconds, and the first moment that value may change. */
export interface Animation<T> {
  /** The value at `t` seconds. */
  at(t: number): T;
  /** The first moment, never before `t`, at which the value may stop being `at(t)`: `t` while it moves, `Infinity` once it never will. */
  nextChange(t: number): number;
  /** The last moment, never after `t`, at which the value may have become `at(t)`: `t` while it moves, `-Infinity` if it always was. */
  lastChange(t: number): number;
  /** This animation with its motion taken out — a loop at its first value, a one-shot at its end — drawn in its place under reduced motion. */
  reduced(): Animation<T>;
}

export const Animation = {
  /** `value` at every time, never changing. */
  constant<T>(value: T): Animation<T> {
    const still: Animation<T> = { at: () => value, nextChange: () => Number.POSITIVE_INFINITY, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => still };
    return still;
  },

  /**
   * The value `at` gives, taken to move at every moment: what an animation
   * that cannot say when it holds still is, so a host draws it every frame.
   * Reduced, it holds its first value, as a loop does; a one-shot built on
   * it says its own end (`transition`, `../renderables/effects.ts`).
   */
  continuous<T>(at: (t: number) => T): Animation<T> {
    return { at, nextChange: (t) => t, lastChange: (t) => t, reduced: () => Animation.constant(at(0)) };
  },

  /**
   * `animation`'s value through `f`, changing when it does. Two values `f`
   * maps alike make an early answer, which the contract allows.
   */
  map<T, U>(animation: Animation<T>, f: (value: T) => U): Animation<U> {
    return {
      at: (t) => f(animation.at(t)),
      nextChange: (t) => animation.nextChange(t),
      lastChange: (t) => animation.lastChange(t),
      reduced: () => Animation.map(animation.reduced(), f),
    };
  },

  /**
   * Every one of `animations` at once, their values in order, changing when
   * the soonest of them does — so a stack of effects drawn together holds
   * still exactly while each of them does, and reduced each reduced — a
   * stagger with every child arrived. None never changes.
   */
  all<const T extends readonly unknown[]>(animations: { readonly [K in keyof T]: Animation<T[K]> }): Animation<T> {
    return {
      // [LAW:types-are-the-program] Each value at its own place in the tuple,
      // which `map` cannot say of its array.
      at: (t) => animations.map((animation: Animation<unknown>) => animation.at(t)) as unknown as T,
      // A fold, not a spread: a stagger over a table's rows is a list as long
      // as the table, past what an engine takes as arguments.
      nextChange: (t) => animations.reduce((soonest: number, animation: Animation<unknown>) => Math.min(soonest, animation.nextChange(t)), Number.POSITIVE_INFINITY),
      lastChange: (t) => animations.reduce((latest: number, animation: Animation<unknown>) => Math.max(latest, animation.lastChange(t)), Number.NEGATIVE_INFINITY),
      reduced: () => Animation.all<T>(animations.map((animation: Animation<unknown>) => animation.reduced()) as unknown as { readonly [K in keyof T]: Animation<T[K]> }),
    };
  },

  /**
   * `animation` sampled once a hold of `beat`: within a hold, its value at
   * the hold's start, and at each hold's start it moves on. It changes at the
   * first hold's start the sampled animation has moved by: the end of this
   * hold for one that moves every moment, the hold its next change falls in
   * for one that holds longer, and never for one that never changes again.
   * The answer is read off what the animation says, never a comparison of
   * values, so one that is back on the same value by the next hold still
   * turns the beat there, an early answer the contract allows.
   * [LAW:one-source-of-truth] The one stepping rule, for an effect's frames
   * and a transition's schedule alike.
   */
  onBeat<T>(animation: Animation<T>, beat: Beat): Animation<T> {
    return {
      at: (t) => animation.at(beat.lastChange(t)),
      nextChange(t) {
        const moved = animation.nextChange(beat.lastChange(t));
        if (moved === Number.POSITIVE_INFINITY) return moved;
        const end = beat.nextChange(t);
        // The hold boundaries after `t` are `end`, then each hold's end in turn;
        // the value turns at the first one the animation has moved by.
        return moved <= end ? end : beat.lastChange(moved) === moved ? moved : beat.nextChange(moved);
      },
      // The value held now began at this hold's start at the latest: an early
      // answer where the animation had not moved by it, which the contract allows.
      lastChange: (t) => beat.lastChange(t),
      // Reduced, nothing moves between beats, so there is nothing to sample on them.
      reduced: () => animation.reduced(),
    };
  },

  /**
   * `first` until `seconds`, then `then`, handed the time since it began —
   * each part on its own clock from 0, as every effect is. Before the switch
   * the value next changes when `first`'s does or at the switch, whichever is
   * sooner; after it, when `then`'s does, carried back onto this timeline.
   * Reduced, `first` is the motion into `then`, so it is skipped: `then`'s
   * reduced form at its start until the switch, then on, as before.
   */
  sequence<T>(first: Animation<T>, seconds: number, then: Animation<T>): Animation<T> {
    positiveSeconds("Animation.sequence seconds", seconds);
    // `then`'s moment `local`, on its own clock, carried back onto this
    // timeline: the first moment whose time since the switch reaches
    // `local`, which the sum `local + seconds` can round to either side of —
    // under it, where `at` still shows the old value, or over it, a float
    // after the change showed.
    const carried = (local: number): number => (Number.isFinite(local) ? firstReaching(local + seconds, (x) => x - seconds >= local) : local);
    return {
      at: (t) => (t - seconds >= 0 ? then.at(t - seconds) : first.at(t)),
      nextChange(t) {
        const into = t - seconds;
        if (into < 0) return Math.min(first.nextChange(t), seconds);
        return Math.max(t, carried(then.nextChange(into)));
      },
      // After the switch the value became what it is at the switch or when
      // `then`'s did since, whichever is later; before it, when `first`'s did.
      lastChange(t) {
        const into = t - seconds;
        if (into < 0) return first.lastChange(t);
        return Math.min(t, Math.max(seconds, carried(then.lastChange(into))));
      },
      reduced: () => {
        const after = then.reduced();
        // `after` held at its start until the switch, so the switch itself
        // changes nothing: only what `after` says, carried onto this clock.
        const held: Animation<T> = {
          at: (t) => after.at(Math.max(0, t - seconds)),
          nextChange: (t) => Math.max(t, carried(after.nextChange(Math.max(0, t - seconds)))),
          lastChange: (t) => (t < seconds ? Number.NEGATIVE_INFINITY : Math.min(t, Math.max(seconds, carried(after.lastChange(t - seconds))))),
          reduced: () => held,
        };
        return held;
      },
    };
  },
};
