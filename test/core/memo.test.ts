import { describe, it, expect } from "vitest";
import { MEMO_MAX, Memo } from "../../src/core/memo.js";
import { ColorSpec } from "../../src/core/color.js";
import { Style } from "../../src/core/style.js";

// Enough distinct keys to force at least one clear.
const PAST_BOUND = MEMO_MAX + 1;

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
    for (let i = 0; i < 2 * MEMO_MAX + 1; i++) memo.get(String(i), (key) => key.length);
    expect(memo.size).toBeLessThanOrEqual(MEMO_MAX);
  });

  it("keeps its entries when a compute throws at the bound", () => {
    const memo = new Memo<number>();
    for (let i = 0; i < MEMO_MAX; i++) memo.get(String(i), (key) => key.length);
    expect(() =>
      memo.get("bad", () => {
        throw new Error("bad");
      }),
    ).toThrow("bad");
    expect(memo.size).toBe(MEMO_MAX);
  });
});

describe("parse memos return an equal value after their entry is dropped", () => {
  it("ColorSpec.parse", () => {
    const before = ColorSpec.parse("#abcdef");
    for (let i = 0; i < PAST_BOUND; i++) ColorSpec.parse(hex(i));
    expect(ColorSpec.parse("#abcdef")).toEqual(before);
  });

  it("Style.parse", () => {
    const before = Style.parse("italic #abcdef");
    for (let i = 0; i < PAST_BOUND; i++) Style.parse(`bold ${hex(i)}`);
    expect(Style.parse("italic #abcdef").equals(before)).toBe(true);
  });
});
