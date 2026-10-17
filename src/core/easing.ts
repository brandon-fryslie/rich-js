/**
 * Easing and phase: the one vocabulary for "how far along" — every function
 * here returns progress in [0, 1].
 *
 * Two kinds of curve, composed as `ease(phase(t))`:
 *
 * - A **phase** turns a time `t` (seconds) into raw progress: `once` runs
 *   0 → 1 over a span and holds, `loop` wraps 0 → 1 every period,
 *   `pingPong` goes 0 → 1 → 0 every period. A per-cell offset is added to `t`
 *   before the phase sees it — `phase(t + offset)` — so the cells of one
 *   effect run the same curve shifted in time.
 * - An **ease** reshapes that progress: any `(x) => y` on [0, 1]. The
 *   built-ins are CSS's easing functions (CSS Easing Functions Level 1):
 *   `linear`, `cubic-bezier()` with its named curves, and `steps()` with its
 *   jump terms, plus `sine` for pulses — a half-cosine, so a `pingPong`
 *   through it brightens and dims with no corner at either end.
 *
 * [LAW:no-ambient-temporal-coupling] Nothing here reads a clock. `t` is an
 * argument; whoever draws frames owns the clock and samples these at
 * whatever rate it likes, so the same `t` always gives the same progress.
 *
 * [LAW:one-type-per-behavior] An ease is a plain function value. CSS's named
 * curves are four instances of `cubicBezier`, not four implementations, and
 * `ColorRamp` and every effect take the same `Ease`.
 *
 * Tier 0 of `src/core/`: imports nothing, so `themes/` and every later
 * `core/` module reach it downhill. [LAW:one-way-deps]
 */

/** Progress in, progress out: a reshaping of [0, 1]. */
export type Ease = (x: number) => number;

/** Time in seconds (plus any per-cell offset) in, progress in [0, 1] out. */
export type Phase = (t: number) => number;

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)`: the curve from (0, 0) to (1, 1) with
 * those two control points, read as y at a given x. `x1` and `x2` must lie in
 * [0, 1] — as in CSS — which keeps x monotonic in the curve parameter, so
 * every input has exactly one output. `y1` and `y2` may leave [0, 1]; the
 * curve then overshoots, as a CSS "back" curve does.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  for (const [name, v] of [["x1", x1], ["y1", y1], ["x2", x2], ["y2", y2]] as const) {
    if (!Number.isFinite(v)) throw new RangeError(`cubicBezier ${name} must be finite, got ${v}`);
  }
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError(`cubicBezier x1 and x2 must lie in [0, 1], got ${x1} and ${x2}`);
  }
  // The Bernstein form in power basis: x(s) = ((ax·s + bx)·s + cx)·s, same for y.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xAt = (s: number): number => ((ax * s + bx) * s + cx) * s;
  const yAt = (s: number): number => ((ay * s + by) * s + cy) * s;
  const dxAt = (s: number): number => (3 * ax * s + 2 * bx) * s + cx;
  const EPSILON = 1e-9;

  // The parameter s with x(s) = x: Newton's method from s = x, which converges
  // in a few steps on every curve CSS names; bisection when the slope is too
  // flat for Newton to trust. x(s) is monotonic on [0, 1], so bisection always
  // lands.
  const solve = (x: number): number => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = xAt(s) - x;
      if (Math.abs(err) < EPSILON) return s;
      const slope = dxAt(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= err / slope;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    while (hi - lo > EPSILON) {
      if (xAt(s) < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };
  return (x) => yAt(solve(Math.min(1, Math.max(0, x))));
}

/**
 * Where a `steps()` curve jumps, in CSS's terms. `jump-start` jumps at 0,
 * `jump-end` at 1, `jump-both` at both, `jump-none` at neither; `start` and
 * `end` are CSS's older spellings of the first two.
 */
export type StepPosition = "jump-start" | "jump-end" | "jump-none" | "jump-both" | "start" | "end";

/**
 * CSS `steps(n, position)`: progress held flat in `n` equal intervals, jumping
 * between them. The output takes `n` distinct values between the jumps
 * `position` names — CSS's step algorithm, so `steps(1, "end")` is 0 until
 * the very end.
 */
export function steps(n: number, position: StepPosition = "jump-end"): Ease {
  const minimum = position === "jump-none" ? 2 : 1;
  if (!Number.isInteger(n) || n < minimum) {
    throw new RangeError(`steps(${n}, "${position}") needs a whole number of steps ≥ ${minimum}`);
  }
  const jumpsAtStart = position === "jump-start" || position === "start" || position === "jump-both";
  // How many jumps the curve makes in all, which is what each step is a fraction of.
  const jumps = {
    "jump-start": n,
    start: n,
    "jump-end": n,
    end: n,
    "jump-both": n + 1,
    "jump-none": n - 1,
  }[position];
  const lift = jumpsAtStart ? 1 : 0;
  return (x) => {
    const p = Math.min(1, Math.max(0, x));
    return Math.min(jumps, Math.floor(p * n) + lift) / jumps;
  };
}

/** The identity ease: progress unchanged. */
const linear: Ease = (x) => x;

/** CSS `step-end`: 0 until the very end. */
const stepEnd: Ease = steps(1, "jump-end");

/** A half-cosine, flat at both ends: the curve a breathing pulse wants. */
const sine: Ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;

/**
 * Every built-in ease by the name a template spells it with — CSS's keyword
 * names, plus `sine`, plus `step`: the spelling `ColorRamp` used before this
 * vocabulary existed, kept so every template written against it renders the
 * same. It is CSS's `step-end`, the same function value.
 */
export const EASES = {
  linear,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
  "step-start": steps(1, "jump-start"),
  "step-end": stepEnd,
  step: stepEnd,
  sine,
} as const satisfies Record<string, Ease>;

export type EaseName = keyof typeof EASES;

/**
 * The gate a spelled ease crosses. [LAW:parse-dont-validate] — a name in, the
 * function out, so nothing downstream holds a string it must check again.
 * Unknown names throw naming every legal one. [LAW:no-silent-failure]
 */
export function parseEase(name: string): Ease {
  if (!Object.hasOwn(EASES, name)) {
    throw new RangeError(
      `unknown ease ${JSON.stringify(name)}; expected one of ` +
        Object.keys(EASES).map((n) => JSON.stringify(n)).join(", "),
    );
  }
  return EASES[name as EaseName];
}

function positiveSeconds(what: string, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new RangeError(`${what} must be a positive number of seconds, got ${seconds}`);
  }
}

/**
 * A beat: holds of given lengths in seconds, played in order and looped, the
 * way the frames of an animation are each held and then replaced. `at(t)` is
 * the index of the hold in progress at `t`, counted from the first hold at
 * `t = 0`, and the sequence wraps every `period` seconds, before zero too,
 * as `Phase.loop` wraps. With equal holds `at` is `steps(n)` read as an
 * index; the holds here may differ, which `steps` cannot say, so a frame
 * held for a second and the next for a quarter are one beat.
 */
export interface Beat {
  readonly holds: readonly number[];
  /** The sum of the holds: how long one pass takes, in seconds. */
  readonly period: number;
  /** Which hold is in progress at `t` seconds: an index into `holds`. */
  at(t: number): number;
  /**
   * When the hold in progress at `t` began, in seconds on `t`'s own
   * timeline: what a sample-and-hold on this beat reads at `t`. Every `t`
   * inside one hold of one pass answers the same number, to the bit, so an
   * effect handed it draws the same frame throughout.
   */
  start(t: number): number;
}

/**
 * The seconds into the current pass of a `period` at `t`: `t` taken modulo
 * the period, into [0, period), before zero too. [LAW:single-enforcer] The
 * one wrap `Phase.loop` and `beat` both read time through, so a `t` that is
 * not a finite number of seconds fails here, loudly, and nowhere else. A
 * `t` at or past zero is `t % period` alone, which is exact; only a negative
 * `t` is carried up by a period, so a boundary a host samples exactly lands
 * on the pass that begins there, and the answer is always under the period.
 */
function wrapSeconds(what: string, t: number, period: number): number {
  if (!Number.isFinite(t)) throw new RangeError(`${what} needs a finite t, got ${t}`);
  const into = t % period;
  if (into >= 0) return into;
  // A negative epsilon carried up rounds to the period itself; that is the
  // start of the next pass, never a point past the end of this one.
  const carried = into + period;
  return carried >= period ? 0 : carried;
}

/**
 * The float after `x`: one ulp up, away from zero for a positive `x` and
 * toward it for a negative one, read through the bits of the double.
 */
function nextUp(x: number): number {
  if (x === 0) return Number.MIN_VALUE;
  DOUBLE[0] = x;
  BITS[0] = BITS[0]! + (x > 0 ? 1n : -1n);
  return DOUBLE[0];
}
const DOUBLE = new Float64Array(1);
const BITS = new BigUint64Array(DOUBLE.buffer);
/** How many ulps the two roundings in `Beat.start`'s sum can put it under the hold's boundary; a walk past this is a hold too fine for the time. */
const ULPS_OF_ROUNDING = 8;

/** `holds` as a `Beat`; a beat with no hold, or a hold that is not a positive number of seconds, throws. */
export function beat(holds: readonly number[]): Beat {
  if (holds.length === 0) throw new RangeError("a beat needs at least one hold");
  holds.forEach((hold, i) => positiveSeconds(`beat hold ${i}`, hold));
  const period = holds.reduce((sum, hold) => sum + hold, 0);
  // Where each hold begins, in seconds into the period: the unit
  // `wrapSeconds` answers in, so the sum a boundary sits at is the number
  // the wrap of a `t` on that boundary produces, and the hold that begins
  // there is the one in progress, at any rate the host samples.
  const starts: number[] = [];
  let elapsed = 0;
  for (const hold of holds) {
    starts.push(elapsed);
    elapsed += hold;
  }
  // A copy, and the one `at` walks: what `at` and `period` were built from
  // stays what `holds` says whatever the caller does to its array.
  const own = [...holds];
  // The last hold whose start the time has reached. The first starts at
  // 0, so the walk always stops, and its length is the count of holds,
  // never a function of `t`.
  const index = (into: number): number => {
    let i = own.length - 1;
    while (starts[i]! > into) i--;
    return i;
  };
  return {
    holds: own,
    period,
    at(t) {
      return index(wrapSeconds("Beat.at", t, period));
    },
    // Which pass `t` is in, as a whole number, then that pass's start plus
    // the hold's: two integers and two constants, so every `t` in the hold
    // builds the one float. `t - into` is a whole number of periods but for
    // rounding, which `round` takes off; carrying `starts[i]` out of `t`
    // itself would leave each sample its own rounding. That sum can land an
    // ulp or two under the boundary when the holds are not exact in binary
    // — a tenth of a second is not — and `at` would then read it as the
    // hold before, so it is walked up to the first float `at` places in
    // the hold. The walk is a function of the pass and the hold alone, so
    // every `t` in the hold still answers one float.
    start(t) {
      const into = wrapSeconds("Beat.start", t, period);
      const i = index(into);
      let began = Math.round((t - into) / period) * period + starts[i]!;
      for (let walked = 0; index(wrapSeconds("Beat.start", began, period)) !== i; walked++) {
        // The sum is off by the rounding of two operations, under the few
        // ulps allowed here; a walk that long means the hold is narrower
        // than the floats around `t` are apart, so no float starts it.
        if (walked === ULPS_OF_ROUNDING) throw new RangeError(`Beat.start: hold ${i} (${own[i]} s) is finer than time resolves near t = ${t}`);
        began = nextUp(began);
      }
      return began;
    },
  };
}

/** The three phase shapes. Each takes seconds and returns a `Phase`. */
export const Phase = {
  /** 0 before `start`, rising to 1 over `duration` seconds, then held at 1. */
  once(start: number, duration: number): Phase {
    if (!Number.isFinite(start)) throw new RangeError(`Phase.once start must be finite, got ${start}`);
    positiveSeconds("Phase.once duration", duration);
    return (t) => Math.min(1, Math.max(0, (t - start) / duration));
  },

  /** 0 → 1 every `period` seconds, wrapping back to 0; negative `t` wraps too. */
  loop(period: number): Phase {
    positiveSeconds("Phase.loop period", period);
    return (t) => wrapSeconds("Phase.loop", t, period) / period;
  },

  /** 0 → 1 → 0 every `period` seconds: there in the first half, back in the second. */
  pingPong(period: number): Phase {
    positiveSeconds("Phase.pingPong period", period);
    const wrap = Phase.loop(period);
    return (t) => 1 - Math.abs(2 * wrap(t) - 1);
  },
};
