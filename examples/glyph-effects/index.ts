/**
 * glyph-effects — every glyph effect in the catalogue, and a few made by
 * hand from the same four functions, playing in a `Live` for twenty seconds.
 * The transitions start over a second after they settle.
 *
 * THIS IS A DEMO: the library's glyph effects
 * (`src/renderables/glyph-effects.ts`), for seeing them move. Each panel's
 * content is wrapped in a `GlyphEffected` drawn at the `Live`'s time, so
 * what it shows at a `t` is the same at any frame rate.
 */

import {
  Columns,
  EASES,
  GLYPH_DEFAULTS,
  GLYPH_EFFECT_CATALOGUE,
  GlyphEffected,
  Live,
  Panel,
  RichText,
  caseWave,
  particles,
  scramble,
  typewriter,
  type GlyphEffect,
  type GlyphTransition,
} from "../../src/index.js";

const WIDTH = 34;
const SKY = Array.from({ length: 4 }, (_, row) => (row === 1 ? "   a quiet night".padEnd(WIDTH - 4) : " ".repeat(WIDTH - 4))).join("\n");
const LINE = "the quick brown fox jumps";

/** A loop drawn at `t`, or a transition drawn at `t` within its run and a second's rest, again and again. */
type Shown = { readonly effect: GlyphEffect } | { readonly transition: GlyphTransition; readonly seconds: number };

function at(shown: Shown, t: number): { effect: GlyphEffect; t: number } {
  return "effect" in shown ? { effect: shown.effect, t } : { effect: shown.transition.effect, t: t % (shown.seconds + 1) };
}

const z = 0.4;
const PANELS: readonly [string, string, Shown][] = [
  ["typewriter", LINE, { transition: GLYPH_EFFECT_CATALOGUE.transitions.typewriter({ z }), seconds: GLYPH_DEFAULTS.typewriter.seconds }],
  ["scramble", LINE, { transition: GLYPH_EFFECT_CATALOGUE.transitions.scramble({ z }), seconds: GLYPH_DEFAULTS.scramble.seconds }],
  ["wave", LINE, { effect: GLYPH_EFFECT_CATALOGUE.loops.wave({ z }) }],
  ["rain", SKY, { effect: GLYPH_EFFECT_CATALOGUE.loops.rain({ z }) }],
  ["stars", SKY, { effect: GLYPH_EFFECT_CATALOGUE.loops.stars({ z }) }],
  ["typewriter, easing out", LINE, { transition: typewriter({ seconds: 3, ease: EASES["ease-out"] }), seconds: 3 }],
  ["scramble, slow", LINE, { transition: scramble({ seconds: 5, ease: EASES.linear }, z), seconds: 5 }],
  ["wave, wide and slow", LINE, { effect: caseWave({ step: 0.15, width: 6 }) }],
  ["snow", SKY, { effect: particles({ ...GLYPH_DEFAULTS.rain, glyphs: "*·", ascii: "*.", step: 0.4, density: 0.05 }, z) }],
];

function view(t: number): Columns {
  return new Columns(
    PANELS.map(([title, text, shown]) => {
      const drawn = at(shown, t);
      return new Panel(new GlyphEffected(new RichText(text), drawn.effect, { t: drawn.t, key: title }), { title, width: WIDTH });
    }),
  );
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
