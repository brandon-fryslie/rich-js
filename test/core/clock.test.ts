import { describe, expect, it } from "vitest";
import { frameRate } from "../../src/core/clock.js";

describe("frameRate", () => {
  it.each([30, 1, 0.5, 12.5])("takes %s frames a second, with the interval between them", (perSecond) => {
    const rate = frameRate(perSecond);
    expect(rate.perSecond).toBe(perSecond);
    expect(rate.interval).toBe(1 / perSecond);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("refuses %s", (perSecond) => {
    expect(() => frameRate(perSecond)).toThrow(RangeError);
  });
});
