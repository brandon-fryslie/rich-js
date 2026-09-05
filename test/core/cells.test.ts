import { describe, it, expect } from "vitest";
import {
  asCellCol,
  cellLen,
  setCellSize,
  splitText,
  chopCells,
  cellStepFrom,
  asCodePoint,
} from "../../src/core/cells.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts (widths, invariants), not implementation details (caching, slicing)

describe("cellLen", () => {
  it("returns 0 for empty string", () => {
    expect(cellLen("")).toBe(0);
  });

  it("returns correct width for ASCII text", () => {
    expect(cellLen("hello")).toBe(5);
  });

  it("returns correct width for ASCII text with spaces", () => {
    expect(cellLen("hello world")).toBe(11);
  });

  it("returns 2 for a single CJK character", () => {
    expect(cellLen("中")).toBe(2);
  });

  it("returns correct width for multiple CJK characters", () => {
    expect(cellLen("中文")).toBe(4);
  });

  it("returns correct width for mixed ASCII and CJK", () => {
    expect(cellLen("a中b")).toBe(4); // 1 + 2 + 1
  });

  it("returns width >= 1 for emoji characters", () => {
    // Emoji are typically 2 cells wide, but at minimum 1
    expect(cellLen("😀")).toBeGreaterThanOrEqual(1);
  });
});

describe("setCellSize", () => {
  it("pads a short ASCII string with spaces", () => {
    const result = setCellSize("hi", asCellCol(5));
    expect(result).toBe("hi   ");
    expect(cellLen(result)).toBe(5);
  });

  it("returns empty string for width 0", () => {
    expect(setCellSize("hello", asCellCol(0))).toBe("");
  });

  it("returns the string unchanged when it already matches the target width", () => {
    expect(setCellSize("hello", asCellCol(5))).toBe("hello");
  });

  it("crops a long ASCII string to the target width", () => {
    const result = setCellSize("hello world", asCellCol(5));
    expect(cellLen(result)).toBe(5);
    expect(result).toBe("hello");
  });

  it("pads a CJK string to the target width", () => {
    const result = setCellSize("中", asCellCol(5));
    expect(cellLen(result)).toBe(5);
    expect(result).toBe("中   ");
  });

  it("crops a CJK string to the target width", () => {
    const result = setCellSize("中文测试", asCellCol(4));
    expect(cellLen(result)).toBe(4);
  });

  it("handles cropping CJK at a boundary that splits a wide character", () => {
    // "中文" is 4 cells; cropping to 3 can't split the second char,
    // so it should take "中" (2 cells) + 1 space pad = 3 cells
    const result = setCellSize("中文", asCellCol(3));
    expect(cellLen(result)).toBe(3);
  });

  it("satisfies invariant: cellLen(setCellSize(text, n)) === n", () => {
    const cases = [
      { text: "", n: asCellCol(5) },
      { text: "hello", n: asCellCol(3) },
      { text: "hello", n: asCellCol(10) },
      { text: "中文测试", n: asCellCol(6) },
      { text: "中文测试", n: asCellCol(3) },
      { text: "a中b", n: asCellCol(2) },
    ];
    for (const { text, n } of cases) {
      expect(cellLen(setCellSize(text, n))).toBe(n);
    }
  });

  it("returns empty string for n=0 (invariant exception per spec)", () => {
    // Spec: cellLen(setCellSize(text, n)) === n unless n is 0
    expect(setCellSize("hello", asCellCol(0))).toBe("");
    expect(setCellSize("中文", asCellCol(0))).toBe("");
    // cellLen("") is 0, so the invariant still holds trivially for n=0
    expect(cellLen(setCellSize("hello", asCellCol(0)))).toBe(0);
  });
});

describe("splitText", () => {
  it('splits at position 0 → ["", text]', () => {
    const [left, right] = splitText("hello", asCellCol(0));
    expect(left).toBe("");
    expect(right).toBe("hello");
  });

  it('splits at end → [text, ""]', () => {
    const [left, right] = splitText("hello", asCellCol(5));
    expect(left).toBe("hello");
    expect(right).toBe("");
  });

  it("splits ASCII text in the middle", () => {
    const [left, right] = splitText("hello", asCellCol(3));
    expect(left).toBe("hel");
    expect(right).toBe("lo");
  });

  it("splits at position beyond text length", () => {
    const [left, right] = splitText("hi", asCellCol(10));
    expect(left).toBe("hi");
    expect(right).toBe("");
  });

  it("splits CJK text at a wide-char boundary", () => {
    // "中文" = 4 cells, split at 2 should cleanly split after first char
    const [left, right] = splitText("中文", asCellCol(2));
    expect(cellLen(left)).toBe(2);
    expect(cellLen(right)).toBe(2);
  });

  it("splits CJK text between wide-char boundaries (padding needed)", () => {
    // "中文" = 4 cells, split at 3 lands in the middle of "文" (a 2-cell char).
    // The wide char stays in the right side; left is padded with a space to reach 3 cells.
    const [left, right] = splitText("中文", asCellCol(3));
    expect(cellLen(left)).toBe(3);
    expect(left).toBe("中 ");
    expect(right).toBe("文");
  });

  it("satisfies invariant: cellLen(left) + cellLen(right) === cellLen(text) for boundary-aligned splits", () => {
    const cases = [
      { text: "hello world", pos: asCellCol(5) },
      { text: "中文测试", pos: asCellCol(4) },
      { text: "中文测试", pos: asCellCol(2) },
      { text: "abc", pos: asCellCol(0) },
      { text: "abc", pos: asCellCol(3) },
    ];
    for (const { text, pos } of cases) {
      const [left, right] = splitText(text, pos);
      expect(cellLen(left) + cellLen(right)).toBe(cellLen(text));
    }
  });

  it("cellLen(left) + cellLen(right) > cellLen(text) for mid-wide-char splits (padding adds width)", () => {
    // When split falls inside a wide char, left gets padding and the wide char
    // stays in right, so the sum exceeds the original width by the padding amount.
    const text = "中文测试"; // 8 cells
    const [left, right] = splitText(text, asCellCol(3));
    expect(cellLen(left)).toBe(3);
    expect(cellLen(right)).toBe(6); // "文测试" = 6 cells
    expect(cellLen(left) + cellLen(right)).toBe(9); // > 8
    expect(cellLen(left) + cellLen(right)).toBeGreaterThan(cellLen(text));
  });

  it("preserves the wide char in right side when splitting mid-wide-character", () => {
    // "中文测试" = 8 cells. Split at 3 falls inside "文".
    // Left: "中" + " " pad = "中 " (3 cells). Right: "文测试" (6 cells).
    const [left, right] = splitText("中文测试", asCellCol(3));
    expect(left).toBe("中 ");
    expect(right).toBe("文测试");
    expect(cellLen(left)).toBe(3);
    expect(cellLen(right)).toBe(6);
  });

  it("splits ASCII text at position 2", () => {
    const [left, right] = splitText("hello", asCellCol(2));
    expect(left).toBe("he");
    expect(right).toBe("llo");
  });

  it('returns ["", text] for negative position', () => {
    const [left, right] = splitText("hello", asCellCol(-1));
    expect(left).toBe("");
    expect(right).toBe("hello");
  });
});

describe("cellStepFrom", () => {
  it("advances past every offset inside the text, at any budget", () => {
    // The guarantee both callers rely on to terminate. A budget narrower than
    // the widest glyph is the case that used to stall.
    for (const text of ["日本語", "a日b", "🎉x", "abc"]) {
      for (const cap of [0, 1, 2, 3]) {
        for (let i = 0; i < text.length; i++) {
          expect(cellStepFrom(text, asCodePoint(i), asCellCol(cap))).toBeGreaterThan(i);
        }
      }
    }
  });

  it("takes as much as fits when the budget allows", () => {
    expect(cellStepFrom("abcd", asCodePoint(0), asCellCol(3))).toBe(3);
    expect(cellStepFrom("中文", asCodePoint(0), asCellCol(3))).toBe(1);
  });

  it("force-takes a whole glyph too wide for the budget", () => {
    // Overflows cap by the glyph's own width rather than returning startCU.
    expect(cellStepFrom("中文", asCodePoint(0), asCellCol(1))).toBe(1);
    // Surrogate pair: the step covers both code units, never half of one.
    expect(cellStepFrom("🎉x", asCodePoint(0), asCellCol(1))).toBe(2);
  });

  it("does not advance past the end of the text", () => {
    expect(cellStepFrom("abc", asCodePoint(3), asCellCol(5))).toBe(3);
  });
});

describe("chopCells", () => {
  it("returns single-element array when text fits within width", () => {
    const result = chopCells("hello", asCellCol(10));
    expect(result).toEqual(["hello"]);
  });

  it("returns single-element array when text exactly matches width", () => {
    const result = chopCells("hello", asCellCol(5));
    expect(result).toEqual(["hello"]);
  });

  it("splits into multiple lines when text exceeds width", () => {
    const result = chopCells("hello world", asCellCol(5));
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(5);
    }
  });

  it("returns [text] for empty string", () => {
    expect(chopCells("", asCellCol(5))).toEqual([""]);
  });

  it("returns [text] for width 0", () => {
    expect(chopCells("hello", asCellCol(0))).toEqual(["hello"]);
  });

  it("chops CJK text respecting character boundaries", () => {
    // "中文测试" = 8 cells, width=3 → lines of at most 3 cells each
    const result = chopCells("中文测试", asCellCol(3));
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(3);
    }
  });

  it("chops CJK text with even width preserving total width", () => {
    // "中文测试" = 8 cells, width=4 → splits on exact wide-char boundaries
    const result = chopCells("中文测试", asCellCol(4));
    expect(result.length).toBe(2);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(4);
    }
    const totalCells = result.reduce((sum, line) => sum + cellLen(line), 0);
    expect(totalCells).toBe(cellLen("中文测试"));
  });

  it("chops single-character-width lines", () => {
    const result = chopCells("abc", asCellCol(1));
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("preserves total content across lines for ASCII", () => {
    const text = "abcdefghij";
    const result = chopCells(text, asCellCol(3));
    const joined = result.join("");
    expect(joined).toBe(text);
  });

  it("force-takes a glyph wider than the whole budget", () => {
    // A 2-cell glyph cannot be split to fit 1 cell; each line overflows by its
    // own width rather than the loop stalling on an unsplittable remainder.
    expect(chopCells("日本語", asCellCol(1))).toEqual(["日", "本", "語"]);
  });

  it("never emits a line for zero consumed input", () => {
    // The regression this pins: a budget narrower than the widest glyph used to
    // emit a padded blank line forever, so the line count grew without bound
    // while the input never shrank.
    for (const text of ["日本語", "a日b", "🎉🎉", "中a中"]) {
      for (const width of [1, 2, 3]) {
        const lines = chopCells(text, asCellCol(width));
        expect(lines.join("")).toBe(text);
        expect(lines.every((line) => line.length > 0)).toBe(true);
      }
    }
  });

  it("returns [text] for a maxWidth of zero or less, overflowing by the whole string", () => {
    // The docstring's overflow bound covers this: no budget at all, so nothing
    // can be met and the text comes back whole.
    expect(chopCells("hello", asCellCol(0))).toEqual(["hello"]);
    expect(chopCells("hello", asCellCol(-3))).toEqual(["hello"]);
  });

  it("does not pad short lines out to the budget", () => {
    // splitText pads to land exactly on the requested column; chopping must not
    // — a padded line is content the caller never wrote.
    expect(chopCells("中文测试", asCellCol(3))).toEqual(["中", "文", "测", "试"]);
  });
});
