/**
 * The glyph effect catalogue: a typewriter and a scramble, which run once and
 * are done, and a wave of case changes, rain and stars, which loop for as
 * long as they are drawn. Each is a `GlyphEffect` for `GlyphEffected`
 * (`./glyph-effect.ts`), built as the colour catalogue's are
 * (`./effects.ts`): one function each over the one shape, made by name, one
 * way, at the defaults in `GLYPH_DEFAULTS` (`GLYPH_EFFECT_CATALOGUE`).
 *
 * Where a colour loop glides, a glyph cannot: a cell shows one glyph or
 * another, so every loop here moves in steps, on a `beat`, and says when its
 * next step is. The two transitions are `Transition`s by the one rule the
 * colour transitions follow (`transition`): they move every frame until
 * their seconds are up, and never after.
 *
 * [LAW:no-ambient-temporal-coupling] No effect reads a clock, and what a cell
 * shows at `t` is worked out from `t` alone, so a draw costs the same at
 * `t = 0` and `t = 10⁶`, and a host drawing once a second and one drawing
 * sixty times show the same cell at every `t` they share. What is random is
 * `hash` (`../core/noise.ts`) of where a cell is and which step it is in.
 */

import { Animation } from "../core/animation.js";
import { cellLen, graphemes } from "../core/cells.js";
import { EASES, Phase, beat, positiveSeconds, settled, type Timing } from "../core/easing.js";
import { hash } from "../core/noise.js";
import { drawable, isAscii } from "../core/protocol.js";
import { inked } from "./effect.js";
import { requireZ, transition, type EffectTarget, type Transition } from "./effects.js";
import type { DrawnGlyphs, GlyphCell, GlyphEffect, GlyphFrame } from "./glyph-effect.js";

/** A glyph effect that runs once, and says when it is done. */
export type GlyphTransition = Transition<GlyphEffect>;

/** `glyph` as blank: as many spaces as it is cells wide. */
function blank(glyph: string): string {
  return " ".repeat(cellLen(glyph));
}

/**
 * The text among `cells`: each row from its first inked glyph to its last,
 * the blanks between words in it and the margins round it not, as a
 * typewriter types and not as a renderable pads. A glyph no cell wide — a
 * byte-order mark, a mark a child split from its letter — takes no time and
 * is no place in it. Each cell's place, in reading order, by `index`, and
 * how many places there are.
 */
function text(cells: readonly GlyphCell[]): { readonly length: number; readonly place: ReadonlyMap<number, number> } {
  const ends = new Map<number, { first: number; last: number }>();
  for (const cell of cells.filter((c) => inked(c.glyph))) ends.set(cell.row, { first: ends.get(cell.row)?.first ?? cell.index, last: cell.index });
  const place = new Map<number, number>();
  for (const cell of cells) {
    const row = ends.get(cell.row);
    if (row !== undefined && cell.index >= row.first && cell.index <= row.last && cellLen(cell.glyph) > 0) place.set(cell.index, place.size);
  }
  return { length: place.size, place };
}

/** Of `n` cells, how many have arrived at eased progress `p`, an ease that overshoots held to the cells there are. */
function arrived(n: number, p: number): number {
  return Math.min(n, Math.max(0, Math.floor(n * p)));
}

/**
 * Steps of `seconds`, counted from 0 on the animation's own clock: for a
 * `frame` of each step, the animation holding it through the step and
 * changing at its end, and reduced, `still`. [LAW:one-source-of-truth] The step and its two ends
 * are a `beat`'s, the one timing vocabulary, so a step boundary is the moment
 * the change shows. The beat is made once, for every frame drawn on it.
 */
function stepped(seconds: number): <F>(frame: (step: number) => F, still: F) => Animation<F> {
  const pace = beat([seconds]);
  return (frame, still) => ({
    at: (t) => frame(Math.round(pace.lastChange(t) / seconds)),
    nextChange: (t) => pace.nextChange(t),
    lastChange: (t) => pace.lastChange(t),
    reduced: () => Animation.constant(still),
  });
}

/** Every cell its own glyph: a glyph loop with its motion taken out — the text as written, no wave, no rain. */
const AS_WRITTEN: GlyphFrame = (cell) => cell.glyph;

/**
 * A typewriter: the element's text blank until it is typed, in reading
 * order, the last cell at `timing.seconds`. The ease shapes the pace, so
 * `ease-out` types fast and slows to the end. The spaces between words are
 * typed too, as a typewriter's are; the margins a renderable pads its text
 * with are not text, so no second is spent on them.
 */
export function typewriter(timing: Timing): GlyphTransition {
  const phase = Phase.once(0, timing.seconds);
  // Settled, so the last cell is typed at the seconds whatever ease was handed.
  const ease = settled(timing.ease);
  return transition(timing.seconds, ({ cells }: DrawnGlyphs) => {
    const { length, place } = text(cells);
    return Animation.continuous((t): GlyphFrame => {
      const typed = arrived(length, ease(phase(t)));
      // A margin has no place, and is blank already.
      return (cell) => ((place.get(cell.index) ?? -1) < typed ? cell.glyph : blank(cell.glyph));
    });
  });
}

/** What a scrambled cell shows: one-cell glyphs, none that reads as a blank. */
const SCRAMBLE_GLYPHS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+<=>?@"];

/** How long a scrambled glyph holds before the next, in seconds. */
const FLICKER = 1 / 15;

/**
 * A scramble that resolves: a cell of the element's text shows glyphs drawn
 * at random, a new one each flicker, until it resolves to its own, in reading
 * order, the last at `timing.seconds`. A wide glyph scrambles as two one-cell
 * glyphs. A blank stays blank, so the words keep their shape while their
 * letters churn.
 */
export function scramble(timing: Timing, z: number): GlyphTransition {
  requireZ("scramble", z);
  const phase = Phase.once(0, timing.seconds);
  // Settled, so the last cell resolves at the seconds whatever ease was handed.
  const ease = settled(timing.ease);
  const flicker = stepped(FLICKER)((step) => step, 0);
  return transition(timing.seconds, ({ cells }: DrawnGlyphs) => {
    const { length, place } = text(cells);
    return Animation.continuous((t): GlyphFrame => {
      const resolved = arrived(length, ease(phase(t)));
      const step = flicker.at(t);
      return (cell) => {
        if (!inked(cell.glyph) || (place.get(cell.index) ?? -1) < resolved) return cell.glyph;
        const pick = (i: number): string => SCRAMBLE_GLYPHS[Math.floor(hash(cell.seed * 7919 + i, z + step * 0.618) * SCRAMBLE_GLYPHS.length)]!;
        return Array.from({ length: cellLen(cell.glyph) }, (_, i) => pick(i)).join("");
      };
    });
  });
}

/** How a case wave moves: a step, in seconds, for the band to move one column, and how many columns wide it is. */
export interface CaseWave {
  readonly step: number;
  readonly width: number;
}

/**
 * `glyph` with its case swapped, or as it is if the swap would change how
 * wide it is (`ß` upper-cases to `SS`), since a cell never changes width.
 */
function swapCase(glyph: string): string {
  const swapped = [...glyph].map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join("");
  return cellLen(swapped) === cellLen(glyph) ? swapped : glyph;
}

/**
 * A wave of case changes: a band `width` columns wide crosses the element
 * left to right, one column a `step`, and every cell inside it shows its
 * glyph's case swapped. It starts again once it has left the last column,
 * so a pass takes the element's columns and the band's, a step each. `z`
 * sets how far into its pass the band is at `t = 0`.
 */
export function caseWave({ step, width }: CaseWave, z: number): GlyphEffect {
  positiveSeconds("caseWave step", step);
  if (!(Number.isInteger(width) && width > 0)) throw new RangeError(`caseWave width must be a positive whole number of columns, got ${width}`);
  requireZ("caseWave", z);
  const steps = stepped(step);
  return ({ cells }) => {
    const columns = cells.reduce((most, cell) => Math.max(most, cell.col + cellLen(cell.glyph)), 0);
    const span = columns + width;
    const start = Math.floor(hash(z, 2.3) * span);
    return steps((s): GlyphFrame => {
      // The column just past the band's right edge; it enters at the left.
      const lead = (((s + start) % span) + span) % span;
      // A wide glyph is in the band if any of its columns is.
      return (cell) => (cell.col < lead && cell.col + cellLen(cell.glyph) > lead - width ? swapCase(cell.glyph) : cell.glyph);
    }, AS_WRITTEN);
  };
}

/** Particles over the blank cells of an element: what they look like, how many, and how they move. */
export interface Particles {
  /** The glyphs a particle may be, each one cell wide. */
  readonly glyphs: string;
  /** What it may be on an output that draws ASCII alone, each one cell wide. */
  readonly ascii: string;
  /** The share of blank cells holding a particle at any step, in [0, 1]. */
  readonly density: number;
  /** How long a step holds, in seconds. */
  readonly step: number;
  /** How many rows every particle falls each step, a whole number, since a glyph moves a cell at a time; 0 holds them where they are. */
  readonly drift: number;
  /** How many steps a particle lasts before the field is drawn afresh; `Infinity`, never. */
  readonly life: number;
}

/**
 * Particles on the element's blank cells: rain falling, stars coming and
 * going. A particle is never drawn over a glyph, so it passes behind the
 * words. Which cells hold one is `hash` of the cell's column, where it was at
 * the step's start (its row less what the field has fallen) and which life
 * of the field this is, so a field that falls carries each particle down a
 * row a step, and one that holds still draws a fresh field each life.
 */
export function particles(spec: Particles, z: number): GlyphEffect {
  const oneCell = (set: string): string[] => {
    const glyphs = graphemes(set);
    if (glyphs.length === 0 || glyphs.some((glyph) => cellLen(glyph) !== 1)) throw new RangeError(`particles needs one-cell glyphs, got ${JSON.stringify(set)}`);
    return glyphs;
  };
  const [glyphs, ascii] = [oneCell(spec.glyphs), oneCell(spec.ascii)];
  if (!isAscii(spec.ascii)) throw new RangeError(`particles ascii must be ASCII, got ${JSON.stringify(spec.ascii)}`);
  if (!(spec.density >= 0 && spec.density <= 1)) throw new RangeError(`particles density must be in [0, 1], got ${spec.density}`);
  if (!Number.isInteger(spec.drift)) throw new RangeError(`particles drift must be a whole number of rows, got ${spec.drift}`);
  if (!(spec.life > 0)) throw new RangeError(`particles life must be a positive number of steps, got ${spec.life}`);
  positiveSeconds("particles step", spec.step);
  requireZ("particles", z);
  const steps = stepped(spec.step);
  return ({ asciiOnly }) => {
    const drawn = drawable({ asciiOnly }, glyphs, ascii, (set) => set.join(""));
    return steps((s): GlyphFrame => {
      const life = Number.isFinite(spec.life) ? Math.floor(s / spec.life) : 0;
      const fallen = spec.drift * s;
      return (cell) => {
        // A particle takes a blank cell, never ink, nor a glyph no cell wide.
        if (inked(cell.glyph) || cellLen(cell.glyph) === 0) return cell.glyph;
        const from = cell.row - fallen;
        const field = z + 1.37 * cell.col + 0.71 * life;
        // A particle is one cell; a wide blank keeps the rest of its width blank.
        return hash(from, field) < spec.density ? drawn[Math.floor(hash(from, field + 3.1) * drawn.length)]! + blank(cell.glyph).slice(1) : cell.glyph;
      };
    }, AS_WRITTEN);
  };
}

/** The names of the glyph effects that loop. */
export type GlyphLoopName = "wave" | "rain" | "stars";

/** The names of the glyph effects that run once. */
export type GlyphTransitionName = "typewriter" | "scramble";

/** Each catalogue glyph effect's defaults, as first drawn in `examples/glyph-effects`. */
export const GLYPH_DEFAULTS = {
  typewriter: { seconds: 2, ease: EASES.linear },
  scramble: { seconds: 2.5, ease: EASES["ease-in"] },
  wave: { step: 0.06, width: 3 },
  rain: { glyphs: "│╎", ascii: "|:", density: 0.06, step: 0.08, drift: 1, life: Number.POSITIVE_INFINITY },
  stars: { glyphs: "·+*", ascii: ".+*", density: 0.04, step: 1.5, drift: 0, life: 1 },
} as const satisfies { readonly [K in GlyphTransitionName]: Timing } & { readonly wave: CaseWave; readonly rain: Particles; readonly stars: Particles };

/**
 * Every glyph effect in the catalogue by name, each made the one way: for an
 * element, at `z` in the noise so two elements under one effect do not move
 * in lockstep, at its defaults. A transition takes another timing in place
 * of its own. [LAW:types-are-the-program] Keyed by the two name types, as
 * `EFFECT_CATALOGUE` is, so a picker walking a section's names offers an
 * effect added here with no change of its own.
 */
export const GLYPH_EFFECT_CATALOGUE: {
  readonly loops: Readonly<Record<GlyphLoopName, (element: EffectTarget) => GlyphEffect>>;
  readonly transitions: Readonly<Record<GlyphTransitionName, (element: EffectTarget, timing?: Timing) => GlyphTransition>>;
} = {
  loops: {
    wave: (element) => caseWave(GLYPH_DEFAULTS.wave, element.z),
    rain: (element) => particles(GLYPH_DEFAULTS.rain, element.z),
    stars: (element) => particles(GLYPH_DEFAULTS.stars, element.z),
  },
  transitions: {
    typewriter: (_element, timing = GLYPH_DEFAULTS.typewriter) => typewriter(timing),
    scramble: (element, timing = GLYPH_DEFAULTS.scramble) => scramble(timing, element.z),
  },
};
