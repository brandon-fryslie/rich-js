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
});
