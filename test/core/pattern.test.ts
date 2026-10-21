import { describe, it, expect } from "vitest";
import { pattern } from "../../src/core/pattern.js";

describe("pattern", () => {
  it.each([/a/g, /a/y, /a/gu, new RegExp("a", "gy")])("refuses %s, which keeps a cursor", (re) => {
    expect(() => pattern(re)).toThrow(/keeps a cursor in lastIndex/);
  });

  it("holds a regex with no cursor and matches as it does", () => {
    const digits = pattern(/(\d+)/iu);
    expect(digits.exec("ab12")?.[1]).toBe("12");
    expect(digits.test("x")).toBe(false);
    expect("a1b22".replace(digits, "#")).toBe("a#b22");
    expect("a1b22".split(digits)).toEqual(["a", "1", "b", "22", ""]);
    expect(digits.source).toBe("(\\d+)");
    expect(digits.flags).toBe("iu");
  });
});
