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
 * - Nothing repeats exactly. Rhythms are perturbed by slow noise, and each
 *   breath, firefly's flash and pass of light is an event of its own, with
 *   its own strength and moment, the way no breath or gust is the last one
 *   again. A weaker event is a shorter one, so its strength costs nothing
 *   in smoothness.
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
import { fbm, hash, noise, smoothstep } from "./noise.js";

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
 * How a swell rises and falls: the levels the strongest one passes through,
 * each at its moment in turns of its cycle, from 0 at the start of its turn
 * and back to 0 at its last knot.
 */
type SwellShape = readonly (readonly [turn: number, level: number])[];

/** How long a swell `k` strong lasts, in turns. */
const lasts = (shape: SwellShape, k: number): number => k * shape[shape.length - 1]![0];

/**
 * A swell — a breath, a firefly's glow — `k` strong, in [0, 1], `s` after it
 * began: a raised cosine from each knot to the next, 0 before and after, zero
 * slope at every knot. A weaker swell is a shorter one in proportion, so it
 * climbs no more steeply than the strongest: however strong, its steepest
 * moment is the same, and only the strongest need be checked against the
 * step a frame may take. A swell of strength 0 is no swell at all: 0
 * throughout, its own start included.
 */
function swell(shape: SwellShape, s: number, k: number): number {
  const p = s / k;
  const to = shape.findIndex(([turn]) => p < turn);
  if (!(p > 0) || to < 0) return 0;
  const [t0, l0] = to === 0 ? [0, 0] : shape[to - 1]!;
  const [t1, l1] = shape[to]!;
  return k * (l0 + ((l1 - l0) * (1 - Math.cos((Math.PI * (p - t0)) / (t1 - t0)))) / 2);
}

/**
 * How much of a swell's light has been given by `s`, in [0, 1]: `swell`'s own
 * running integral over its whole, by the midpoint rule, so the two cannot
 * disagree. Paced by it, a motion is quickest at the swell's height and still
 * at both its ends. `k` is above 0.
 */
function given(shape: SwellShape, s: number, k: number): number {
  const whole = lasts(shape, k);
  const area = (to: number): number => {
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += swell(shape, ((i + 0.5) / 24) * to, k);
    return sum * to;
  };
  return area(Math.min(Math.max(s, 0), whole)) / area(whole);
}

/**
 * A sleeper's breath: a quicker inhale, a longer exhale, then stillness for
 * the rest of the turn — the shape that makes a pulse read as calm rather
 * than as a warning.
 */
const BREATH: SwellShape = [[0.28, 1], [0.67, 0]];

/**
 * A sigh: the inhale catches partway and draws in again, then lets go in one
 * long exhale — the double breath everyone knows from a sleeper, or from
 * themselves. Each part of its inhale climbs less steeply than a breath's.
 */
const SIGH: SwellShape = [[0.19, 0.62], [0.31, 1], [0.7, 0]];

/** A firefly's brightest flash, in turns: it kindles quicker than it fades, and the rest of its turn is dark. */
const FLASH: SwellShape = [[0.24, 1], [0.6, 0]];

/** About one breath in this many is a sigh. */
const SIGH_EVERY = 6;

/**
 * Pulse, as breathing. Swing: how far into `light` the colour goes at the
 * top of the deepest breath, a sigh, 0–1. The element warms into the light
 * on the inhale and settles back on the exhale — warmth, not only
 * lightness, so text already near white still visibly breathes. No two
 * breaths are the same, the way a sleeper's are not: most are shallow and
 * quick, about one in `SIGH_EVERY` is a long, deep sigh that catches once
 * on the way in, and each comes at
 * its own moment in its turn, so the rhythm is calm but never a
 * metronome. A breath is not a dimmer: it rises first at a heart that
 * wanders slowly along the element and spreads outward from it, column by
 * column on a narrow element and reaching a wide one's edges in the same
 * share of its turn however wide, and it fills some stretches to the whole
 * swing and others to less — warmth moving through a body, not a lamp
 * turned up. At truecolour, under any continuous ease, neighbouring cells
 * stay within a just-noticeable difference, so a fill drawn across them —
 * a powerline seam and the cell it points out of — reads as one colour; at
 * 256 colours or fewer a fill can step to the next palette colour between
 * them, as under every loop that varies along the row. A breath starts in its rest, so `t = 0` draws the cell untouched.
 */
export function pulse(curve: Curve, span: number, glow: ColorRgba, z: number): Loop {
  const P = curve.seconds;
  // Of a breath, how far behind the heart each column further out starts:
  // `SPREAD` a column at most, so neighbours stay one colour to the eye, and
  // `REACH` across the whole width at most, so even a sigh, done 0.7 of the
  // way through its turn at the heart, is done everywhere before the turn
  // ends and the whole element rests between breaths.
  const SPREAD = 0.0055;
  const REACH = 0.27;
  const perColumn = Math.min(SPREAD, REACH / span);
  // How far, in turns, the rhythm drifts ahead and behind its metronome,
  // measured from where it stood at t = 0.
  const DRIFT = 0.1;
  const drift = (t: number): number => DRIFT * noise(t / (3 * P), 0.5, 0.5 + z);
  const drift0 = drift(0);
  const field: Field = (cell, t) => {
    const heart = span * (0.5 + 0.45 * noise(t / (5 * P), 6.1, z));
    const lag = perColumn * Math.abs(cell.col - heart);
    // Phase only ever moves forward: lag spans at most `REACH` of a turn and
    // the heart crosses at most 0.9 of the width per 5 turns of noise, and
    // the drift moves 0.1 of a turn per 3, so together they slow phase by
    // far less than its own turn a turn. At t = 0 the drift term is 0 and
    // lag is never negative, so every cell starts at rest.
    const phase = Math.max(0, t / P - lag + drift(t) - drift0);
    // Breath `n` is one event across the whole element: its strength and its
    // moment in its turn are the same in every cell.
    const n = Math.floor(phase);
    const [shape, k] = hash(n, 1 + z) < 1 / SIGH_EVERY ? [SIGH, 1] : [BREATH, 0.5 + 0.25 * hash(n, 2 + z)];
    const start = hash(n, 3 + z) * (lasts(SIGH, 1) - lasts(shape, k));
    // How fully this stretch of the element takes it: some stretches to the
    // whole swing, some to 45% of it.
    const fill = 1 - 0.55 * smoothstep(-0.5, 0.5, noise(cell.col * 0.025, 1.9, t / (6 * P) + z));
    return curve.swing * curve.ease(clamp01(swell(shape, phase - n - start, k) * fill));
  };
  return { touch: light(glow), field };
}

/**
 * How many columns a passing light or gust crosses in its period: its pace.
 * Wind and sunlight move at a speed, not in a time set by how long the row is,
 * so a wider element is crossed for longer, never faster, and no cell's colour
 * changes quicker on it from one frame to the next.
 */
const STRIDE = 80;

/** A soft, compact bump: 1 at `d = 0`, 0 from `|d| ≥ 1`, smooth throughout. */
const bump = (d: number): number => (Math.abs(d) >= 1 ? 0 : (1 - d * d) ** 3);

/**
 * Shimmer, as sunlight moving across water. Swing: how far into `light` the
 * brightest glint goes, 0–1. A soft band of light, `width` columns either
 * side of its centre, crosses columns 0 to `span`, entering and leaving
 * fully off the row, `STRIDE` columns in about three quarters of a period. Its passes
 * come the way light comes and goes on water as clouds move: while the sun
 * is out they are bright and follow close on one another, one sometimes
 * catching the last; under cloud they thin to faint ones with the row still
 * for a while between, and the light is never gone for long. Each crosses at its own unhurried pace, drifting a little ahead
 * and behind as it goes. Inside a band the light is a faint glow broken
 * into a glitter path — bright filaments where two ripples cross — carried
 * on a slow current and re-forming as they go, so the glints dance while
 * the band glides. Before the first pass enters, the row is untouched.
 */
export function shimmer(curve: Curve, span: number, width: number, glow: ColorRgba, z: number): Loop {
  const P = curve.seconds;
  const across = span + 2 * width;
  // Passes are events on slots of half a period. Whether slot `j` holds one,
  // and how bright, is the sky's: slow noise over the slots, so sunny and
  // cloudy spells each last a few periods, and a pass is likelier and
  // brighter the clearer the sky.
  const SLOT = P / 2;
  const sky = (j: number): number => smoothstep(-0.4, 0.4, noise(j / 7, 3.3, 5.5 + z));
  // Pass `j` at `t`: how bright its band is and where its centre stands, off
  // the row before it sets off and once it is done. It sets off somewhere in
  // the first `SETS_OFF` of its slot and carries its centre `STRIDE` columns
  // in `LEAST` to `LEAST + SPREAD` periods, give or take its drift, and every
  // one is off the row `UP` slots after its own began.
  const SETS_OFF = 0.7;
  const LEAST = 0.51;
  const SPREAD = 0.4;
  const UP = SETS_OFF + ((LEAST + SPREAD) * P * across) / STRIDE / SLOT;
  const pass = (j: number, t: number): { strength: number; centre: number } => {
    const clear = sky(j);
    // Even under cloud about one slot in three holds a pass, a faint one, so a
    // still spell lasts a period or so, the way a cloud's shadow does, and
    // never long enough to read as the light gone out.
    const present = hash(j, 7.5 + z) < 0.35 + 0.6 * clear ? 1 : 0;
    const strength = present * (0.3 + 0.7 * clear * (0.6 + 0.4 * hash(j, 8.5 + z)));
    const crossing = ((P * across) / STRIDE) * (LEAST + SPREAD * hash(j, 5.5 + z));
    const q = clamp01((t - (j + SETS_OFF * hash(j, 6.5 + z)) * SLOT) / crossing);
    // It drifts ahead and behind on slow noise, by nothing at either edge of
    // the row and never enough to turn it back.
    const centre = q * across - width + 0.06 * across * Math.sin(Math.PI * q) * noise(q, 2.7, j + z);
    return { strength, centre };
  };
  // The passes on the row at one moment: a frame asks for the same moment
  // once per cell, so they are worked out once per moment.
  let passing = { t: Number.NaN, passes: [] as { strength: number; centre: number }[] };
  // Where two passes overlap the brighter wins, so light never doubles up;
  // the first slot is 0, so before it nothing is lit.
  const band = (col: number, t: number): number => {
    if (passing.t !== t) {
      const last = Math.floor(t / SLOT);
      const passes = [];
      for (let j = Math.max(0, Math.ceil(last - UP)); j <= last; j++) passes.push(pass(j, t));
      passing = { t, passes };
    }
    let lit = 0;
    for (const { strength, centre } of passing.passes) lit = Math.max(lit, strength * bump((col - centre) / width));
    return lit;
  };
  // A ripple's crest: a Gaussian ridge, 1 where the field crosses zero and in
  // (0, 1] for any noise, smooth throughout, so a crest sliding through a cell
  // lights it smoothly.
  const ripple = (a: number, b: number, c: number): number => Math.exp(-((noise(a, b, c) / 0.8) ** 2));
  const field: Field = (cell, t) => {
    const lit = band(cell.col, t);
    const row = cell.row + z;
    const current = 0.8 * noise(cell.col * 0.05, row * 0.3 + 1.3, t * 0.02);
    const caustic =
      (ripple(cell.col * 0.21 + current, row * 0.9, t * 0.022) * ripple(cell.col * 0.33 + 9.1 - current, row * 0.7, t * 0.018 + 4.2)) **
      2;
    return curve.swing * curve.ease(lit * (0.1 + 0.6 * caustic));
  };
  return { touch: light(glow), field };
}

/** How far a gust at its strongest silvers a colour: lighter and greyer. */
const SILVER = { lightness: 0.08, chroma: 0.3 } as const;

/**
 * Drift, as wind crossing a field. Swing: degrees of hue at a gust's
 * strongest. Gusts are patches of noise carried along the row from column 0
 * toward its end, `STRIDE` columns a period, changing shape as they go.
 * The air they ride is itself turbulent — the field is warped by slower
 * noise, so a gust bends, stretches and catches up with another rather than
 * sliding by in a straight line — and gusts come in sets, the wind rising
 * and easing over a longer swell. Where one passes, the colour turns and
 * silvers — lighter and greyer, by how strong the gust is whatever the
 * swing — the way grass shows the pale side of its blades.
 */
export function drift(curve: Curve, z: number): Loop {
  const speed = STRIDE / curve.seconds;
  const field: Field = (cell, t) => {
    const row = cell.row + z;
    const warp = 1.2 * noise(cell.col * 0.03, row * 0.2 + 3.3, t * 0.02);
    const air = fbm((cell.col - speed * t) * 0.045 + warp, row * 0.3, t * 0.03, 3);
    const swell = 0.6 + 0.4 * noise(t / (1.7 * curve.seconds) + 0.4, cell.col * 0.012, 9.1 + z);
    return curve.ease(swell * smoothstep(-0.15, 0.55, air));
  };
  const touch: Touch = (color, w) =>
    Oklch.fromRgba(color)
      .applyKey({ ...IDENTITY, hueShift: curve.swing * w, lightnessShift: SILVER.lightness * w, chromaScale: 1 - SILVER.chroma * w })
      .toRgba();
  return { touch, field };
}

/**
 * Sparkle, as fireflies. Swing: how far into the firefly's `light` a glow
 * goes at its brightest, 0–1. About one firefly to every eight columns of
 * `span`, each keeping near a home of its own. A firefly flashes — kindles,
 * drifts a few cells glowing, slowing as it fades — then flies on in the
 * dark and flashes again somewhere a few cells off, the way fireflies at
 * dusk are seen: a short lit stroke, then gone, each time a little
 * elsewhere. Each keeps its own irregular time, now and then letting a turn
 * pass dark, so most moments a few are lit, at different brightnesses. Its
 * light is a soft halo several cells wide, brightest where it is, so as it
 * drifts the glow slides between cells rather than hopping. `seconds` is a firefly's
 * turn: its brightest flash, rise and fall, takes `FLASH` of it, and a
 * dimmer one less.
 */
export function sparkle(curve: Curve, span: number, glow: ColorRgba, z: number): Loop {
  const count = Math.max(3, Math.round(span / 8));
  const HALO = 5;
  // How far from home a flash may begin, and how far the brightest drifts while lit.
  const HOP = 5;
  const GLIDE = 5;
  const TURN = curve.seconds;
  const homes = Array.from({ length: count }, (_, i) => ({
    home: (i + 0.5 + 0.7 * noise(i * 1.7 + 0.2, 0.3, 0.5 + z)) * (span / count),
    z: i * 4.9 + 0.3 + z,
    // Out of step with every other firefly from the first moment.
    offset: hash(i, 0.7 + z) * TURN,
  }));
  // Where every firefly is and how bright at one moment: a frame asks for
  // the same moment once per cell, so it is worked out once per moment.
  let flown = { t: Number.NaN, flies: [] as { x: number; y: number; glow: number }[] };
  const fliesAt = (t: number) => {
    if (flown.t !== t) {
      flown = {
        t,
        flies: homes.map((fly) => {
          // Flash `n` is one event: whether it comes, how bright, when in
          // its turn and where are its own. Between flashes the firefly
          // is dark, so where it moves to is never seen moving.
          const u = t + fly.offset;
          const n = Math.floor(u / TURN);
          // A dark turn is a flash with no light: it keeps its length, so
          // every flash is timed alike.
          const lit = hash(n, fly.z + 1) < 0.15 ? 0 : 1;
          const k = 0.5 + 0.5 * hash(n, fly.z + 2);
          const at = hash(n, fly.z + 3) * (1 - lasts(FLASH, k));
          const s = u / TURN - n - at;
          // While it glows it drifts a few cells one way or the other, as
          // fast as it is bright: quickest at its height, slowing as it
          // fades — the lit stroke a firefly draws on the dusk. A brighter
          // flash lasts longer and draws a longer stroke at the same pace.
          return {
            x:
              fly.home +
              HOP * (2 * hash(n, fly.z + 4) - 1) +
              GLIDE * k * (2 * hash(n, fly.z + 5) - 1) * given(FLASH, s, k) +
              1.5 * noise(fly.z, 0.1, t * 0.035),
            y: 0.6 * noise(fly.z, 2.2, t * 0.035),
            glow: lit * swell(FLASH, s, k),
          };
        }),
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
 * How much of a cell shows at `t`: 1 is the cell as drawn, 0 is the cell gone
 * to the terminal's ground. Read per cell, so cells can arrive or leave apart.
 */
export type Visibility = (cell: EffectCell, t: number) => number;

/**
 * A cell mixed toward the terminal's `ground` by how hidden it is: its fill
 * toward the ground, and its ink toward that fill, so an element with fills
 * of its own — a powerline strip — arrives and leaves whole, fill and words
 * together, never as bare coloured blocks. Invisible is ink and fill equal
 * to the ground. `swing` scales the hiding — 1 reaches fully invisible. A
 * cell wholly shown is returned as it was.
 */
export function veiled(visibility: Visibility, swing: number, ground: ColorRgba): Effect {
  const to = Oklch.fromRgba(ground);
  return (colors: CellColors, cell, t) => {
    const hidden = swing * (1 - visibility(cell, t));
    if (hidden === 0) return colors;
    const bg = blend(Oklch.fromRgba(colors.bg), to, hidden);
    return { fg: blend(Oklch.fromRgba(colors.fg), bg, hidden).toRgba(), bg: bg.toRgba() };
  };
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
    // The noise is read through slower noise, so the patches reach out in
    // curling tendrils rather than sitting as round blots.
    const place =
      places.get(at) ??
      clamp01(0.5 + 1.1 * fbm(cell.col * 0.09 + 1.4 * noise(cell.col * 0.035, cell.row * 0.2 + 2.6, z + 0.5), cell.row * 0.45, z, 3));
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
export function fadeIn(curve: Curve, start: number, z: number, ground: ColorRgba): Effect {
  const own = curve.seconds * OWN;
  const place = order(1.7 + z);
  return veiled((cell, t) => curve.ease(Phase.once(start + place(cell) * (curve.seconds - own), own)(t)), curve.swing, ground);
}

/**
 * Dissolve-out starting at `start`, as mist lifting: the element thins in
 * drifting patches, each cell fading smoothly over its own part of the
 * duration, until nothing is left at `start + seconds`.
 */
export function dissolveOut(curve: Curve, start: number, z: number, ground: ColorRgba): Effect {
  const own = curve.seconds * OWN;
  const place = order(4.2 + z);
  return veiled((cell, t) => 1 - curve.ease(Phase.once(start + place(cell) * (curve.seconds - own), own)(t)), curve.swing, ground);
}

/** The moment a transition starting at `start` has finished. */
export function settledAt(curve: Curve, start: number): number {
  return start + curve.seconds;
}
