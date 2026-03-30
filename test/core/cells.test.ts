import { describe, it, expect } from "vitest";
import {
  cellLen,
  setCellSize,
  splitText,
  chopCells,
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
    const result = setCellSize("hi", 5);
    expect(result).toBe("hi   ");
    expect(cellLen(result)).toBe(5);
  });

  it("returns empty string for width 0", () => {
    expect(setCellSize("hello", 0)).toBe("");
  });

  it("returns the string unchanged when it already matches the target width", () => {
    expect(setCellSize("hello", 5)).toBe("hello");
  });

  it("crops a long ASCII string to the target width", () => {
    const result = setCellSize("hello world", 5);
    expect(cellLen(result)).toBe(5);
    expect(result).toBe("hello");
  });

  it("pads a CJK string to the target width", () => {
    const result = setCellSize("中", 5);
    expect(cellLen(result)).toBe(5);
    expect(result).toBe("中   ");
  });

  it("crops a CJK string to the target width", () => {
    const result = setCellSize("中文测试", 4);
    expect(cellLen(result)).toBe(4);
  });

  it("handles cropping CJK at a boundary that splits a wide character", () => {
    // "中文" is 4 cells; cropping to 3 can't split the second char,
    // so it should take "中" (2 cells) + 1 space pad = 3 cells
    const result = setCellSize("中文", 3);
    expect(cellLen(result)).toBe(3);
  });

  it("satisfies invariant: cellLen(setCellSize(text, n)) === n", () => {
    const cases = [
      { text: "", n: 5 },
      { text: "hello", n: 3 },
      { text: "hello", n: 10 },
      { text: "中文测试", n: 6 },
      { text: "中文测试", n: 3 },
      { text: "a中b", n: 2 },
    ];
    for (const { text, n } of cases) {
      expect(cellLen(setCellSize(text, n))).toBe(n);
    }
  });

  it("returns empty string for n=0 (invariant exception per spec)", () => {
    // Spec: cellLen(setCellSize(text, n)) === n unless n is 0
    expect(setCellSize("hello", 0)).toBe("");
    expect(setCellSize("中文", 0)).toBe("");
    // cellLen("") is 0, so the invariant still holds trivially for n=0
    expect(cellLen(setCellSize("hello", 0))).toBe(0);
  });
});

describe("splitText", () => {
  it('splits at position 0 → ["", text]', () => {
    const [left, right] = splitText("hello", 0);
    expect(left).toBe("");
    expect(right).toBe("hello");
  });

  it('splits at end → [text, ""]', () => {
    const [left, right] = splitText("hello", 5);
    expect(left).toBe("hello");
    expect(right).toBe("");
  });

  it("splits ASCII text in the middle", () => {
    const [left, right] = splitText("hello", 3);
    expect(left).toBe("hel");
    expect(right).toBe("lo");
  });

  it("splits at position beyond text length", () => {
    const [left, right] = splitText("hi", 10);
    expect(left).toBe("hi");
    expect(right).toBe("");
  });

  it("splits CJK text at a wide-char boundary", () => {
    // "中文" = 4 cells, split at 2 should cleanly split after first char
    const [left, right] = splitText("中文", 2);
    expect(cellLen(left)).toBe(2);
    expect(cellLen(right)).toBe(2);
  });

  it("splits CJK text between wide-char boundaries (padding needed)", () => {
    // "中文" = 4 cells, split at 3 lands in the middle of "文" (a 2-cell char).
    // The wide char stays in the right side; left is padded with a space to reach 3 cells.
    const [left, right] = splitText("中文", 3);
    expect(cellLen(left)).toBe(3);
    expect(left).toBe("中 ");
    expect(right).toBe("文");
  });

  it("satisfies invariant: cellLen(left) + cellLen(right) === cellLen(text) for boundary-aligned splits", () => {
    const cases = [
      { text: "hello world", pos: 5 },
      { text: "中文测试", pos: 4 },
      { text: "中文测试", pos: 2 },
      { text: "abc", pos: 0 },
      { text: "abc", pos: 3 },
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
    const [left, right] = splitText(text, 3);
    expect(cellLen(left)).toBe(3);
    expect(cellLen(right)).toBe(6); // "文测试" = 6 cells
    expect(cellLen(left) + cellLen(right)).toBe(9); // > 8
    expect(cellLen(left) + cellLen(right)).toBeGreaterThan(cellLen(text));
  });

  it("preserves the wide char in right side when splitting mid-wide-character", () => {
    // "中文测试" = 8 cells. Split at 3 falls inside "文".
    // Left: "中" + " " pad = "中 " (3 cells). Right: "文测试" (6 cells).
    const [left, right] = splitText("中文测试", 3);
    expect(left).toBe("中 ");
    expect(right).toBe("文测试");
    expect(cellLen(left)).toBe(3);
    expect(cellLen(right)).toBe(6);
  });

  it("splits ASCII text at position 2", () => {
    const [left, right] = splitText("hello", 2);
    expect(left).toBe("he");
    expect(right).toBe("llo");
  });

  it('returns ["", text] for negative position', () => {
    const [left, right] = splitText("hello", -1);
    expect(left).toBe("");
    expect(right).toBe("hello");
  });
});

describe("chopCells", () => {
  it("returns single-element array when text fits within width", () => {
    const result = chopCells("hello", 10);
    expect(result).toEqual(["hello"]);
  });

  it("returns single-element array when text exactly matches width", () => {
    const result = chopCells("hello", 5);
    expect(result).toEqual(["hello"]);
  });

  it("splits into multiple lines when text exceeds width", () => {
    const result = chopCells("hello world", 5);
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(5);
    }
  });

  it("returns [text] for empty string", () => {
    expect(chopCells("", 5)).toEqual([""]);
  });

  it("returns [text] for width 0", () => {
    expect(chopCells("hello", 0)).toEqual(["hello"]);
  });

  it("chops CJK text respecting character boundaries", () => {
    // "中文测试" = 8 cells, width=3 → lines of at most 3 cells each
    const result = chopCells("中文测试", 3);
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(3);
    }
  });

  it("chops CJK text with even width preserving total width", () => {
    // "中文测试" = 8 cells, width=4 → splits on exact wide-char boundaries
    const result = chopCells("中文测试", 4);
    expect(result.length).toBe(2);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(4);
    }
    const totalCells = result.reduce((sum, line) => sum + cellLen(line), 0);
    expect(totalCells).toBe(cellLen("中文测试"));
  });

  it("chops single-character-width lines", () => {
    const result = chopCells("abc", 1);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("preserves total content across lines for ASCII", () => {
    const text = "abcdefghij";
    const result = chopCells(text, 3);
    const joined = result.join("");
    expect(joined).toBe(text);
  });
});
