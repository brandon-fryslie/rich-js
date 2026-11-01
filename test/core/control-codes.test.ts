import { describe, expect, it } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import { CONTROL_CODES, dispositionOf } from "../../src/core/control-codes.js";
import { stripControlChars } from "../../src/core/text.js";

const NON_PRINTING = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
// A row for a code point a newer Unicode assigned is unassigned on an older Node
// that `engines` admits, and prints nothing there either.
const ROWABLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cn}]/u;

const isSurrogate = (codePoint: number): boolean => codePoint >= 0xd800 && codePoint <= 0xdfff;

/** Every Cc, Cf, Zl and Zp code point, from the running engine's Unicode properties. */
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
  it("has a row for every Cc, Cf, Zl and Zp code point", () => {
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
    expect(dispositionOf(0x1b)).toBe("strip");
    expect(dispositionOf(0x0a)).toBe("keep");
    expect(dispositionOf(0x202e)).toBe("strip");
    expect(dispositionOf(0x200d)).toBe("keep");
    expect(dispositionOf(0x41)).toBe("keep");
    expect(dispositionOf(0x4e00)).toBe("keep");
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

  // Between `a` and `b`, which join nothing. Between joined emoji a raw string
  // and its sanitized form rightly differ: a raw ESC reaches the wire and breaks
  // the join, and the sanitized string has no ESC to break it.
  it("gives no width to what it strips", () => {
    const widened = CENSUS.filter(
      (codePoint) => dispositionOf(codePoint) === "strip" && cellLen(`a${String.fromCodePoint(codePoint)}b`) !== 2,
    );
    expect(widened.map(name)).toEqual([]);
  });
});
