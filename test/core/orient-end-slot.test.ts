import { describe, expect, it } from "vitest";
import { reorder } from "../../src/core/orient.js";
import { Segment } from "../../src/core/segment.js";
import { caretMark, NULL_STYLE, Style } from "../../src/core/style.js";

/** The text of each end-slot segment `line` shows under visual order. */
function endSlots(line: Segment[]): string[] {
  const reordered = reorder(line, "visual");
  const shown = reordered.orient(reordered.line, 0, Segment.plainOf(line));
  return shown.filter((segment) => segment.style?.textEnd === true).map((segment) => segment.text);
}

describe("the end slot past a row's text under visual order", () => {
  // A Prepend character joins whatever follows it in Intl.Segmenter's clusters,
  // and the blank past the text is no character for it to join.
  it.each([
    ["Arabic number sign U+0600", "١؀"],
    ["Syriac abbreviation mark U+070F", "ܐ܏"],
  ])("keeps its own cell after a Prepend character: %s", (_name, text) => {
    const caret = NULL_STYLE.withCaret(caretMark("block")).asTextEnd;
    const drawn = Style.parse("reverse").asTextEnd;
    expect(endSlots([new Segment(text), new Segment(" ", caret)])).toEqual([" "]);
    expect(endSlots([new Segment(text), new Segment(" ", drawn)])).toEqual([" "]);
  });

  it("keeps a glyph outside the BMP whole", () => {
    const end = NULL_STYLE.withCaret(caretMark("block")).asTextEnd;
    expect(endSlots([new Segment("א؀"), new Segment("😀", end)])).toEqual(["😀"]);
  });
});
