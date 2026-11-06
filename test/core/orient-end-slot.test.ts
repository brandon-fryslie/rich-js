import { describe, expect, it } from "vitest";
import { reorder } from "../../src/core/orient.js";
import { Segment } from "../../src/core/segment.js";
import { caretMark, NULL_STYLE } from "../../src/core/style.js";

describe("the end slot past a row's text under visual order", () => {
  // U+0600 is a Prepend character: Intl.Segmenter joins it to whatever follows,
  // and the blank past the text is no character for it to join.
  it.each(["visual", "words"] as const)("keeps its caret after a Prepend character (%s)", (order) => {
    const end = NULL_STYLE.withCaret(caretMark("block")).asTextEnd;
    const line = [new Segment("١؀"), new Segment(" ", end)];
    const reordered = reorder(line, order);
    const shown = reordered.orient(reordered.line, 0, Segment.plainOf(line));
    const carets = shown.filter((segment) => segment.style?.caret !== undefined);
    expect(carets.map((segment) => segment.text)).toEqual([" "]);
  });
});
