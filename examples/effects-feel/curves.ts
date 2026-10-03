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
 * - Light only ever lights, and never takes the words away. Ink and the
 *   fill under it both move toward the light and never darken, each by its
 *   own share: the share a colour can take while every cell it is drawn in
 *   still reads at its resting contrast or WCAG AA, whichever is lower. A
 *   cell with contrast to spare glows brightly; one with none barely moves.
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
  contrastRatio,
  type CellColors,
  type ColorRgba,
  type Ease,
  type Effect,
  type EffectCell,
} from "../../src/index.js";
import { fbm, noise, smoothstep } from "./noise.js";

/** What a loop does to one colour at strength `w` in [0, 1]: at 0, nothing. */
export type Touch = (color: ColorRgba, w: number) => ColorRgba;

/** How strongly a loop acts on a cell at a moment, in [0, 1]. */
export type Field = (cell: EffectCell, t: number) => number;

/** A looping effect: what it does to a colour, and where and when, how strongly. */
export interface Loop {
  readonly touch: Touch;
  readonly field: Field;
}

/** A cell's ink and ground, as the screen shows them. */
export type Pair = readonly [ColorRgba, ColorRgba];

/** The contrast no touch takes a cell below, unless it rested below it: WCAG AA for body text. */
const LEGIBLE = 4.5;

/**
 * The strengths a cell is drawn at: a field is snapped to one of these, and
 * a share is checked at every one, so every strength drawn was checked. A
 * 256-colour cube colour changes in jumps between strengths, and no check of
 * a continuous strength between two of them could see every jump. A step is
 * a 48th of a swing, well under a just-noticeable difference.
 */
const LEVELS = 48;
const STRENGTHS = Array.from({ length: LEVELS }, (_, i) => (i + 1) / LEVELS);

/** What 8-bit rounding of an OKLCH round trip can cost a contrast ratio. */
const ROUNDING = 0.01;

/**
 * How much of `touch` each of `colors` (hex) can take: the largest share in
 * [0, 1] at which every pair in `pairs` that shows it, touched at the same
 * strength, still reads at its resting contrast or `LEGIBLE`, whichever is
 * lower. A colour in no pair's `colors` is the terminal's, and takes none.
 *
 * Colours are settled lightest first, each against every partner: one
 * already settled at its share, one not yet settled as it is. So the lighter
 * colour of a cell takes the light first and its darker partner spends
 * whatever contrast is left — pale lettering lifting off a dark fill gives
 * the fill room to glow — and a darker colour left as it is always holds,
 * because its lighter partner was settled against exactly that.
 */
export function shares(pairs: readonly Pair[], colors: ReadonlySet<string>, touch: Touch): Map<string, number> {
  const rgba = new Map(pairs.flat().map((color): [string, ColorRgba] => [color.hex, color]));
  const lightness = (hex: string): number => Oklch.fromRgba(rgba.get(hex)!).l;
  const settled = new Map<string, number>();
  for (const hex of [...colors].sort((a, b) => lightness(b) - lightness(a))) {
    const partners = pairs.flatMap(([fg, bg]): [ColorRgba, number][] => {
      const partner = fg.hex === hex ? bg : bg.hex === hex ? fg : undefined;
      return partner === undefined ? [] : [[partner, settled.get(partner.hex) ?? 0]];
    });
    const color = rgba.get(hex)!;
    const holds = (share: number): boolean =>
      partners.every(([partner, theirs]) => {
        const floor = Math.min(contrastRatio(color, partner), LEGIBLE);
        return STRENGTHS.every(
          (w) => contrastRatio(touchedAt(touch, color, share * w), touchedAt(touch, partner, theirs * w)) >= floor - ROUNDING,
        );
      });
    let [lo, hi] = holds(1) ? [1, 1] : [0, 1];
    for (let i = 0; i < 20 && hi - lo > 1e-3; i++) {
      const mid = (lo + hi) / 2;
      [lo, hi] = holds(mid) ? [mid, hi] : [lo, mid];
    }
    settled.set(hex, lo);
  }
  return settled;
}

/**
 * A loop as an `Effect` on a subject's own colours, by hex, wherever a cell
 * shows them, each touched at its share of the cell's strength. A powerline
 * strip's fill is the ground of its cells and the ink of the seam glyphs
 * between them, so the arrow moves with the cell it points out of.
 */
export function onColors(share: ReadonlyMap<string, number>, loop: Loop): Effect {
  return ({ fg, bg }, cell, t) => {
    const w = Math.round(loop.field(cell, t) * LEVELS) / LEVELS;
    const moved = (color: ColorRgba): ColorRgba => touchedAt(loop.touch, color, (share.get(color.hex) ?? 0) * w);
    return { fg: moved(fg), bg: moved(bg) };
  };
}

/**
 * `color` under `touch` at strength `w`, and at strength 0 the colour itself,
 * exactly: an OKLCH round trip can land a step off, and at 16 colours a step
 * off is another slot.
 */
function touchedAt(touch: Touch, color: ColorRgba, w: number): ColorRgba {
  return w === 0 ? color : touch(color, w);
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
 * A colour under `glow`: the one way every light here falls. It moves `w` of
 * the way toward the light's colour, and never below its own lightness —
 * light can warm a colour and lift it, never darken it. A colour already
 * lighter than the light only warms, and white, which has no warmer shade at
 * its lightness, stays white.
 */
export function light(glow: ColorRgba): Touch {
  const to = Oklch.fromRgba(glow);
  return (color, w) => {
    const from = Oklch.fromRgba(color);
    return blend(from, new Oklch(Math.max(from.l, to.l), to.c, to.h, to.alpha), w).toRgba();
  };
}

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
export function pulse(curve: Curve, glow: ColorRgba): Loop {
  const P = curve.seconds;
  const field: Field = (_cell, t) => {
    // The rhythm's drift is slow enough that phase only ever moves forward.
    const phase = t / P - 0.06 + 0.03 * noise(t / (3 * P), 0.5, 0.5);
    const depth = 0.8 + 0.2 * noise(t / (4 * P), 3.5, 0.5);
    return curve.swing * curve.ease(breathAt(phase - Math.floor(phase)) * depth);
  };
  return { touch: light(glow), field };
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
export function shimmer(curve: Curve, span: number, width: number, glow: ColorRgba, z: number): Loop {
  const phase = Phase.loop(curve.seconds);
  // A ripple's crest: a Gaussian ridge, 1 where the field crosses zero and in
  // (0, 1] for any noise, smooth throughout, so a crest sliding through a cell
  // lights it smoothly.
  const ripple = (a: number, b: number, c: number): number => Math.exp(-((noise(a, b, c) / 0.8) ** 2));
  const field: Field = (cell, t) => {
    const centre = phase(t) * (span + 2 * width) - width;
    const band = bump((cell.col - centre) / width);
    const row = cell.row + z;
    const current = 0.8 * noise(cell.col * 0.05, row * 0.3 + 1.3, t * 0.03);
    const caustic =
      (ripple(cell.col * 0.21 + current, row * 0.9, t * 0.035) * ripple(cell.col * 0.33 + 9.1 - current, row * 0.7, t * 0.028 + 4.2)) **
      2;
    return curve.swing * curve.ease(band * (0.3 + 0.4 * caustic));
  };
  return { touch: light(glow), field };
}

/** How far a gust at its strongest silvers a colour: lighter and greyer. */
const SILVER = { lightness: 0.08, chroma: 0.3 } as const;

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
export function drift(curve: Curve, span: number, z: number): Loop {
  const speed = span / curve.seconds;
  const field: Field = (cell, t) => {
    const row = cell.row + z;
    const warp = 1.2 * noise(cell.col * 0.03, row * 0.2 + 3.3, t * 0.02);
    const air = fbm((cell.col - speed * t) * 0.045 + warp, row * 0.3, t * 0.05, 3);
    const swell = 0.6 + 0.4 * noise(t / (1.7 * curve.seconds) + 0.4, cell.col * 0.012, 9.1 + z);
    return curve.ease(swell * smoothstep(-0.1, 0.45, air));
  };
  const touch: Touch = (color, w) =>
    Oklch.fromRgba(color)
      .applyKey({ ...IDENTITY, hueShift: curve.swing * w, lightnessShift: SILVER.lightness * w, chromaScale: 1 - SILVER.chroma * w })
      .toRgba();
  return { touch, field };
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
export function sparkle(curve: Curve, span: number, glow: ColorRgba, z: number): Loop {
  const count = Math.max(2, Math.round(span / 9));
  const HALO = 6;
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
  const field: Field = (cell, t) => {
    let shine = 0;
    for (const fly of fliesAt(t)) shine += fly.glow * bump(Math.hypot(cell.col - fly.x, 2 * (cell.row - fly.y)) / HALO);
    return curve.swing * curve.ease(clamp01(shine));
  };
  return { touch: light(glow), field };
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
