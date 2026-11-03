/**
 * Glyph effects: what a cell shows changes, not only how it looks.
 *
 * Two idioms. A glyph effect over an element — `new GlyphEffected(element,
 * effect, { key })` — moves the element's characters in place: ants marching
 * round a border, a wave of capitals, rain. A lifecycle — `lifecycle(element,
 * { enter, exit, key }, enteredAt).leave(at)` — is an element arriving through
 * one effect and leaving through another, drawing nothing once it is gone.
 */
import {
  EASES,
  GLYPH_DEFAULTS,
  GlyphEffected,
  RichText,
  Table,
  Animation,
  backspace,
  caseWave,
  cyclic,
  lifecycle,
  marchingAnts,
  particles,
  scramble,
  scrambleOut,
  throughGlyphs,
  typewriter,
  type Renderable,
} from "@promptctl/rich-js";
import { MUTED, SLOT, TEXT, kind, panel, type Kind } from "./look.js";

// Each line leaves so it is gone just as its turn ends, and gone, a lifecycle
// draws no rows. Reduced, it cuts away at `leave`, so each sits behind a
// prompt that keeps its row, and the panel does not fold shut until the next turn.
const PROMPT = new RichText("›", { style: MUTED });
const prompted = (line: Renderable): Table => {
  const grid = Table.grid({ padding: [0, 1, 0, 0] });
  grid.addColumn();
  grid.addColumn();
  grid.addRow(PROMPT, line);
  return grid;
};

const typing = Animation.repeat(
  5,
  cyclic([
    lifecycle(
      new RichText("typed one cell at a time", { style: TEXT }),
      { enter: throughGlyphs(typewriter(GLYPH_DEFAULTS.typewriter)), exit: throughGlyphs(backspace({ seconds: 1, ease: EASES.linear })), key: "typed" },
      0,
    ).leave(4),
  ]),
);

// A different noise each of four turns, so a replay is not the last one again.
const SCRAMBLED = new RichText("resolving out of noise", { style: TEXT });
const scrambling = Animation.repeat(
  6,
  cyclic(
    [0, 1, 2, 3].map((seed) =>
      lifecycle(
        SCRAMBLED,
        { enter: throughGlyphs(scramble(GLYPH_DEFAULTS.scramble, seed)), exit: throughGlyphs(scrambleOut({ seconds: 1.2, ease: EASES["ease-out"] }, seed)), key: `scrambled ${seed}` },
        0,
      ).leave(4.8),
    ),
  ),
);

const MARCHING = "marching border";

export const GLYPHS: readonly Kind[] = [
  { name: MARCHING, view: new GlyphEffected(panel(MARCHING)(new RichText("the ants march round", { style: TEXT })), marchingAnts(GLYPH_DEFAULTS.march), { key: "march" }) },
  kind("typewriter", Animation.map(typing, prompted)),
  kind("scramble", Animation.map(scrambling, prompted)),
  kind("case wave", new GlyphEffected(new RichText("a wave of capitals crosses", { style: TEXT }), caseWave({ step: 0.12, width: 3 }, 0), { key: "wave" })),
  kind("rain on a blank panel", new GlyphEffected(new RichText(" ".repeat(SLOT)), particles(GLYPH_DEFAULTS.rain, 1), { key: "rain" })),
];
