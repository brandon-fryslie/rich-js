import { describe, it, expect } from "vitest";
import { SPINNERS, DEFAULT_SPINNER } from "../../src/core/spinnerData.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

describe("SPINNERS", () => {
  it("contains common spinner definitions", () => {
    expect(SPINNERS["dots"]).toBeDefined();
    expect(SPINNERS["line"]).toBeDefined();
    expect(SPINNERS["arrow"]).toBeDefined();
    expect(SPINNERS["bounce"]).toBeDefined();
  });

  it("each spinner has frames and interval", () => {
    for (const [name, data] of Object.entries(SPINNERS)) {
      expect(data.frames.length, `${name} should have frames`).toBeGreaterThan(0);
      expect(data.interval, `${name} should have positive interval`).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_SPINNER", () => {
  it("is dots", () => {
    expect(DEFAULT_SPINNER).toBe("dots");
  });

  it("exists in SPINNERS", () => {
    expect(SPINNERS[DEFAULT_SPINNER]).toBeDefined();
  });
});
