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
  Animation,
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
  type Timing,
} from "../../src/index.js";

const WIDTH = 34;
const SKY = Array.from({ length: 4 }, (_, row) => (row === 1 ? "   a quiet night".padEnd(WIDTH - 4) : " ".repeat(WIDTH - 4))).join("\n");
const LINE = "the quick brown fox jumps";

/** A loop, or a transition made at its timing, played and a second's rest, again and again. */
type Shown = { readonly effect: GlyphEffect } | { readonly make: (timing: Timing) => GlyphTransition; readonly timing: Timing };

/**
 * What `shown` draws: a loop as it is, and a transition played again every
 * run of its seconds and a second's rest, so the frame says when it next
 * changes on the `Live`'s clock — and, at rest, that it changes when the next
 * run starts. Every turn is the one transition, set up once for what is drawn.
 */
function played(shown: Shown): GlyphEffect {
  if ("effect" in shown) return shown.effect;
  const { effect } = shown.make(shown.timing);
  return (drawn) => {
    const once = effect(drawn);
    return Animation.repeat(shown.timing.seconds + 1, () => once);
  };
}

const z = 0.4;
const SHOWN: readonly [string, string, Shown][] = [
  ["typewriter", LINE, { make: (timing) => GLYPH_EFFECT_CATALOGUE.transitions.typewriter({ z }, timing), timing: GLYPH_DEFAULTS.typewriter }],
  ["scramble", LINE, { make: (timing) => GLYPH_EFFECT_CATALOGUE.transitions.scramble({ z }, timing), timing: GLYPH_DEFAULTS.scramble }],
  ["backspace", LINE, { make: (timing) => GLYPH_EFFECT_CATALOGUE.transitions.backspace({ z }, timing), timing: GLYPH_DEFAULTS.backspace }],
  ["scramble out", LINE, { make: (timing) => GLYPH_EFFECT_CATALOGUE.transitions.scrambleOut({ z }, timing), timing: GLYPH_DEFAULTS.scrambleOut }],
  ["wave", LINE, { effect: GLYPH_EFFECT_CATALOGUE.loops.wave({ z }) }],
  ["rain", SKY, { effect: GLYPH_EFFECT_CATALOGUE.loops.rain({ z }) }],
  ["stars", SKY, { effect: GLYPH_EFFECT_CATALOGUE.loops.stars({ z }) }],
  ["typewriter, easing out", LINE, { make: typewriter, timing: { seconds: 3, ease: EASES["ease-out"] } }],
  ["scramble, slow", LINE, { make: (timing) => scramble(timing, z), timing: { seconds: 5, ease: EASES.linear } }],
  ["wave, wide and slow", LINE, { effect: caseWave({ step: 0.15, width: 6 }, z) }],
  ["snow", SKY, { effect: particles({ ...GLYPH_DEFAULTS.rain, glyphs: "*·", ascii: "*.", step: 0.4, density: 0.05 }, z) }],
];

const PANELS = SHOWN.map(([title, text, shown]) => [title, new RichText(text), played(shown)] as const);

function view(t: number): Columns {
  return new Columns(PANELS.map(([title, text, effect]) => new Panel(new GlyphEffected(text, effect, { t, key: title }), { title, width: WIDTH })));
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
