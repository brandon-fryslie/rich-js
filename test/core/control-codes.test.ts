import { describe, expect, it } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import { CONTROL_CODES, dispositionOf } from "../../src/core/control-codes.js";
import { stripControlChars } from "../../src/core/text.js";

const NON_PRINTING = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Variation_Selector}]/u;
// A row for a code point a newer Unicode assigned is unassigned on an older Node
// that `engines` admits, and prints nothing there either.
const ROWABLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Variation_Selector}\p{Cn}]/u;

const isSurrogate = (codePoint: number): boolean => codePoint >= 0xd800 && codePoint <= 0xdfff;

/** Every Cc, Cf, Zl, Zp and Variation_Selector code point, from the running engine's Unicode properties. */
function census(): number[] {
  const found: number[] = [];
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (!isSurrogate(codePoint) && NON_PRINTING.test(String.fromCodePoint(codePoint))) found.push(codePoint);
  }
  return found;
}

const CENSUS = census();

const inARow = (codePoint: number): boolean =>
  CONTROL_CODES.some((row) => row.first <= codePoint && codePoint <= row.last);

const name = (codePoint: number): string => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;

describe("CONTROL_CODES", () => {
  it("has a row for every Cc, Cf, Zl, Zp and Variation_Selector code point", () => {
    expect(CENSUS.filter((codePoint) => !inARow(codePoint)).map(name)).toEqual([]);
  });

  it("has a row for nothing else, so no row can delete a printing character", () => {
    const rowed = CONTROL_CODES.flatMap(({ first, last }) =>
      Array.from({ length: last - first + 1 }, (_, i) => first + i),
    );
    expect(rowed.filter((codePoint) => !ROWABLE.test(String.fromCodePoint(codePoint))).map(name)).toEqual([]);
  });

  it("holds its rows ascending and disjoint, which the bisection in dispositionOf relies on", () => {
    for (const [i, row] of CONTROL_CODES.entries()) {
      expect(row.first).toBeLessThanOrEqual(row.last);
      if (i > 0) expect(row.first).toBeGreaterThan(CONTROL_CODES[i - 1]!.last);
    }
  });
});

describe("dispositionOf", () => {
  it("answers each code point from its row, and keeps a printing character", () => {
    expect(dispositionOf(0x1b)).toBe("pictured");
    expect(dispositionOf(0x0d)).toBe("strip");
    expect(dispositionOf(0x0a)).toBe("keep");
    expect(dispositionOf(0x202e)).toBe("keep");
    expect(dispositionOf(0x206a)).toBe("strip");
    expect(dispositionOf(0x200d)).toBe("keep");
    expect(dispositionOf(0x41)).toBe("keep");
    expect(dispositionOf(0x4e00)).toBe("keep");
    expect(dispositionOf(0x2028)).toBe("line-break");
    expect(dispositionOf(0xad)).toBe("withheld");
    expect(dispositionOf(0xe0100)).toBe("withheld");
  });
});

describe("the sanitizer and the measure", () => {
  it("strips exactly what the census says to strip", () => {
    const disagreeing = CENSUS.filter((codePoint) => {
      const stripped = stripControlChars(String.fromCodePoint(codePoint)) === "";
      return stripped !== (dispositionOf(codePoint) === "strip");
    });
    expect(disagreeing.map(name)).toEqual([]);
  });

  it("gives no width to what the wire is denied", () => {
    const denied = (codePoint: number): boolean => ["strip", "pictured"].includes(dispositionOf(codePoint));
    const widened = CENSUS.filter(
      (codePoint) => denied(codePoint) && cellLen(`a${String.fromCodePoint(codePoint)}b`) !== 2,
    );
    expect(widened.map(name)).toEqual([]);
  });
});
