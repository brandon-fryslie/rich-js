/**
 * Tween — a value eased from one number to another over seconds, then held:
 * the animation a progress bar's fill, a counter or a width is handed so it
 * moves to its new value instead of jumping. The first `Animation` of a
 * value that is never drawn as cells, so its `nextChange` is its only way of
 * saying when to look again (`./animation.ts`).
 *
 * The value at `t` is the `Timing`'s ease of the way from `from` to `to`
 * through `Phase.once(0, seconds)`: `from` at `t ≤ 0` whenever the ease
 * starts at 0, as every built-in does but `step-start` and the steps that
 * jump at the start of their interval, which show their first jump before
 * the tween begins, as `ColorRamp.at` does; `to` from `seconds` on. It is
 * the one-shot phase every effect transition reads time
 * through, so there is no second rule about when a one-shot begins: it
 * begins at 0 on its own clock, and starting it later is `Animation.sequence`'s
 * or a `Timeline`'s job. [LAW:single-enforcer] An ease that overshoots is
 * shown as it is — a count eased by `back-out` passes its target and comes
 * back, which is what the curve is for — and lands exactly on `to`, because
 * every built-in ease is exactly 1 at 1 and the blend is `(1 − p)·from +
 * p·to`, exact at both ends where `from + (to − from)·p` is not.
 *
 * A tween keeps nothing between calls, so retargeting is not a mutation: a
 * tween whose target changes at `t₁` is the old tween until `t₁`, then a new
 * one from the old one's value there — `Animation.sequence(old, t₁,
 * tween(old.at(t₁), to, timing))` — and starts from where it is because
 * that is where it was built from. [LAW:no-ambient-temporal-coupling]
 *
 * Over colours it is a `ColorRamp` read over time (`../themes/ramp.ts`,
 * `over`): the ramp is already the one place two colours are blended, in
 * OKLCH, and a colour tween is a two-stop ramp over its seconds, not a
 * second blender. [LAW:one-source-of-truth]
 *
 * Tier 2 of `src/core/`: `./easing.ts` and `./animation.ts`, nothing else.
 * [LAW:one-way-deps]
 */

import { Animation } from "./animation.js";
import { Phase, type Timing } from "./easing.js";

/**
 * `from` eased to `to` over `timing`, as an `Animation<number>`: moving from
 * 0 to `timing.seconds` on its own clock, the ease of 0 before (`from`, for
 * every ease that starts at 0), `to` after, and so
 * seen at its end, never mid-way, by a host whose frames are further apart
 * than it is long. `from` and `to` must be finite; the seconds are checked
 * where every one-shot's are, in `Phase.once`. A tween to where it already
 * is is `Animation.constant(from)`, decided here once: the blend would land
 * one ulp off `from` at some `p`, and a value that never moves is one that
 * never changes, so a host is told not to look again. [LAW:parse-dont-validate]
 */
export function tween(from: number, to: number, timing: Timing): Animation<number> {
  for (const [name, v] of [["from", from], ["to", to]] as const) {
    if (!Number.isFinite(v)) throw new RangeError(`tween ${name} must be finite, got ${v}`);
  }
  const { ease, seconds } = timing;
  const phase = Phase.once(0, seconds);
  if (from === to) return Animation.constant(from);
  return {
    at(t) {
      const p = ease(phase(t));
      return (1 - p) * from + p * to;
    },
    // Before it begins the value is held until 0; while it moves, every
    // frame; from `seconds` on, never again — and it became what it is at
    // `seconds`, or always was before it began.
    nextChange: (t) => (t < 0 ? 0 : t < seconds ? t : Number.POSITIVE_INFINITY),
    lastChange: (t) => (t < 0 ? Number.NEGATIVE_INFINITY : t < seconds ? t : seconds),
    // A one-shot, reduced, cuts from where it starts to where it arrives.
    reduced: () => Animation.cut(from, to),
  };
}
