/**
 * effects-feel — the effect curves under judgement.
 *
 * THIS IS A DEMO. It exists so the feel of each effect is agreed before any
 * curve lands in `src/`; the project learns from its mistakes rather than
 * building on it. What survives the sign-off is promoted to `src/` and this
 * file is not its starting point — the sign-off notes are.
 *
 * Every curve is an `Effect` from `src/renderables/effect.ts`, built from the
 * `Phase` and `Ease` vocabulary in `src/core/easing.ts`: how far a move has
 * gone is `ease(phase(t + offset))`, and the move is a colour transform in
 * OKLCH, where equal steps look equal.
 *
 * [LAW:one-type-per-behavior] Pulse, sparkle and drift are one curve — a
 * `ThemeKey` scaled by progress — differing in the per-cell offset and in which
 * axis the key moves. Fade-in and dissolve-out are one curve — the ink mixed
 * toward the ground by a visibility — differing in how visibility is read off
 * time. Shimmer is its own: a mix toward a highlight, weighted by a band.
 *
 * [LAW:no-ambient-temporal-coupling] No curve reads a clock; `t` is the
 * effect's argument, so the frame owner decides when to sample.
 */

import {
  Oklch,
  Phase,
  type CellColors,
  type ColorRgba,
  type Ease,
  type Effect,
  type EffectCell,
  type ThemeKey,
} from "../../src/index.js";

/** A move of one colour: the colour, the cell, the time, to the new colour. */
export type ColorMove = (color: ColorRgba, cell: EffectCell, t: number) => ColorRgba;

/**
 * A one-colour move as an `Effect` on a subject's own colours, by hex,
 * wherever a cell shows them. A powerline strip's fill is the ground of its
 * cells and the ink of the seam glyphs between them, so the arrow moves with
 * the cell it points out of; the terminal ground behind its caps is no colour
 * of the strip's, and stays put.
 */
export function onColors(colors: ReadonlySet<string>, move: ColorMove): Effect {
  const moved = (color: ColorRgba, cell: EffectCell, t: number): ColorRgba =>
    colors.has(color.hex) ? move(color, cell, t) : color;
  return ({ fg, bg }, cell, t) => ({ fg: moved(fg, cell, t), bg: moved(bg, cell, t) });
}

/** How the curves below are tuned: one period (or duration), ease and swing. */
export interface Curve {
  /** Seconds: a looping effect's period, a transition's duration. */
  readonly seconds: number;
  readonly ease: Ease;
  /** How far the move goes at full progress; its unit is the effect's. */
  readonly swing: number;
}

const ZERO_KEY: ThemeKey = { hueShift: 0, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 };

/**
 * A `ThemeKey` whose size follows progress — `key(1)` at the peak — with each
 * cell's progress shifted in time by `offset(cell)` seconds. At progress 0
 * the key is the identity, and an sRGB colour survives the trip through OKLCH
 * unchanged, so the curve's rest is the untouched cell, byte for byte.
 */
function keyed(curve: Curve, key: (amount: number) => ThemeKey, offset: (cell: EffectCell) => number): ColorMove {
  const phase = Phase.pingPong(curve.seconds);
  return (color, cell, t) => Oklch.fromRgba(color).applyKey(key(curve.ease(phase(t + offset(cell))))).toRgba();
}

/**
 * Lightness away from the ground: up on a dark ground, down on a light one,
 * so the moving colour gains contrast with what is behind it.
 */
function lighten(swing: number, darkGround: boolean): (amount: number) => ThemeKey {
  const toward = darkGround ? 1 : -1;
  return (amount) => ({ ...ZERO_KEY, lightnessShift: toward * swing * amount });
}

/** Swing: OKLCH lightness at the peak, 0–1. The whole element breathes together. */
export function pulse(curve: Curve, darkGround: boolean): ColorMove {
  return keyed(curve, lighten(curve.swing, darkGround), () => 0);
}

/** Swing: OKLCH lightness at the peak, 0–1. Each cell breathes on its own clock. */
export function sparkle(curve: Curve, darkGround: boolean): ColorMove {
  return keyed(curve, lighten(curve.swing, darkGround), (cell) => cell.seed * curve.seconds);
}

/**
 * Swing: degrees of hue at the peak. The shift travels along the row, one
 * period from the first column to column `span`.
 */
export function drift(curve: Curve, span: number): ColorMove {
  return keyed(
    curve,
    (amount) => ({ ...ZERO_KEY, hueShift: curve.swing * amount }),
    (cell) => (cell.col / span) * curve.seconds,
  );
}

/**
 * Swing: how far toward `highlight` the band's centre goes, 0–1. A band
 * `width` columns wide crosses columns 0 to `span` once a period, entering
 * and leaving fully off the row so the sweep has a rest between passes.
 */
export function shimmer(curve: Curve, span: number, width: number, highlight: ColorRgba): ColorMove {
  const phase = Phase.loop(curve.seconds);
  const toward = Oklch.fromRgba(highlight);
  return (color, cell, t) => {
    const centre = phase(t) * (span + 2 * width) - width;
    const nearness = Math.max(0, 1 - Math.abs(cell.col - centre) / width);
    return Oklch.fromRgba(color).mix(toward, curve.swing * curve.ease(nearness)).toRgba();
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
    fg: Oklch.fromRgba(colors.fg).mix(Oklch.fromRgba(colors.bg), swing * (1 - visibility(cell, t))).toRgba(),
    bg: colors.bg,
  });
}

/** Of a transition's `seconds`, how much each cell's start may lag by its seed. */
const FADE_SPREAD = 0.5;

/**
 * Fade-in starting at `start`: each cell rises over the first half of the
 * duration, its start lagged by up to the other half by its seed, so the
 * element arrives with per-cell variation and is whole at `start + seconds`.
 */
export function fadeIn(curve: Curve, start: number): Effect {
  const rise = curve.seconds * (1 - FADE_SPREAD);
  return veiled((cell, t) => {
    const lag = cell.seed * curve.seconds * FADE_SPREAD;
    return curve.ease(Phase.once(start + lag, rise)(t));
  }, curve.swing);
}

/**
 * Dissolve-out starting at `start`: each cell vanishes at once at its own
 * seeded moment. `ease` shapes how many have gone by when — eased progress
 * past a cell's seed hides it — and every cell is gone at `start + seconds`.
 */
export function dissolveOut(curve: Curve, start: number): Effect {
  const phase = Phase.once(start, curve.seconds);
  return veiled((cell, t) => (curve.ease(phase(t)) > cell.seed ? 0 : 1), curve.swing);
}

/** The moment a transition starting at `start` has finished. */
export function settledAt(curve: Curve, start: number): number {
  return start + curve.seconds;
}
