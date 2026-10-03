import { describe, it, expect } from "vitest";
import { MEMO_MAX, Memo } from "../../src/core/memo.js";
import { ColorSpec, colorSpecParseMemo } from "../../src/core/color.js";
import { Style, styleParseMemo } from "../../src/core/style.js";

const DISTINCT = 100_000;

function hex(i: number): string {
  return `#${i.toString(16).padStart(6, "0")}`;
}

describe("Memo", () => {
  it("computes once per key while the key is remembered", () => {
    const memo = new Memo<{ key: string }>();
    let computed = 0;
    const compute = (key: string) => {
      computed++;
      return { key };
    };
    const first = memo.get("a", compute);
    expect(memo.get("a", compute)).toBe(first);
    expect(computed).toBe(1);
  });

  it("never holds more than MEMO_MAX entries", () => {
    const memo = new Memo<number>();
    for (let i = 0; i < DISTINCT; i++) {
      memo.get(String(i), (key) => key.length);
      expect(memo.size).toBeLessThanOrEqual(MEMO_MAX);
    }
  });
});

describe("parse memos stay bounded under distinct strings", () => {
  it("ColorSpec.parse", () => {
    for (let i = 0; i < DISTINCT; i++) ColorSpec.parse(hex(i));
    expect(colorSpecParseMemo.size).toBeLessThanOrEqual(MEMO_MAX);
    const parsed = ColorSpec.parse("#abcdef");
    expect(ColorSpec.parse("#abcdef")).toBe(parsed);
  });

  it("Style.parse", () => {
    for (let i = 0; i < DISTINCT; i++) Style.parse(`bold ${hex(i)}`);
    expect(styleParseMemo.size).toBeLessThanOrEqual(MEMO_MAX);
    const parsed = Style.parse("italic #abcdef");
    expect(Style.parse("italic #abcdef")).toBe(parsed);
  });
});
