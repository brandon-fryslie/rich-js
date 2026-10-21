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
 * cell (`Style.nextChange`, and `Style.lastChange` below), so a host holding
 * the composed frame reads it there (`Segment.nextChange`); a value that is
 * not drawn — a number, a colour — has `nextChange` as its only way to say
 * when to look again.
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
 * values skipped. A loop holds its first value, a one-shot cuts to its end
 * when it starts, a transition to its new state, a stagger has everyone arrived, and an element is
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
 * An animation of renderables is a renderable — its face, `placedRender`:
 * placed as the child of any container — a `Panel`, a `Table` cell, a
 * `Group`, a container a user wrote — it draws at the time of the frame it
 * is drawn in (`RenderOptions.frame`; 0, its own start, when printed) and
 * stamps its cells with its hold there, under whatever its value's cells
 * already say, so a frame's hold is the intersection of its cells' holds.
 * [LAW:composability] No time is threaded through the code that places it,
 * and no container knows animations exist. An animation placed inside
 * another's value draws at the frame's time too: a combinator remaps the
 * time it hands its parts, never a value's contents, so content that should
 * follow a part's clock is composed into the part (`map`, `all`) and the
 * result placed. [LAW:one-source-of-truth]
 *
 * [LAW:no-ambient-temporal-coupling] Pure: `t` is an argument and never a
 * clock read (`./clock.ts`), the same `t` gives the same value, nothing is
 * kept between calls, and a call costs the same at `t = 0` and `t = 10⁶`, so
 * a host sampling once a second and one sampling sixty times see the same
 * value at every `t` they share.
 *
 * [LAW:one-type-per-behavior] The combinators here are the ones every kind
 * of motion is built from — a constant, a value moving every moment, a map
 * over the value, several at once, one animation after another, and one
 * played again every period — and each says how
 * `nextChange` composes, so an animation built from them answers it without
 * its author doing anything.
 *
 * Tier 5 of `src/core/`: `./easing.ts`, `./measure.ts`, `./protocol.ts`,
 * `./segment.ts` and `./style.ts`, nothing else. [LAW:one-way-deps]
 */

import { beat, firstReaching, passAt, positiveSeconds, type Beat } from "./easing.js";
import { Measurement } from "./measure.js";
import { isRenderable, render, type Composite, type Measurable, type Motion, type Renderable, type RenderOptions } from "./protocol.js";
import { Segment } from "./segment.js";
import { Style } from "./style.js";

/** A value of `T` at a time in seconds, and the hold it is in: what every animation answers, whatever its values. */
export interface Timed<T> {
  /** The value at `t` seconds. */
  at(t: number): T;
  /** The first moment, never before `t`, at which the value may stop being `at(t)`: `t` while it moves, `Infinity` once it never will. */
  nextChange(t: number): number;
  /** The last moment, never after `t`, at which the value may have become `at(t)`: `t` while it moves, `-Infinity` if it always was. */
  lastChange(t: number): number;
  /** This animation with its motion taken out — a loop at its first value, a one-shot cut to its end — drawn in its place under reduced motion. */
  reduced(): Animation<T>;
}

/**
 * A value of `T` at a time, and — when its values are renderables — a
 * renderable itself, drawn wherever a renderable goes at the time of the
 * frame it is drawn in (`placedRender`). [LAW:types-are-the-program] The
 * face is on the type exactly when the values can be drawn: a tween of a
 * number is no renderable and a `Panel` refuses it; a tween mapped to a
 * `RichText` is one, and a `Panel` holds it.
 */
export type Animation<T> = Timed<T> & ([T] extends [Renderable] ? Renderable & Measurable & Composite : unknown);

/** What a frame drawn at a time shows of an animation, and what that says. */
export interface Shown<T> {
  readonly value: T;
  /** The first moment, never before the time drawn at, the value may stop being this. */
  readonly nextChange: number;
  /** The animation the value is drawn from: the one handed in, or under reduced motion its reduced form. */
  readonly drawn: Timed<T>;
  /** Whether it is the animation reduced: drawn under reduced motion, changing only where content does. */
  readonly reduced: boolean;
}

/**
 * What a frame drawn at `t` shows of `animation` under `motion`, and when
 * that changes: the animation's, or under reduced motion its reduced form's
 * (`reduced`). [LAW:single-enforcer] The one place the preference is read:
 * every placed animation (`placedRender`), every effect, a spinner, a
 * `Frames` and the template functions choose here, so a host told once
 * reduces every one.
 */
export function shownAt<T>(animation: Timed<T>, t: number, motion: Motion): Shown<T> {
  const reduced = motion.reducedMotion === true;
  const drawn: Timed<T> = reduced ? animation.reduced() : animation;
  return { value: drawn.at(t), nextChange: drawn.nextChange(t), drawn, reduced };
}

/** A hold: since when a sample has been what it is, and until when it stays so, on one clock. */
export interface Hold {
  readonly lastChange: number;
  readonly nextChange: number;
}

/** The hold `shown`, drawn at `t`, is in: its animation's two answers there. */
export function holdOf(shown: Shown<unknown>, t: number): Hold {
  return { lastChange: shown.drawn.lastChange(t), nextChange: shown.nextChange };
}

/** The style saying a cell is in `hold`. */
export function stamp(hold: Hold): Style {
  return new Style({ lastChange: hold.lastChange, nextChange: hold.nextChange });
}

/**
 * `segments`, every one carrying `hold` under whatever it already said: the
 * later `lastChange` and the sooner `nextChange` win (`Style.add`), so a
 * frame's hold is the intersection of its cells', narrower than the truth
 * and never wider. [LAW:single-enforcer] The one way a time is put on drawn
 * cells, by whatever draws for a time it knows.
 */
export function stampFrame(segments: Iterable<Segment>, hold: Hold): Iterable<Segment> {
  return Segment.applyStyle(segments, stamp(hold));
}

/**
 * The moment a frame drawn under `options` is drawn for: the frame's time,
 * which the host writes once a frame (`RenderOptions.frame`), or with no
 * frame — a `print` — 0, the start of an animation's own clock, the one
 * moment it can name without reading one. [LAW:one-source-of-truth] Nothing
 * else hands a placed animation its time, so an animation inside another's
 * value draws at the frame's time too, never at a time a combinator mapped.
 */
export function frameTimeOf(options: RenderOptions): number {
  return options.frame?.time ?? 0;
}

/** `value` as what an animation's face draws. [LAW:no-silent-failure] An animation of numbers made through `Animation.of` has a face at runtime and nothing to draw. */
function drawable(value: unknown): Renderable {
  if (!isRenderable(value)) throw new TypeError("an Animation is drawn only when its values are renderables; place what it maps to (Animation.map)");
  return value;
}

/**
 * `animation` drawn at `t` under `options`: the value `shownAt` picks, every
 * segment stamped with its hold at `t` under whatever its own cells say, led
 * by a `Segment.carrier` of it, because a frame of no cells — an element not
 * yet entered — may have cells later, and must say when.
 */
export function* drawnAt(animation: Timed<unknown>, t: number, options: RenderOptions): Iterable<Segment> {
  const shown = shownAt(animation, t, options);
  const value = drawable(shown.value);
  const hold = holdOf(shown, t);
  yield Segment.carrier(stamp(hold));
  yield* stampFrame(render(value, options), hold);
}

/**
 * An animation's face, `render`: drawn at the time of the frame it is drawn
 * in (`frameTimeOf`). A container — the library's or a user's — that draws
 * its children through `render` draws an animation among them with no word
 * about time. [LAW:composability]
 */
export function placedRender(animation: Timed<unknown>, options: RenderOptions): Iterable<Segment> {
  return drawnAt(animation, frameTimeOf(options), options);
}

/** An animation's face, `measure`: what it shows at the frame's time, measured. */
export function placedMeasure(animation: Timed<unknown>, options: RenderOptions): { minimum: number; maximum: number } {
  return Measurement.get(options, drawable(shownAt(animation, frameTimeOf(options), options).value));
}

/** An animation's face, `contents`: what it shows at the frame's time. */
export function* placedContents(animation: Timed<unknown>, options: RenderOptions): Iterable<Renderable> {
  yield drawable(shownAt(animation, frameTimeOf(options), options).value);
}

/** What `Animation.of` makes of `X`: `X`, with the face its values call for. */
export type Faced<X extends Timed<unknown>> = X & Animation<X extends Timed<infer T> ? T : never>;

export const Animation = {
  /**
   * `timed` as an animation: itself, every member it carries kept, with the
   * face its values call for — `render`, `measure` and `contents`, drawing it
   * at the frame's time. Every animation made from a literal is made here,
   * the library's and a user's alike. [LAW:single-enforcer] The one cast in
   * the type: a literal's `T` is not known at runtime, so every animation
   * made here has the face, and one whose values are not renderables throws
   * when it is drawn.
   */
  of<X extends Timed<unknown>>(timed: X): Faced<NoInfer<X>> {
    const faced = {
      ...timed,
      render: (options: RenderOptions) => placedRender(faced, options),
      measure: (options: RenderOptions) => placedMeasure(faced, options),
      contents: (options: RenderOptions) => placedContents(faced, options),
    };
    return faced as unknown as Faced<NoInfer<X>>;
  },

  /** `value` at every time, never changing. */
  constant<T>(value: T): Animation<T> {
    const still: Animation<T> = Animation.of({ at: () => value, nextChange: () => Number.POSITIVE_INFINITY, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => still });
    return still;
  },

  /**
   * `before` until 0, then `after`: an instant change at 0 — a cut, what a
   * one-shot is with its motion taken out, its start kept and its end at once.
   */
  cut<T>(before: T, after: T): Animation<T> {
    const cut: Animation<T> = Animation.of({
      at: (t: number) => (t < 0 ? before : after),
      nextChange: (t: number) => (t < 0 ? 0 : Number.POSITIVE_INFINITY),
      lastChange: (t: number) => (t < 0 ? Number.NEGATIVE_INFINITY : 0),
      reduced: () => cut,
    });
    return cut;
  },

  /**
   * The value `at` gives, taken to move at every moment: what an animation
   * that cannot say when it holds still is, so a host draws it every frame.
   * Reduced, it holds its first value, as a loop does; a one-shot built on
   * it says its own end (`transition`, `../renderables/effects.ts`).
   */
  continuous<T>(at: (t: number) => T): Animation<T> {
    return Animation.of({ at, nextChange: (t: number) => t, lastChange: (t: number) => t, reduced: () => Animation.constant(at(0)) });
  },

  /**
   * `animation`'s value through `f`, changing when it does. Two values `f`
   * maps alike make an early answer, which the contract allows.
   */
  map<T, U>(animation: Timed<T>, f: (value: T) => U): Animation<U> {
    return Animation.of({
      at: (t: number) => f(animation.at(t)),
      nextChange: (t: number) => animation.nextChange(t),
      lastChange: (t: number) => animation.lastChange(t),
      reduced: () => Animation.map(animation.reduced(), f),
    });
  },

  /**
   * Every one of `animations` at once, their values in order, changing when
   * the soonest of them does — so a stack of effects drawn together holds
   * still exactly while each of them does, and reduced each reduced — a
   * stagger with every child arrived. None never changes.
   */
  all<const T extends readonly unknown[]>(animations: { readonly [K in keyof T]: Timed<T[K]> }): Animation<T> {
    return Animation.of({
      // [LAW:types-are-the-program] Each value at its own place in the tuple,
      // which `map` cannot say of its array.
      at: (t: number) => animations.map((animation: Timed<unknown>) => animation.at(t)) as unknown as T,
      // A fold, not a spread: a stagger over a table's rows is a list as long
      // as the table, past what an engine takes as arguments.
      nextChange: (t: number) => animations.reduce((soonest: number, animation: Timed<unknown>) => Math.min(soonest, animation.nextChange(t)), Number.POSITIVE_INFINITY),
      lastChange: (t: number) => animations.reduce((latest: number, animation: Timed<unknown>) => Math.max(latest, animation.lastChange(t)), Number.NEGATIVE_INFINITY),
      reduced: () => Animation.all<T>(animations.map((animation: Timed<unknown>) => animation.reduced()) as unknown as { readonly [K in keyof T]: Timed<T[K]> }),
    });
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
  onBeat<T>(animation: Timed<T>, beat: Beat): Animation<T> {
    return Animation.of({
      at: (t: number) => animation.at(beat.lastChange(t)),
      nextChange(t: number) {
        const moved = animation.nextChange(beat.lastChange(t));
        if (moved === Number.POSITIVE_INFINITY) return moved;
        const end = beat.nextChange(t);
        // The hold boundaries after `t` are `end`, then each hold's end in turn;
        // the value turns at the first one the animation has moved by.
        return moved <= end ? end : beat.lastChange(moved) === moved ? moved : beat.nextChange(moved);
      },
      // The value held now began at this hold's start at the latest: an early
      // answer where the animation had not moved by it, which the contract allows.
      lastChange: (t: number) => beat.lastChange(t),
      // Reduced, nothing moves between beats, so there is nothing to sample on them.
      reduced: () => animation.reduced(),
    });
  },

  /**
   * `first` until `seconds`, then `then`, handed the time since it began —
   * each part on its own clock from 0, as every effect is. Before the switch
   * the value next changes when `first`'s does or at the switch, whichever is
   * sooner; after it, when `then`'s does, carried back onto this timeline.
   * Reduced, each part is reduced and the switch kept, so what either shows
   * shows on time; a one-shot that is the motion into what follows says its
   * own end (`transition`, `../renderables/effects.ts`).
   */
  sequence<T>(first: Timed<T>, seconds: number, then: Timed<T>): Animation<T> {
    positiveSeconds("Animation.sequence seconds", seconds);
    // `then`'s moment `local`, on its own clock, carried back onto this
    // timeline: the first moment whose time since the switch reaches
    // `local`, which the sum `local + seconds` can round to either side of —
    // under it, where `at` still shows the old value, or over it, a float
    // after the change showed.
    const carried = (local: number): number => (Number.isFinite(local) ? firstReaching(local + seconds, (x) => x - seconds >= local) : local);
    return Animation.of({
      at: (t: number) => (t - seconds >= 0 ? then.at(t - seconds) : first.at(t)),
      nextChange(t: number) {
        const into = t - seconds;
        if (into < 0) return Math.min(first.nextChange(t), seconds);
        return Math.max(t, carried(then.nextChange(into)));
      },
      // After the switch the value became what it is at the switch or when
      // `then`'s did since, whichever is later; before it, when `first`'s did.
      lastChange(t: number) {
        const into = t - seconds;
        if (into < 0) return first.lastChange(t);
        return Math.min(t, Math.max(seconds, carried(then.lastChange(into))));
      },
      reduced: () => Animation.sequence(first.reduced(), seconds, then.reduced()),
    });
  },

  /**
   * `nth(n)` for every time in the `n`th turn, `[n·period, (n+1)·period)`,
   * handed the time since that turn began — a one-shot played again every
   * `period` seconds, a different one each turn if `nth` says so. `n` is any
   * integer, so a timeline run back past 0 is in turn −1. Within a turn the
   * value next changes when the turn's does or at the next turn, whichever is
   * sooner, and became what it is when the turn's did or at this turn's start,
   * whichever is later: run backwards, a host wakes where the turn began.
   * Reduced, each turn is reduced and the turns kept, so a turn showing
   * something new still shows it on time and a one-shot inside cuts to its
   * end there. Nothing is walked through: a call reads only its turn.
   */
  repeat<T>(period: number, nth: (n: number) => Timed<T>): Animation<T> {
    positiveSeconds("Animation.repeat period", period);
    // [LAW:single-enforcer] Which turn a time is in, and how far into it, is
    // `passAt`, the wrap a `beat` and `Phase.loop` read time through, so a
    // repeat beside a loop of the same period turns on the same float; where
    // a turn begins and the next begins are a one-hold beat's two ends.
    const turns = beat([period]);
    // The turn's moment `local`, on its own clock, carried onto this one: the
    // first float the wrap places at or past `local` in turn `n`, or in a
    // later turn, found as `sequence` carries its second part's.
    const carried = (n: number, began: number, local: number): number =>
      Number.isFinite(local)
        ? firstReaching(began + local, (x) => {
            const { pass, into } = passAt("Animation.repeat", x, period);
            return pass > n || (pass === n && into >= local);
          })
        : local;
    return Animation.of({
      at: (t: number) => {
        const { pass, into } = passAt("Animation.repeat", t, period);
        return nth(pass).at(into);
      },
      nextChange(t: number) {
        const { pass, into } = passAt("Animation.repeat", t, period);
        return Math.max(t, Math.min(turns.nextChange(t), carried(pass, turns.lastChange(t), nth(pass).nextChange(into))));
      },
      lastChange(t: number) {
        const { pass, into } = passAt("Animation.repeat", t, period);
        const began = turns.lastChange(t);
        return Math.min(t, Math.max(began, carried(pass, began, nth(pass).lastChange(into))));
      },
      reduced: () => Animation.repeat(period, (n) => nth(n).reduced()),
    });
  },
};
