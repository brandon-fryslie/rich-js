/**
 * Easing and phase: the one vocabulary for "how far along" — a time in
 * seconds becomes progress in [0, 1], and an ease reshapes that progress,
 * usually but not always within [0, 1].
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
 *   through it brightens and dims with no corner at either end — and the
 *   physics-flavoured curves a cursor snapping, a counter settling or a
 *   panel sliding in want: `spring`, a damped harmonic oscillator released
 *   toward its rest, which is the one of them with parameters and so the one
 *   that also says how long it takes; `bounce`, `back-in`, `back-out` and
 *   `elastic`, Robert Penner's curves at the constants every animation
 *   library since has shipped. An ease that leaves [0, 1] — a spring or a
 *   back curve overshooting its rest — is still an ease: a `ColorRamp` holds
 *   its end colours where it does, and an effect's `Curve` saturates at its
 *   swing, so the overshoot is read by what can show it (a position, a
 *   count) and clipped by what cannot.
 *
 * [LAW:no-ambient-temporal-coupling] Nothing here reads a clock. `t` is an
 * argument; whoever draws frames owns the clock and samples these at
 * whatever rate it likes, so the same `t` always gives the same progress.
 *
 * [LAW:one-type-per-behavior] An ease is a plain function value. CSS's named
 * curves are four instances of `cubicBezier`, not four implementations, the
 * spring in `EASES` is one `spring()`, and `ColorRamp` and every effect take
 * the same `Ease`.
 *
 * Tier 0 of `src/core/`: imports nothing, so `themes/` and every later
 * `core/` module reach it downhill. [LAW:one-way-deps]
 */

/** Progress in [0, 1] in, progress out: a reshaping of [0, 1] that may leave it, as a spring overshooting its rest does. */
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
  return settled((p) => yAt(solve(p)));
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
  return settled((p) => Math.min(jumps, Math.floor(p * n) + lift) / jumps);
}

/**
 * The curve `shape` over [0, 1) as an ease that has arrived: its argument
 * held to [0, 1], and exactly 1 at 1. Every built-in ease is one, so the two
 * halves of the `Ease` contract — an argument in [0, 1], the end landed on —
 * are enforced here and nowhere else. [LAW:single-enforcer] The end matters
 * because a curve is 1 at its end only in the limit or up to a rounding — a
 * spring settles to within `SPRING_REST`, the elastic's ringing never quite
 * stops, a back curve's cubic or a bezier's Newton step lands an ulp off —
 * and a count or a width eased by it must land on its target, not a
 * thousandth or an ulp short.
 */
const settled = (shape: (p: number) => number): Ease => (x) => {
  const p = Math.min(1, Math.max(0, x));
  return p === 1 ? 1 : shape(p);
};

/** The identity ease: progress unchanged. */
const linear: Ease = settled((p) => p);

/** CSS `step-end`: 0 until the very end. */
const stepEnd: Ease = steps(1, "jump-end");

/** A half-cosine, flat at both ends: the curve a breathing pulse wants. */
const sine: Ease = settled((p) => (1 - Math.cos(Math.PI * p)) / 2);

/**
 * A spring's physics: the mass on it, the stiffness of its coil and the
 * damping it moves against, in the units every animation library spells them
 * in (React Spring, Framer Motion), whose defaults these are — a spring that
 * overshoots once and settles in about a second and a quarter.
 */
export interface SpringOptions {
  /** The restoring force per unit of displacement; stiffer swings faster and settles in about the same time, since the decay is the damping's over the mass's. Positive. Defaults to 100. */
  readonly stiffness?: number;
  /** The force against the motion per unit of velocity; more settles sooner and overshoots less. Positive. Defaults to 10. */
  readonly damping?: number;
  /** What the spring moves; heavier is slower and overshoots further. Positive. Defaults to 1. */
  readonly mass?: number;
}

/**
 * A spring as an ease, and how long it takes: the ease is the spring's
 * position over `seconds`, read as progress — released at rest a unit from
 * where it is going, at 1 when it has settled there — so `{ ...spring(…),
 * swing }` is an effect's `Curve`, and `Phase.once(start, seconds)` through
 * the ease is the spring on a timeline. Unlike every other ease, a spring's
 * duration is not the caller's to choose: how long it rings is a fact about
 * its physics, which is why this is the one ease that comes with its seconds.
 */
export interface Spring {
  readonly ease: Ease;
  /** How long the spring takes to settle, in seconds: the first moment after which its displacement stays within `SPRING_REST`. */
  readonly seconds: number;
}

/**
 * How close to its rest a spring must come to count as settled: one part in a
 * thousand of the way it moves, under a colour channel's step (1/255) and
 * under any cell, so what rounds the spring's value to show it draws the rest
 * from there on.
 */
export const SPRING_REST = 0.001;

const DEFAULT_SPRING: Required<SpringOptions> = { stiffness: 100, damping: 10, mass: 1 };

/**
 * A damped harmonic oscillator, `m·x″ = −k·x − c·x′`, released at rest one
 * unit from its equilibrium: the spring every animation library means. Its
 * progress at `s` seconds is `1 − displacement(s)`, the closed-form solution
 * of that equation in the regime its damping ratio `ζ = c / 2√(k·m)` puts it
 * in — ringing past its rest for `ζ < 1`, creeping up to it for `ζ ≥ 1` — and
 * its `seconds` is its settling time: the first moment after which the
 * displacement stays within `SPRING_REST`, found once here by `crossing` on
 * the bracket each regime knows its last crossing lies in, so a sample costs
 * an exponential and a cosine whatever `x` is. [LAW:no-ambient-temporal-coupling]
 *
 * The ease is exactly 1 at `x = 1` (`settled`): settled means at rest.
 */
export function spring(options: SpringOptions = {}): Spring {
  const { stiffness, damping, mass } = { ...DEFAULT_SPRING, ...options };
  for (const [name, v] of [["stiffness", stiffness], ["damping", damping], ["mass", mass]] as const) positive(`spring ${name}`, v);
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = zeta * w0;
  const { displacement, seconds } = zeta < 1 ? ringing(w0, zeta, decay) : creeping(w0, zeta, decay);
  return { seconds, ease: settled((p) => 1 - displacement(p * seconds)) };
}

/** The closed-form displacement of a spring, and its settling time. */
interface SpringMotion {
  readonly displacement: (s: number) => number;
  readonly seconds: number;
}

/**
 * Where `|displacement|` falls through `SPRING_REST` between `lo` and `hi`,
 * by bisection: the caller brackets the last such crossing, the displacement
 * outside rest at `lo`, inside it at `hi` and falling in size between, and
 * gets the settling time back to the bits 64 halvings leave.
 * [LAW:single-enforcer] The one place the rest threshold is read against a
 * motion.
 */
function crossing(displacement: (s: number) => number, lo: number, hi: number): number {
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(displacement(mid)) > SPRING_REST) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Underdamped: `e^(−ζω₀s)·(cos ω_d s + (ζω₀/ω_d) sin ω_d s)` at the damped
 * frequency `ω_d = ω₀√(1 − ζ²)`. Released at rest, its velocity is
 * `−(ω₀²/ω_d)·e^(−ζω₀s)·sin ω_d s`, so its extrema sit at `s_k = kπ/ω_d`,
 * where `|displacement| = e^(−ζω₀·s_k)`, each the same fraction of the last.
 * The first extremum inside rest is the `K` with `e^(−ζω₀·s_K) ≤ SPRING_REST`;
 * the spring never leaves rest after it, and before it the displacement
 * falls in size from the extremum at `s_(K−1)` to its zero at
 * `(Kπ − atan(ω_d/ζω₀)) / ω_d`, so the settling time is the crossing in that
 * bracket. The decay envelope control theory reads settling time off would
 * put it later — by up to half a swing, and without bound as `ζ → 1` — so
 * the true crossing is found instead, and `seconds` is continuous in `ζ`.
 */
function ringing(w0: number, zeta: number, decay: number): SpringMotion {
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const ratio = decay / wd;
  const displacement = (s: number): number => Math.exp(-decay * s) * (Math.cos(wd * s) + ratio * Math.sin(wd * s));
  const K = Math.ceil(Math.log(1 / SPRING_REST) / ((decay * Math.PI) / wd));
  const extremum = ((K - 1) * Math.PI) / wd;
  const zero = (K * Math.PI - Math.atan(1 / ratio)) / wd;
  return { displacement, seconds: crossing(displacement, extremum, zero) };
}

/**
 * Critically damped (`ζ = 1`): `e^(−ω₀s)·(1 + ω₀s)`. Overdamped (`ζ > 1`):
 * two decaying exponentials at the rates `ζω₀ ∓ ω₀√(ζ² − 1)`, written as such
 * rather than as `cosh + sinh` so neither grows before the other cancels it.
 * Both only fall, so the settling time is the one crossing of `SPRING_REST`,
 * bracketed between zero and a time the slower exponential alone puts it under.
 */
function creeping(w0: number, zeta: number, decay: number): SpringMotion {
  const { displacement, far } = zeta === 1 ? critical(w0) : overdamped(w0, zeta, decay);
  return { displacement, seconds: crossing(displacement, 0, far) };
}

/** A falling displacement, and a time `far` by which it is under `SPRING_REST`. */
interface Falling {
  readonly displacement: (s: number) => number;
  readonly far: number;
}

/** `(1 + u)·e^(−u)` in `u = ω₀s`, which is under 10⁻³ from u ≈ 9.24. */
function critical(w0: number): Falling {
  return { displacement: (s) => Math.exp(-w0 * s) * (1 + w0 * s), far: 10 / w0 };
}

/**
 * The slower exponential alone bounds the sum, since the faster one's weight
 * `1 − ratio` is negative. Its rate `ζω₀ − ω₀√(ζ² − 1)` is written as
 * `ω₀ / (ζ + √(ζ² − 1))`, the same number without the subtraction, which for
 * a large `ζ` cancels to zero and would make `far` infinite.
 */
function overdamped(w0: number, zeta: number, decay: number): Falling {
  const root = Math.sqrt(zeta * zeta - 1);
  const wh = w0 * root;
  const slow = w0 / (zeta + root);
  const fast = decay + wh;
  const ratio = decay / wh;
  return {
    displacement: (s) => ((1 + ratio) * Math.exp(-slow * s) + (1 - ratio) * Math.exp(-fast * s)) / 2,
    far: Math.log((1 + ratio) / (2 * SPRING_REST)) / slow,
  };
}

/**
 * Robert Penner's bounce (his `easeOutBounce`): a ball dropped onto its rest,
 * four parabolic arcs each a quarter the height of the last, the constants
 * his and every library's since. Each arc is the same parabola,
 * `7.5625·(x − centre)² + floor`, set over its own span of `x`; the spans
 * are in elevenths of 2.75, where the first arc meets the ground.
 */
const BOUNCE_ARCS: readonly { readonly until: number; readonly centre: number; readonly floor: number }[] = [
  { until: 1 / 2.75, centre: 0, floor: 0 },
  { until: 2 / 2.75, centre: 1.5 / 2.75, floor: 0.75 },
  { until: 2.5 / 2.75, centre: 2.25 / 2.75, floor: 0.9375 },
  { until: Number.POSITIVE_INFINITY, centre: 2.625 / 2.75, floor: 0.984375 },
];
const bounce: Ease = settled((p) => {
  // The last arc's `until` is unbounded, so an arc is always found.
  const arc = BOUNCE_ARCS.find(({ until }) => p < until)!;
  return 7.5625 * (p - arc.centre) ** 2 + arc.floor;
});

/**
 * Penner's back curves: a cubic that pulls back past its start before going
 * (`back-in`), or overshoots its end before settling (`back-out`), by his
 * overshoot constant 1.70158 — about a tenth of the way. His `(c + 1)·x³ −
 * c·x²` is written as `x³ + c·x²·(x − 1)`, the same cubic with the overshoot
 * term a product that is exactly zero at both ends, so the curve starts on 0
 * and lands on 1 to the bit.
 */
const BACK_OVERSHOOT = 1.70158;
const backIn: Ease = settled((p) => p ** 3 + BACK_OVERSHOOT * p ** 2 * (p - 1));
const backOut: Ease = settled((p) => {
  const q = p - 1;
  return 1 + q ** 3 + BACK_OVERSHOOT * q ** 2 * (q + 1);
});

/**
 * Penner's elastic (his `easeOutElastic`): overshoots its end and rings back
 * through it, with a period of 0.3 of the way under an amplitude of
 * `2^(−10x)`, so each swing is `2^(−1.5)`, a little over a third, of the
 * last — `2^(−10x)·sin((10x − 0.75)·2π/3) + 1`.
 */
const ELASTIC_PERIOD = (2 * Math.PI) / 3;
const elastic: Ease = settled((p) => 2 ** (-10 * p) * Math.sin((10 * p - 0.75) * ELASTIC_PERIOD) + 1);

/**
 * Every built-in ease by the name a template spells it with — CSS's keyword
 * names, plus `sine`, plus `step`: the spelling `ColorRamp` used before this
 * vocabulary existed, kept so every template written against it renders the
 * same. It is CSS's `step-end`, the same function value. Then the
 * physics-flavoured curves: `spring` is the default `spring()`, whose
 * `seconds` are `DEFAULT_SPRING`'s; the rest are Penner's at his constants.
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
  spring: spring().ease,
  bounce,
  "back-in": backIn,
  "back-out": backOut,
  elastic,
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

/** `v` is a positive, finite number, or this throws naming `what`; `unit` is the number's noun, as in `" of seconds"`. [LAW:single-enforcer] */
function positive(what: string, v: number, unit = ""): void {
  if (!(Number.isFinite(v) && v > 0)) throw new RangeError(`${what} must be a positive number${unit}, got ${v}`);
}

/** Throws, naming `what`, unless `seconds` is a positive, finite number of seconds. */
export function positiveSeconds(what: string, seconds: number): void {
  positive(what, seconds, " of seconds");
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
   * effect handed it draws the same frame throughout. With `nextChange`,
   * the two ends of the hold, as every `Animation` answers them.
   */
  lastChange(t: number): number;
  /**
   * When the hold in progress at `t` ends, in seconds on `t`'s own timeline:
   * the start of the next hold, the first moment `at` places in it, so it is
   * always after `t`. What is drawn on this beat at `t` is drawn until then.
   * With `at`, this makes a beat an `Animation` of the hold in progress
   * (`./animation.ts`).
   */
  nextChange(t: number): number;
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
/** How many ulps the roundings in a sum naming a boundary can put it under that boundary; a walk past this is a boundary finer than time resolves there. */
const ULPS_OF_ROUNDING = 8;

/**
 * The first float from `sum` up at which `reached` holds: a time built as a
 * sum to land on a boundary — where a hold begins, where an animation's next
 * part changes — that rounding put an ulp or two under it, walked up to the
 * first moment on the far side. [LAW:single-enforcer] The one walk, so every
 * boundary a time is carried onto is the moment the change shows, to the
 * float. A walk longer than rounding can cost throws `finer()`'s message: the
 * boundary is narrower than the floats around it are apart.
 */
export function walkUp(sum: number, reached: (x: number) => boolean, finer: () => string): number {
  let x = sum;
  for (let walked = 0; !reached(x); walked++) {
    if (walked === ULPS_OF_ROUNDING) throw new RangeError(finer());
    x = nextUp(x);
  }
  return x;
}

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
  // Where hold `i` of pass `pass` begins: the pass's start plus the hold's,
  // two integers and two constants, so every `t` in the hold builds the one
  // float. That sum can land an ulp or two under the boundary when the holds
  // are not exact in binary — a tenth of a second is not — and `at` would
  // then read it as the hold before, so it is walked up to the first float
  // `at` places in the hold. The walk is a function of the pass and the hold
  // alone, so every `t` in the hold still answers one float.
  const boundary = (what: string, pass: number, i: number, t: number): number =>
    walkUp(
      pass * period + starts[i]!,
      (began) => index(wrapSeconds(what, began, period)) === i,
      () => `${what}: hold ${i} (${own[i]} s) is finer than time resolves near t = ${t}`,
    );
  // Which pass `t` is in, as a whole number: `t - into` is a whole number of
  // periods but for rounding, which `round` takes off; carrying `starts[i]`
  // out of `t` itself would leave each sample its own rounding.
  const pass = (t: number, into: number): number => Math.round((t - into) / period);
  return {
    holds: own,
    period,
    at(t) {
      return index(wrapSeconds("Beat.at", t, period));
    },
    lastChange(t) {
      const into = wrapSeconds("Beat.lastChange", t, period);
      return boundary("Beat.lastChange", pass(t, into), index(into), t);
    },
    // The next hold's start, in the next pass when this hold is the last.
    nextChange(t) {
      const into = wrapSeconds("Beat.nextChange", t, period);
      const i = index(into);
      const last = i === own.length - 1;
      return boundary("Beat.nextChange", pass(t, into) + (last ? 1 : 0), last ? 0 : i + 1, t);
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
