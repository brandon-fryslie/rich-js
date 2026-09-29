import { describe, it, expect } from "vitest";
import { ratioDistribute } from "../../src/renderables/ratio.js";

describe("ratioDistribute", () => {
  it("rounds each share up, as Rich's ratio_distribute does, and sums to the total", () => {
    // Python Rich 9d8f9a3: ratio_distribute(17, [2, 1]) == [12, 5], where a
    // largest-remainder split gives [11, 6].
    expect(ratioDistribute(17, [2, 1])).toEqual([12, 5]);
    expect(ratioDistribute(2, [8, 3, 6, 1])).toEqual([1, 1, 0, 0]);
    expect(ratioDistribute(0, [3, 4])).toEqual([0, 0]);
  });

  it("sums to the total at any safe integer, as Python's exact integers do", () => {
    // In doubles, `78 * remaining / 78` rounds once `remaining` nears 2^53 and
    // the one part came out a cell short of the total it was given.
    const total = Number.MAX_SAFE_INTEGER;
    expect(ratioDistribute(total, [78])).toEqual([total]);
    const parts = ratioDistribute(total, [3, 5, 11]);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
  });

  it("refuses a ratio that is not a whole number, which the reference never takes", () => {
    expect(() => ratioDistribute(10, [1.5, 1])).toThrow(RangeError);
  });
});
