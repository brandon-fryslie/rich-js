import { describe, expect, it } from "vitest";
import { graphemes } from "../../src/core/cells.js";
import { isPrependCodePoint } from "../../src/core/grapheme-data.js";

const UNASSIGNED = /\p{Cn}/u;
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Before a base letter only GB9b joins, so a code point the running engine
// joins to "a" is a Prepend to that engine.
function enginePrepends(): number[] {
  const found: number[] = [];
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
    if (UNASSIGNED.test(String.fromCodePoint(codePoint))) continue;
    const pair = String.fromCodePoint(codePoint) + "a";
    const first = SEGMENTER.segment(pair)[Symbol.iterator]().next().value!;
    if (first.segment === pair) found.push(codePoint);
  }
  return found;
}

describe("the vendored Prepend table", () => {
  it("holds every Prepend the running engine joins to what follows", () => {
    expect(enginePrepends().filter((codePoint) => !isPrependCodePoint(codePoint))).toEqual([]);
  });

  it("holds a Prepend from every Unicode a supported Node segments at, the ones since dropped or added included", () => {
    expect([0x11a3a, 0x113d1].filter((codePoint) => !isPrependCodePoint(codePoint))).toEqual([]);
  });

  // U+11A3A left Prepend in Unicode 17 and U+113D1 joined it in 16: each is
  // joined to its base by some supported Node, so each is cut on every one.
  it.each([["U+11A3A", 0x11a3a, 0x11a00], ["U+113D1", 0x113d1, 0x11392]])("cuts %s from its base on the running Node", (_name, prepend, base) => {
    expect(graphemes(String.fromCodePoint(prepend, base))).toEqual([String.fromCodePoint(prepend), String.fromCodePoint(base)]);
  });
});
