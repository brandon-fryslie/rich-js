import { describe, it, expect } from "vitest";
import { ratioBudget, ratioDistribute, ratioResolve } from "../../src/renderables/ratio.js";
import type { Edge } from "../../src/renderables/ratio.js";

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

describe("ratioResolve", () => {
  const edge = (e: Partial<Edge> = {}): Edge => ({ size: undefined, ratio: 1, minimumSize: 1, ...e });

  // Every expectation below is what Python Rich fc41075a's
  // `ratio_resolve(total, edges)` returns for the same call.
  it.each<[number, Edge[], number[]]>([
    [5, [edge(), edge()], [2, 3]],
    [30, [edge(), edge({ ratio: 3 })], [7, 23]],
    [27, [edge(), edge({ ratio: 3 })], [6, 21]],
    [6, [edge(), edge({ ratio: 2 }), edge({ ratio: 3 })], [1, 2, 3]],
    [7, [edge(), edge(), edge()], [2, 2, 3]],
    [17, [edge({ ratio: 2 }), edge()], [11, 6]],
    [11, [edge({ ratio: 5 }), edge(), edge({ ratio: 4 })], [5, 1, 5]],
    [10, [edge({ minimumSize: 5 }), edge({ ratio: 3 }), edge()], [5, 3, 2]],
    [20, [edge({ size: 4 }), edge({ ratio: 2, minimumSize: 10 }), edge({ ratio: 3 })], [4, 10, 6]],
  ])("splits %i as Rich does", (total, edges, expected) => {
    expect(ratioResolve(total, edges)).toEqual(expected);
  });

  it("hands out the whole total, which a floored share per edge did not", () => {
    for (let total = 0; total <= 40; total++) {
      const parts = ratioResolve(total, [edge(), edge({ ratio: 2.5 }), edge({ ratio: 0.5 })]);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });

  // In doubles, 6 * 0.3 / 0.6 is 2.9999999999999996, which floors to 2.
  it("reads fractional ratios as the decimals they were written as", () => {
    expect(ratioResolve(6, [edge({ ratio: 0.1 }), edge({ ratio: 0.2 }), edge({ ratio: 0.3 })])).toEqual([1, 2, 3]);
  });

  // The port's one departure: Rich pays both minimums and returns [2, 2].
  it("never pays past the total, where the reference overflows it", () => {
    expect(ratioResolve(1, [edge({ minimumSize: 2 }), edge({ minimumSize: 2 })])).toEqual([1, 0]);
    expect(ratioResolve(3, [edge({ size: 5 }), edge()])).toEqual([3, 0]);
  });

  it("pays a ratio of 0 its minimum and nothing more", () => {
    expect(ratioResolve(10, [edge({ ratio: 0, minimumSize: 3 }), edge()])).toEqual([3, 7]);
  });
});

describe("ratioBudget", () => {
  const edge = (e: Partial<Edge> = {}): Edge => ({ size: undefined, ratio: 1, minimumSize: 1, ...e });

  // [LAW:one-source-of-truth] The budget is only right if the split it inverts
  // agrees: every growing edge must receive at least what it asked for there.
  it.each<[Edge[], number[]]>([
    [[edge(), edge()], [4, 5]],
    [[edge(), edge({ ratio: 3 })], [7, 2]],
    [[edge({ ratio: 0.1 }), edge({ ratio: 0.2 }), edge({ ratio: 0.3 })], [3, 1, 4]],
    [[edge({ size: 4 }), edge({ ratio: 0, minimumSize: 2 }), edge({ ratio: 5 }), edge()], [0, 0, 1, 9]],
    [[edge({ minimumSize: 6 }), edge()], [2, 2]],
  ])("is a total at which the split reaches every want", (edges, wants) => {
    const budget = ratioBudget(edges, wants);
    const parts = ratioResolve(budget, edges);
    edges.forEach((e, i) => {
      const owed = e.size ?? (e.ratio === 0 ? e.minimumSize : Math.max(e.minimumSize, wants[i]!));
      expect(parts[i]).toBeGreaterThanOrEqual(owed);
    });
  });
});
