import { CellJoiner, type JoinShape, type Paint } from "../../src/core/strip.js";

const LEFT_BG: Paint = { edge: "left", part: "bg" };
const RIGHT_BG: Paint = { edge: "right", part: "bg" };

/**
 * A powerline joiner drawn in ASCII glyphs the tests can read back: the arrow,
 * the divider, a lead in reverse video and a tail, `""` leaving an end flat.
 */
export function arrows({ seam = ">", divider = "|", lead = "<", tail = ">" } = {}): CellJoiner {
  const shape: JoinShape = {
    seam: [{ glyph: seam, fg: LEFT_BG, bg: RIGHT_BG }],
    divider: [{ glyph: divider, fg: { edge: "left", part: "fg" }, bg: LEFT_BG }],
    lead: lead === "" ? [] : [{ glyph: lead, fg: "ground", bg: RIGHT_BG }],
    tail: tail === "" ? [] : [{ glyph: tail, fg: LEFT_BG, bg: "ground" }],
  };
  return new CellJoiner(shape, shape);
}
