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
 * A ramp also carries how far it has been moved: `scroll`, in spans, how
 * far its colours have travelled along it, and `hue`, in turns, how far
 * they are rotated round the OKLCH hue circle. A moved ramp is still a
 * `ColorRamp`, so anything that reads a ramp reads a moving one frame by
 * frame (`moving`) with nothing new to learn. [LAW:one-type-per-behavior]
 *
 * [LAW:one-way-deps] Imports `core/color`, `core/easing`, `core/oklch`,
 * `core/animation` for `over` and `moving`, and `core/tween` for `over`; nothing
 * here knows what a palette is. Resolving stop *names* is the template binding's
 * job (`paletteFuncs`), which hands this module resolved colors.
 */

import { Animation } from "../core/animation.js";
import type { ColorRgba } from "../core/color.js";
import { EASES, type Ease } from "../core/easing.js";
import { IDENTITY, Oklch } from "../core/oklch.js";
import { tween } from "../core/tween.js";

/** One stop: the color the ramp is exactly `color` at position `at`. */
export interface ColorStop {
  readonly at: number;
  readonly color: ColorRgba;
}

/**
 * How a ramp moves over time, each part an `Animation<number>` that is
 * `Animation.constant(0)` when not given. `scroll` is in spans: at 1 the
 * colours have travelled the whole way from the first stop to the last and
 * wrapped back, so `Animation.continuous(Phase.loop(seconds))` scrolls once
 * every `seconds`. `hue` is in turns, CSS's `turn`: at 1 every hue has gone
 * once round the circle. A one-shot that settles is a `tween` to where it
 * rests.
 */
export interface RampMotion {
  readonly scroll?: Animation<number>;
  readonly hue?: Animation<number>;
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
  /** How far the colours have moved along the span, in spans, in [0, 1). */
  readonly scroll: number;
  /** How far every hue is rotated in OKLCH, in turns, in [0, 1). */
  readonly hue: number;

  constructor(
    readonly ease: Ease,
    readonly stops: readonly ColorStop[],
    scroll = 0,
    hue = 0,
  ) {
    this.scroll = turnOf("scroll", scroll);
    this.hue = turnOf("hue", hue);
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
   * above the last stop it is the last; between two stops the raw progress
   * from the lower to the upper goes through `ease`, and the eased progress
   * says how far to mix.
   *
   * Eased progress 0 is the lower stop's color and 1 the upper's, byte for
   * byte — the exactness contract, not a shortcut: the sRGB → OKLCH → sRGB
   * round-trip can land a channel one unit off, and a ramp that did not hit
   * its own stops exactly would make a `step` ramp paint a color the author
   * never wrote. So a value on a stop is that stop's color whenever the ease
   * starts at 0, as every built-in does but `step-start` and the
   * `jump-start`/`jump-both` steps, which jump at the start of the interval as
   * CSS defines them. An ease that overshoots [0, 1] holds the end colors
   * where it does: a ramp never paints outside its stops.
   *
   * A scrolled ramp reads, inside its span, the colour `scroll` spans behind
   * `value`, wrapped back round the span as a repeating gradient does —
   * seamless when the first and last stops are one colour; outside the span
   * its end colours hold, however far it has scrolled. A rotated ramp turns
   * the colour read by `hue` at its own lightness and chroma. Unmoved, every
   * read keeps the exactness above.
   */
  at(value: number): ColorRgba {
    if (!Number.isFinite(value)) {
      throw new RangeError(`ColorRamp.at needs a finite value, got ${value}`);
    }
    const first = (this.stops[0] as ColorStop).at;
    const last = (this.stops[this.stops.length - 1] as ColorStop).at;
    const span = last - first;
    const inside = first <= value && value <= last;
    const moved = inside ? value - this.scroll * span : value;
    const read = this.unmoved(inside && moved < first ? moved + span : moved);
    // Exact when unrotated: the OKLCH round trip can land a channel one off.
    return this.hue === 0 ? read : Oklch.fromRgba(read).applyKey({ ...IDENTITY, hueShift: 360 * this.hue }).toRgba();
  }

  /** The colour at `value` with the ramp unmoved: the stops and the ease alone. */
  private unmoved(value: number): ColorRgba {
    const stops = this.stops;
    // The last stop at or below `value`; -1 when `value` is below them all.
    let lower = -1;
    while (lower + 1 < stops.length && (stops[lower + 1] as ColorStop).at <= value) lower++;
    if (lower < 0) return (stops[0] as ColorStop).color;
    const from = stops[lower] as ColorStop;
    if (lower === stops.length - 1) return from.color;
    // `to.at > value >= from.at` by construction of `lower`, so the segment
    // has positive width and raw progress is in [0, 1).
    const to = stops[lower + 1] as ColorStop;
    const t = this.ease((value - from.at) / (to.at - from.at));
    if (t <= 0) return from.color;
    if (t >= 1) return to.color;
    return Oklch.fromRgba(from.color).mix(Oklch.fromRgba(to.color), t).toRgba();
  }

  /**
   * This ramp read over time: its span of positions, from the first stop's
   * to the last's, crossed at a steady rate in `seconds` and held at the last
   * stop from then on, each colour along the way the ramp's own. A colour
   * tween is a two-stop ramp over its seconds — the ramp's ease shaping the
   * move, so `new ColorRamp(ease, [{ at: 0, color: a }, { at: 1, color: b
   * }]).over(seconds)` is `a` eased to `b` — and a ramp of more stops over
   * time is a sweep through all of them. [LAW:one-source-of-truth] The
   * blending is `at`'s; what time adds is `tween`'s (`core/tween.ts`), so a
   * host sampling once a second or sixty times reads the stop colours byte
   * for byte where `at` paints them.
   */
  over(seconds: number): Animation<ColorRgba> {
    const first = (this.stops[0] as ColorStop).at;
    const last = (this.stops[this.stops.length - 1] as ColorStop).at;
    return Animation.map(tween(first, last, { seconds, ease: EASES.linear }), (value) => this.at(value));
  }

  /**
   * This ramp moving: at `t`, scrolled by `motion.scroll` and rotated by
   * `motion.hue` at `t`, on top of however far it was already moved, and
   * changing when either does — so a loop moves every frame and a ramp a
   * tween settles never changes again once it arrives.
   * [LAW:one-source-of-truth] When it next changes is `Animation.all`'s
   * answer over the two parts; nothing here says it a second time. Whether
   * the depth it is drawn at can show the move is decided where it is drawn
   * (`gradient`, through `stillWhereNothingMoves`).
   */
  moving(motion: RampMotion): Animation<ColorRamp> {
    const still = Animation.constant(0);
    return Animation.map(Animation.all([motion.scroll ?? still, motion.hue ?? still] as const), ([scroll, hue]) =>
      new ColorRamp(this.ease, this.stops, this.scroll + scroll, this.hue + hue));
  }
}

/**
 * `v` as a fraction of one turn, in [0, 1): a whole turn is no turn, and a
 * negative one counts back from a whole turn. A value so close under a whole
 * turn that the fraction rounds to it is the turn itself. [LAW:single-enforcer]
 * The constructor reads both moves through here, so a non-finite one fails
 * here, loudly, naming which.
 */
function turnOf(what: string, v: number): number {
  if (!Number.isFinite(v)) throw new RangeError(`ColorRamp ${what} must be finite, got ${v}`);
  const into = v - Math.floor(v);
  return into < 1 ? into : 0;
}
