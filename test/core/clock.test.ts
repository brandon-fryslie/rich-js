import { describe, expect, it } from "vitest";
import { frameRate } from "../../src/core/clock.js";

describe("frameRate", () => {
  it.each([30, 1, 0.5, 12.5])("takes %s frames a second, with the interval between them", (perSecond) => {
    const rate = frameRate(perSecond);
    expect(rate.perSecond).toBe(perSecond);
    expect(rate.interval).toBe(1 / perSecond);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e-7, Number.MIN_VALUE])("refuses %s", (perSecond) => {
    expect(() => frameRate(perSecond)).toThrow(RangeError);
  });

  it("takes the slowest rate a platform timer can wait out, and nothing slower", () => {
    const longest = (2 ** 31 - 1) / 1000;
    expect(frameRate(1.001 / longest).interval).toBeCloseTo(longest / 1.001);
    expect(() => frameRate(1 / (longest * 1.01))).toThrow(RangeError);
  });
});
