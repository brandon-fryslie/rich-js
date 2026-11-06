import { describe, expect, it } from "vitest";
import { cellLen, graphemes } from "../../src/core/cells.js";
import { reorder } from "../../src/core/orient.js";
import { sealed } from "../../src/core/seal.js";
import { ControlType, Segment } from "../../src/core/segment.js";
import { caretMark, NULL_STYLE, Style } from "../../src/core/style.js";
import type { TextOrder } from "../../src/core/text-order.js";

const CARET = NULL_STYLE.withCaret(caretMark("block")).asTextEnd;
const BOLD = Style.parse("bold");
const WORD_JOINER = "\u2060";
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** `line` as `sealed` writes it for `order`: the segments that reach the wire. */
function wire(line: Segment[], order: TextOrder): Segment[] {
  const reordered = reorder(line, order);
  return [...sealed(reordered.orient(reordered.line, 0, Segment.plainOf(line)), order)];
}

/**
 * The cells a terminal that clusters what it is sent (kitty, WezTerm, Ghostty)
 * gives `bytes`: one per segmenter cluster, a zero-width one aside.
 */
const terminalCells = (bytes: string): string[] =>
  Array.from(SEGMENTER.segment(bytes), ({ segment }) => segment).filter((cluster) => cellLen(cluster) > 0);

const text = (segments: Segment[]): string => segments.map((segment) => segment.text).join("");

// A Prepend character (UAX #29 GB9b) joins whatever follows it in a segmenter's
// clusters, and in a clustering terminal's; the library gives it a cell of its
// own, as Rich's width does.
describe("a Prepend character's cluster ends at itself", () => {
  it("is a cluster of its own, before a letter, a blank or a digit", () => {
    expect(graphemes("؀١")).toEqual(["؀", "١"]);
    expect(graphemes("؀ ")).toEqual(["؀", " "]);
    expect(graphemes("܏ܐ")).toEqual(["܏", "ܐ"]);
    expect(graphemes("ൎക")).toEqual(["ൎ", "ക"]);
  });

  const lines: [string, Segment[], TextOrder][] = [
    ["before the caret's end slot, under visual", [new Segment("א؀"), new Segment("|", CARET)], "visual"],
    ["before the caret's end slot, under logical", [new Segment("א؀"), new Segment("|", CARET)], "logical"],
    ["before the caret's end slot after a left-to-right letter, under logical", [new Segment("a؀"), new Segment("|", CARET)], "logical"],
    ["before a blank end slot, under logical", [new Segment("a؀"), new Segment(" ", CARET)], "logical"],
    ["before a letter styled apart, under visual", [new Segment("א؀"), new Segment("b", BOLD)], "visual"],
    ["before a blank in its own text, under visual", [new Segment("א؀ b")], "visual"],
    ["before a Syriac letter, under words", [new Segment("ܐ܏"), new Segment("|", CARET)], "words"],
    ["before a digit it numbers", [new Segment("؀١٢")], "plain"],
  ];

  it.each(lines)("takes the cell the library measured on a clustering terminal: %s", (_name, line, order) => {
    const written = wire(line, order);
    expect(terminalCells(text(written)).length).toBe(cellLen(text(line)));
  });

  it("writes a word joiner in the Prepend's own segment, not the caret's", () => {
    // The isolate `sealed` writes around a logical row is first and last.
    const written = wire([new Segment("a؀"), new Segment("|", CARET)], "logical").slice(1, -1);
    expect(written.map((segment) => segment.text)).toEqual([`a؀${WORD_JOINER}`, "|"]);
    expect(written[1]!.style?.caret).toBeDefined();
  });

  it("ends a Prepend that ends a write, since the next write may continue the line", () => {
    expect(text(wire([new Segment("a؀")], "plain"))).toBe(`a؀${WORD_JOINER}`);
  });

  it("keeps a Prepend one cluster with the marks on it, which are one cell to Rich too", () => {
    expect(graphemes("؀́a")).toEqual(["؀́", "a"]);
    expect(text(wire([new Segment("؀́a")], "plain"))).toBe("؀́a");
  });

  it("leaves a neighbour's style on the neighbour's cell", () => {
    const written = wire([new Segment("א؀"), new Segment("b", BOLD)], "visual");
    const bold = written.filter((segment) => segment.style?.bold === true).map((segment) => segment.text.replace(WORD_JOINER, ""));
    expect(bold).toEqual(["b"]);
  });

  // UAX #9 resolves the blank as whitespace (W, then N1/N2), not as the
  // Arabic number the Prepend before it is, so the word lands on its left.
  it.each(["visual", "words"] as const)("leaves the blank after it its own bidi level under %s", (order) => {
    const reordered = reorder([new Segment("א؀ b")], order);
    expect(text(reordered.orient(reordered.line, 0, "א؀ b"))).toBe("b ؀א");
  });

  it("ends a Prepend before a halfwidth sound mark, which takes a cell of its own", () => {
    expect(graphemes("؀ﾞ")).toEqual(["؀", "ﾞ"]);
    expect(terminalCells(text(wire([new Segment("؀ﾞ")], "plain"))).length).toBe(cellLen("؀ﾞ"));
  });

  it("ends a Prepend before a control that leaves the cursor in place", () => {
    const written = text([...sealed([new Segment("a؀"), new Segment("", undefined, [[ControlType.HIDE_CURSOR]]), new Segment("b")], "plain")]);
    expect(written.startsWith(`a؀${WORD_JOINER}`)).toBe(true);
  });

  it("keeps a mark opening the next segment, which joins it as one cell", () => {
    expect(text(wire([new Segment("a؀"), new Segment("́b")], "plain"))).toBe("a؀́b");
  });
});

// The end slot is a blank no character holds, so nothing in the text — an
// extender a neighbour opens with, a trailing ZWJ — joins it in ordering.
describe("the caret's end slot stays its own cluster", () => {
  it("leaves a neighbour's opening mark in the neighbour's segment under visual", () => {
    const written = wire([new Segment("א"), new Segment(" ", CARET), new Segment("́x", BOLD)], "visual");
    expect(written.filter((segment) => segment.style?.caret !== undefined).map((segment) => segment.text)).toEqual([" "]);
  });

  it("keeps an emoji caret glyph apart from a ZWJ the text ends with", () => {
    const written = wire([new Segment("א👨‍"), new Segment("😀", CARET)], "visual");
    expect(written.filter((segment) => segment.style?.caret !== undefined).map((segment) => segment.text)).toEqual(["😀"]);
  });
});
