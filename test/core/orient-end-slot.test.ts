import { describe, expect, it } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import { reorder } from "../../src/core/orient.js";
import { sealed } from "../../src/core/seal.js";
import { Segment } from "../../src/core/segment.js";
import { caretMark, NULL_STYLE, Style } from "../../src/core/style.js";

const CARET = NULL_STYLE.withCaret(caretMark("block")).asTextEnd;
const DRAWN = Style.parse("reverse").asTextEnd;

/**
 * The end-slot cells `line` reaches the wire as, each with whether it still
 * carries the caret. Under `words` a cell's glyph is written where kitty's
 * reversal will move it from, so the cell, not its text, is what holds.
 */
function endSlots(line: Segment[], order: "visual" | "words"): [number, boolean][] {
  const reordered = reorder(line, order);
  const shown = reordered.orient(reordered.line, 0, Segment.plainOf(line));
  return [...sealed(shown, order)]
    .filter((segment) => segment.style?.textEnd === true)
    .map((segment) => [cellLen(segment.text), segment.style?.caret !== undefined]);
}

// Syriac under `words` is the expected failure below.
const PREPENDS: [string, string, readonly string[]][] = [
  ["Arabic number sign U+0600", "\u0661\u0600", ["visual", "words"]],
  ["Syriac abbreviation mark U+070F", "\u0710\u070F", ["visual"]],
];

// A Prepend character joins whatever follows it in Intl.Segmenter's clusters,
// and the end slot past the text is no character for it to join.
describe.each(["visual", "words"] as const)("the end slot past a row's text under %s order", (order) => {
  it.each(PREPENDS.filter(([, , orders]) => orders.includes(order)))("keeps its own cell after a Prepend character: %s", (_name, text, _orders) => {
    expect(endSlots([new Segment(text), new Segment(" ", CARET)], order)).toEqual([[1, true]]);
    expect(endSlots([new Segment(text), new Segment("|", CARET)], order)).toEqual([[1, true]]);
    expect(endSlots([new Segment(text), new Segment("|", DRAWN)], order)).toEqual([[1, false]]);
  });
});

// U+070F before a Syriac letter is a cluster two cells wide under `words`, which
// kitty's run reversal styles as one; this goes green with rich-control-codes-xh4n.qmw.
it.fails("keeps its own cell after U+070F under words order", () => {
  expect(endSlots([new Segment("\u0710\u070F"), new Segment("|", CARET)], "words")).toEqual([[1, true]]);
});

it("keeps an end-slot glyph outside the BMP whole", () => {
  const line = [new Segment("\u05D0\u0600"), new Segment("😀", CARET)];
  const reordered = reorder(line, "visual");
  const shown = reordered.orient(reordered.line, 0, Segment.plainOf(line));
  expect(shown.filter((segment) => segment.style?.textEnd === true).map((segment) => segment.text)).toEqual(["😀"]);
});
