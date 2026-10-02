/**
 * A color ramp: a number mapped onto a color through ordered stops.
 *
 * "What does 73 % spent look like" has no answer in a vocabulary of discrete
 * adjustments (`darken`, `mix`, `contrastOn`): each takes colors and returns a
 * color, and none takes a *measurement*. Without a ramp the answer gets
 * computed outside the theme system — a script emits a hex, a template
 * branches `if ge .pct 80 … else if ge .pct 50 …` — and that color decision
 * can no longer transpose with the palette it was meant to belong to. A ramp
 * is the one function whose input is a number, so the decision stays inside.
 *
 * A threshold cascade is a ramp too: the same stops with the `step` ease hold
 * each color until the next position, which is exactly `≥ threshold → hotter`
 * written as data. [LAW:one-type-per-behavior] One primitive; the easing is a
 * value — any `Ease` from `core/easing`, the vocabulary every effect shares —
 * so a gradient and a cascade differ by one word, not by which function was
 * called. [LAW:dataflow-not-control-flow] `at` applies it unconditionally.
 *
 * Interpolation is in OKLCH (`Oklch.mix`), so a `linear` ramp between two
 * theme colors passes through perceptually even steps rather than the muddy
 * midpoints of an sRGB blend.
 *
 * [LAW:one-way-deps] Imports `core/color`, `core/easing` and `core/oklch`
 * only; nothing here knows what a palette is. Resolving stop *names* is the template binding's
 * job (`paletteFuncs`), which hands this module resolved colors.
 */

import type { ColorRgba } from "../core/color.js";
import type { Ease } from "../core/easing.js";
import { Oklch } from "../core/oklch.js";

/** One stop: the color the ramp is exactly `color` at position `at`. */
export interface ColorStop {
  readonly at: number;
  readonly color: ColorRgba;
}

/**
 * An immutable ramp over stops sorted by position.
 *
 * [LAW:single-enforcer] The constructor is the one place a ramp's shape is
 * checked — at least one stop, every position finite, positions
 * non-decreasing — matching the `ColorRgba`/`Oklch` pattern. Positions are
 * required to arrive in order rather than being sorted here: a ramp whose
 * stops are read from configuration (`warning at 80, error at 50`) is an
 * authoring mistake, and sorting would quietly render a different ramp than
 * the one written. [LAW:no-silent-failure]
 *
 * Two stops may share a position: that is a hard edge, the later color
 * taking over at exactly that value (CSS gradients spell a hard stop the
 * same way).
 */
export class ColorRamp {
  constructor(
    readonly easing: Ease,
    readonly stops: readonly ColorStop[],
  ) {
    if (stops.length === 0) {
      throw new RangeError("a ColorRamp needs at least one stop");
    }
    for (const [i, stop] of stops.entries()) {
      if (!Number.isFinite(stop.at)) {
        throw new RangeError(`ColorRamp stop ${i} has a non-finite position ${stop.at}`);
      }
      const prev = stops[i - 1];
      if (prev !== undefined && stop.at < prev.at) {
        throw new RangeError(
          `ColorRamp stops must be in ascending position order; ` +
            `stop ${i} at ${stop.at} follows stop ${i - 1} at ${prev.at}`,
        );
      }
    }
  }

  /**
   * The color at `value`. Below the first stop it is the first color; at or
   * above the last stop it is the last; between two stops it is `easing`
   * of the way from the lower to the upper, so a value exactly on a stop is
   * that stop's color, byte for byte.
   *
   * The two endpoint returns are the exactness contract, not a shortcut:
   * the sRGB → OKLCH → sRGB round-trip can land a channel one unit off, and a
   * ramp that does not hit its own stops exactly would make a `step` ramp
   * paint a color the author never wrote.
   */
  at(value: number): ColorRgba {
    if (!Number.isFinite(value)) {
      throw new RangeError(`ColorRamp.at needs a finite value, got ${value}`);
    }
    const stops = this.stops;
    // The last stop at or below `value`; -1 when `value` is below them all.
    let lower = -1;
    while (lower + 1 < stops.length && (stops[lower + 1] as ColorStop).at <= value) lower++;
    if (lower < 0) return (stops[0] as ColorStop).color;
    const from = stops[lower] as ColorStop;
    if (lower === stops.length - 1) return from.color;
    // `to.at > value >= from.at` by construction of `lower`, so the segment
    // has positive width and `t ∈ [0, 1)`.
    const to = stops[lower + 1] as ColorStop;
    const t = this.easing((value - from.at) / (to.at - from.at));
    if (t <= 0) return from.color;
    if (t >= 1) return to.color;
    return Oklch.fromRgba(from.color).mix(Oklch.fromRgba(to.color), t).toRgba();
  }
}
