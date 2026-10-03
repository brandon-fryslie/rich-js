/**
 * effects-feel — the effect curves under judgement.
 *
 * THIS IS A DEMO. It exists so the feel of each effect is agreed before any
 * curve lands in `src/`; what survives the sign-off is promoted from the
 * sign-off notes, not from this file.
 *
 * Each effect is something a first-time observer already knows from life —
 * a breath, sunlight moving on water, wind crossing a field, fireflies, ink
 * blooming in water, mist lifting — because a motion the eye recognises
 * reads as calm and alive, where a motion it has to learn reads as a widget.
 * What makes those motions familiar is what every curve here keeps:
 *
 * - Nothing jumps. Every curve is continuous in time, built from smooth
 *   noise (`noise.ts`) and smooth waveforms, so at one frame a second a cell
 *   moves a little and at thirty it glides.
 * - Nothing repeats exactly. Rhythms are perturbed by slow noise, the way a
 *   breath or a gust never quite repeats.
 * - Neighbours move together. Variation is spatially coherent — patches,
 *   filaments, fronts — never per-cell static.
 * - Moves are small. The swing is a touch of light, not a colour change.
 * - Light keeps text legible. A colour catches the light that reads against
 *   the colour it is read against — a pale light where its ink is dark, a
 *   deep amber where its ink is light, as light through coloured glass — so a
 *   glint warms it without washing it toward its ink.
 * - Elements are apart. Each sits at its own `z` in the noise, so two
 *   elements under one effect do not move in lockstep.
 *
 * Every curve is an `Effect` from `src/renderables/effect.ts`; colour moves
 * are in OKLCH, where equal steps look equal. A curve's `ease` maps its
 * intensity in [0, 1] — how strongly the effect acts on a cell at a moment —
 * onto its swing, for the loops and the transitions alike.
 *
 * [LAW:no-ambient-temporal-coupling] No curve reads a clock; `t` is the
 * effect's argument, so the frame owner decides when to sample.
 */

import {
  IDENTITY,
  Oklch,
  Phase,
  type CellColors,
  type ColorRgba,
  type Ease,
  type Effect,
  type EffectCell,
} from "../../src/index.js";
import { fbm, noise, smoothstep } from "./noise.js";

/**
 * A move of one colour: the colour, the colour its text is read against, the
 * cell, the time, to the new colour.
 */
export type ColorMove = (color: ColorRgba, against: ColorRgba, cell: EffectCell, t: number) => ColorRgba;

/**
 * A one-colour move as an `Effect` on a subject's own colours, by hex,
 * wherever a cell shows them, each read against the colour `colors` pairs it
 * with. A powerline strip's fill is the ground of its cells and the ink of the
 * seam glyphs between them, so the arrow moves with the cell it points out
 * of; the terminal ground behind its caps is no colour of the strip's, and
 * stays put.
 */
export function onColors(colors: ReadonlyMap<string, ColorRgba>, move: ColorMove): Effect {
  const moved = (color: ColorRgba, cell: EffectCell, t: number): ColorRgba => {
    const against = colors.get(color.hex);
    return against === undefined ? color : move(color, against, cell, t);
  };
  return ({ fg, bg }, cell, t) => ({ fg: moved(fg, cell, t), bg: moved(bg, cell, t) });
}

/**
 * A light as each colour catches it: `pale` by a colour read against
 * something darker, `deep` by one read against something lighter.
 */
export interface Light {
  readonly pale: ColorRgba;
  readonly deep: ColorRgba;
}

/** How the curves below are tuned: one period (or duration), ease and swing. */
export interface Curve {
  /** Seconds: a looping effect's period, a transition's duration. */
  readonly seconds: number;
  /** Intensity in [0, 1] to the fraction of `swing` applied. */
  readonly ease: Ease;
  /** How far the move goes at full intensity; its unit is the effect's. */
  readonly swing: number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * `w` of the way from `from` to `to` along a straight line in OKLab. Light
 * falling on a colour, or a colour thinning into its ground, moves straight
 * toward the other colour; `Oklch.mix` goes round the hue circle instead, so
 * blue lit by gold would pass through cyan on the way.
 */
function blend(from: Oklch, to: Oklch, w: number): Oklch {
  if (!(w >= 0 && w <= 1)) throw new RangeError(`blend: w must be in [0, 1]; got ${w}`);
  const rad = Math.PI / 180;
  const a = (1 - w) * from.c * Math.cos(from.h * rad) + w * to.c * Math.cos(to.h * rad);
  const b = (1 - w) * from.c * Math.sin(from.h * rad) + w * to.c * Math.sin(to.h * rad);
  return new Oklch((1 - w) * from.l + w * to.l, Math.hypot(a, b), Math.atan2(b, a) / rad, from.alpha);
}

/**
 * `color`, `w` of the way into `light` as it reads against `against`: the
 * one way every light here falls on a colour.
 */
function lit(color: ColorRgba, against: ColorRgba, light: { pale: Oklch; deep: Oklch }, w: number): ColorRgba {
  const from = Oklch.fromRgba(color);
  return blend(from, Oklch.fromRgba(against).l < from.l ? light.pale : light.deep, w).toRgba();
}

const lightOf = (light: Light): { pale: Oklch; deep: Oklch } => ({
  pale: Oklch.fromRgba(light.pale),
  deep: Oklch.fromRgba(light.deep),
});

/**
 * One breath at phase `p` in [0, 1): a quicker inhale, a longer exhale, then
 * a rest — the shape of a sleeper's breathing, which is what makes a pulse
 * read as calm rather than as a warning. Each joint has zero slope.
 */
function breathAt(p: number): number {
  const INHALE = 0.36;
  const EXHALE = 0.5;
  if (p < INHALE) return (1 - Math.cos((Math.PI * p) / INHALE)) / 2;
  if (p < INHALE + EXHALE) return (1 + Math.cos((Math.PI * (p - INHALE)) / EXHALE)) / 2;
  return 0;
}

/**
 * Pulse, as breathing. Swing: how far into `light` the colour goes at the
 * top of a full breath, 0–1. The whole element breathes together, warming
 * into the light on the inhale and settling back on the exhale — warmth,
 * not only lightness, so text already near white still visibly breathes. No
 * two breaths are the same: the rhythm drifts a little early or late and the
 * depth varies, both on slow noise. Every cell breathes the same breath, so
 * a fill drawn across many cells — a powerline seam and the cell it points
 * out of — stays one colour. A breath starts in its rest, so `t = 0` draws
 * the cell untouched.
 */
export function pulse(curve: Curve, light: Light): ColorMove {
  const P = curve.seconds;
  const glow = lightOf(light);
  return (color, against, _cell, t) => {
    // The rhythm's drift is slow enough that phase only ever moves forward.
    const phase = t / P - 0.06 + 0.03 * noise(t / (3 * P), 0.5, 0.5);
    const depth = 0.8 + 0.2 * noise(t / (4 * P), 3.5, 0.5);
    return lit(color, against, glow, curve.swing * curve.ease(breathAt(phase - Math.floor(phase)) * depth));
  };
}

/** A soft, compact bump: 1 at `d = 0`, 0 from `|d| ≥ 1`, smooth throughout. */
const bump = (d: number): number => (Math.abs(d) >= 1 ? 0 : (1 - d * d) ** 3);

/**
 * Shimmer, as sunlight moving across water. Swing: how far into `light` the
 * brightest glint goes, 0–1. A soft band of light crosses columns 0 to
 * `span` once a period, `width` columns either side of its centre, entering
 * and leaving fully off the row. Inside it the light is a soft glow broken
 * into caustics — bright filaments where two ripples cross — carried on a
 * slow current and re-forming as they go, so the glints dance while the band
 * glides. Before the band enters, the row is untouched.
 */
export function shimmer(curve: Curve, span: number, width: number, light: Light, z: number): ColorMove {
  const phase = Phase.loop(curve.seconds);
  const glow = lightOf(light);
  // A ripple's crest: ridged noise, 1 where the field crosses zero. Its crease
  // is rounded, so a crest sliding through a cell lights it smoothly.
  const ripple = (a: number, b: number, c: number): number => 1 - Math.hypot(noise(a, b, c), 0.12);
  return (color, against, cell, t) => {
    const centre = phase(t) * (span + 2 * width) - width;
    const band = bump((cell.col - centre) / width);
    const row = cell.row + z;
    const current = 0.8 * noise(cell.col * 0.05, row * 0.3 + 1.3, t * 0.06);
    const caustic =
      (ripple(cell.col * 0.21 + current, row * 0.9, t * 0.07) * ripple(cell.col * 0.33 + 9.1 - current, row * 0.7, t * 0.055 + 4.2)) **
      2.5;
    return lit(color, against, glow, curve.swing * curve.ease(band * (0.3 + 0.7 * caustic)));
  };
}

/** How far a gust at its strongest silvers a colour: lighter and greyer. */
const SILVER = { lightness: 0.035, chroma: 0.17 } as const;

/**
 * Drift, as wind crossing a field. Swing: degrees of hue at a gust's
 * strongest. Gusts are patches of noise carried along the row from column 0
 * toward `span`, crossing it once a period and changing shape as they go.
 * The air they ride is itself turbulent — the field is warped by slower
 * noise, so a gust bends, stretches and catches up with another rather than
 * sliding by in a straight line — and gusts come in sets, the wind rising
 * and easing over a longer swell. Where one passes, the colour turns and
 * silvers — lighter and greyer, by how strong the gust is whatever the
 * swing — the way grass shows the pale side of its blades.
 */
export function drift(curve: Curve, span: number, z: number): ColorMove {
  const speed = span / curve.seconds;
  return (color, _against, cell, t) => {
    const row = cell.row + z;
    const warp = 1.2 * noise(cell.col * 0.03, row * 0.2 + 3.3, t * 0.02);
    const air = fbm((cell.col - speed * t) * 0.045 + warp, row * 0.3, t * 0.05, 3);
    const swell = 0.6 + 0.4 * noise(t / (1.7 * curve.seconds) + 0.4, cell.col * 0.012, 9.1 + z);
    const amount = curve.ease(swell * smoothstep(-0.1, 0.45, air));
    return Oklch.fromRgba(color)
      .applyKey({
        ...IDENTITY,
        hueShift: curve.swing * amount,
        lightnessShift: SILVER.lightness * amount,
        chromaScale: 1 - SILVER.chroma * amount,
      })
      .toRgba();
  };
}

/**
 * Sparkle, as fireflies. Swing: how far into the firefly's `light` a glow
 * goes at its brightest, 0–1. About one firefly to every nine columns of
 * `span`, each with a home it wanders lazily around. Each glows and goes
 * dark on its own slow noise, out of step with every other, so at any moment
 * a few are lit; its light is a soft halo a few cells wide, brightest where
 * it is, so as it drifts the glow slides between cells rather than hopping.
 * `seconds` is how long a glow takes, rise and fall.
 */
export function sparkle(curve: Curve, span: number, light: Light, z: number): ColorMove {
  const glow = lightOf(light);
  const count = Math.max(2, Math.round(span / 9));
  const HALO = 4;
  const homes = Array.from({ length: count }, (_, i) => ({
    home: (i + 0.5 + 0.7 * noise(i * 1.7 + 0.2, 0.3, 0.5 + z)) * (span / count),
    z: i * 4.9 + 0.3 + z,
  }));
  // Where every firefly is and how bright at one moment: a frame asks for
  // the same moment once per cell, so it is worked out once per moment.
  let flown = { t: Number.NaN, flies: [] as { x: number; y: number; glow: number }[] };
  const fliesAt = (t: number) => {
    if (flown.t !== t) {
      flown = {
        t,
        flies: homes.map((fly) => ({
          x: fly.home + 7 * noise(fly.z, 0.1, t * 0.035),
          y: 0.6 * noise(fly.z, 2.2, t * 0.035),
          glow: smoothstep(0, 0.6, noise(fly.z, 7.7, t / curve.seconds)) ** 2,
        })),
      };
    }
    return flown.flies;
  };
  return (color, against, cell, t) => {
    let shine = 0;
    for (const fly of fliesAt(t)) shine += fly.glow * bump(Math.hypot(cell.col - fly.x, 2 * (cell.row - fly.y)) / HALO);
    return lit(color, against, glow, curve.swing * curve.ease(clamp01(shine)));
  };
}

/**
 * How much of a cell's ink shows at `t`: 1 is the ink as drawn, 0 is ink the
 * colour of the ground. Read per cell, so cells can arrive or leave apart.
 */
export type Visibility = (cell: EffectCell, t: number) => number;

/**
 * The ink mixed toward the ground by how hidden the cell is: invisible is ink
 * equal to ground. `swing` scales the hiding — 1 reaches fully invisible.
 */
export function veiled(visibility: Visibility, swing: number): Effect {
  return (colors: CellColors, cell, t) => ({
    fg: blend(Oklch.fromRgba(colors.fg), Oklch.fromRgba(colors.bg), swing * (1 - visibility(cell, t))).toRgba(),
    bg: colors.bg,
  });
}

/**
 * Where each cell falls in a transition's order, in [0, 1]: smooth noise over
 * the element, so neighbouring cells arrive or leave together, in patches
 * with soft edges, as ink spreads or mist thins. `z` places the element in
 * the noise. A cell's place never changes, so it is worked out once.
 */
function order(z: number): (cell: EffectCell) => number {
  const places = new Map<string, number>();
  return (cell) => {
    const at = `${cell.row}:${cell.col}`;
    const place = places.get(at) ?? clamp01(0.5 + 1.1 * fbm(cell.col * 0.09, cell.row * 0.45, z, 3));
    places.set(at, place);
    return place;
  };
}

/** Of a transition's `seconds`, how long each cell's own change takes. */
const OWN = 0.45;

/**
 * Fade-in starting at `start`, as ink blooming in water: patches of the
 * element surface first and the rest follows outward from them, each cell
 * rising smoothly over its own part of the duration. Whole at
 * `start + seconds`.
 */
export function fadeIn(curve: Curve, start: number, z: number): Effect {
  const own = curve.seconds * OWN;
  const place = order(1.7 + z);
  return veiled((cell, t) => curve.ease(Phase.once(start + place(cell) * (curve.seconds - own), own)(t)), curve.swing);
}

/**
 * Dissolve-out starting at `start`, as mist lifting: the element thins in
 * drifting patches, each cell fading smoothly over its own part of the
 * duration, until nothing is left at `start + seconds`.
 */
export function dissolveOut(curve: Curve, start: number, z: number): Effect {
  const own = curve.seconds * OWN;
  const place = order(4.2 + z);
  return veiled((cell, t) => 1 - curve.ease(Phase.once(start + place(cell) * (curve.seconds - own), own)(t)), curve.swing);
}

/** The moment a transition starting at `start` has finished. */
export function settledAt(curve: Curve, start: number): number {
  return start + curve.seconds;
}
