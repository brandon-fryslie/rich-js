import { describe, it, expect, vi } from "vitest";
import { Measurement, measureRenderables } from "../../src/core/measure.js";
import type { Measurable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

const opts = (maxWidth: number): RenderOptions => ({ maxWidth });

// --- Construction ---

describe("Measurement construction", () => {
  it("stores minimum and maximum", () => {
    const m = new Measurement(5, 20);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(20);
  });
});

// --- span ---

describe("Measurement.span", () => {
  it("returns maximum - minimum", () => {
    expect(new Measurement(5, 20).span).toBe(15);
  });

  it("returns 0 when min equals max", () => {
    expect(new Measurement(10, 10).span).toBe(0);
  });
});

// --- normalize ---

describe("Measurement.normalize()", () => {
  it("returns same values when already valid", () => {
    const m = new Measurement(5, 10).normalize();
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(10);
  });

  it("clamps min down when min > max", () => {
    const m = new Measurement(10, 5).normalize();
    expect(m.minimum).toBeLessThanOrEqual(m.maximum);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(5);
  });

  it("clamps negative minimum to 0", () => {
    const m = new Measurement(-5, 10).normalize();
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(10);
  });
});

// --- withMaximum ---

describe("Measurement.withMaximum()", () => {
  it("caps maximum at given width", () => {
    const m = new Measurement(5, 20).withMaximum(10);
    expect(m.maximum).toBe(10);
    expect(m.minimum).toBe(5);
  });

  it("caps both when minimum exceeds width", () => {
    const m = new Measurement(15, 20).withMaximum(10);
    expect(m.minimum).toBe(10);
    expect(m.maximum).toBe(10);
  });

  it("returns unchanged when width >= maximum", () => {
    const m = new Measurement(5, 10).withMaximum(20);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(10);
  });
});

// --- withMinimum ---

describe("Measurement.withMinimum()", () => {
  it("raises minimum to given width", () => {
    const m = new Measurement(5, 10).withMinimum(7);
    expect(m.minimum).toBe(7);
    expect(m.maximum).toBe(10);
  });

  it("raises maximum too when it falls below new minimum", () => {
    const m = new Measurement(5, 6).withMinimum(10);
    expect(m.minimum).toBe(10);
    expect(m.maximum).toBe(10);
  });

  it("returns unchanged when width <= minimum", () => {
    const m = new Measurement(5, 10).withMinimum(3);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(10);
  });
});

// --- clamp ---

describe("Measurement.clamp()", () => {
  it("clamps both values into range", () => {
    const m = new Measurement(2, 20).clamp(5, 15);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(15);
  });

  it("raises values below range", () => {
    const m = new Measurement(1, 3).clamp(5, 15);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(5);
  });

  it("caps values above range", () => {
    const m = new Measurement(20, 30).clamp(5, 15);
    expect(m.minimum).toBe(15);
    expect(m.maximum).toBe(15);
  });
});

// --- Measurement.get ---

describe("Measurement.get()", () => {
  const measurable: Measurable = {
    measure: () => ({ minimum: 5, maximum: 20 }),
  };

  it("returns the measurable's measurement", () => {
    const m = Measurement.get(opts(40), measurable);
    expect(m.minimum).toBe(5);
    expect(m.maximum).toBe(20);
  });

  it("caps maximum at maxWidth", () => {
    const m = Measurement.get(opts(10), measurable);
    expect(m.maximum).toBe(10);
  });

  it("returns (0,0) when maxWidth < 1 without calling measure", () => {
    const spy = vi.fn(() => ({ minimum: 5, maximum: 20 }));
    const spiedMeasurable: Measurable = { measure: spy };
    const m = Measurement.get(opts(0), spiedMeasurable);
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns (0,0) for negative maxWidth", () => {
    const spy = vi.fn(() => ({ minimum: 5, maximum: 20 }));
    const spiedMeasurable: Measurable = { measure: spy };
    const m = Measurement.get(opts(-1), spiedMeasurable);
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

// --- measureRenderables ---

describe("measureRenderables()", () => {
  it("returns (0,0) for empty array", () => {
    const m = measureRenderables(opts(40), []);
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(0);
  });

  it("returns max of all minimums and maximums", () => {
    const a: Measurable = { measure: () => ({ minimum: 3, maximum: 10 }) };
    const b: Measurable = { measure: () => ({ minimum: 7, maximum: 15 }) };
    const m = measureRenderables(opts(40), [a, b]);
    expect(m.minimum).toBe(7);
    expect(m.maximum).toBe(15);
  });

  it("caps at maxWidth", () => {
    const a: Measurable = { measure: () => ({ minimum: 5, maximum: 50 }) };
    const m = measureRenderables(opts(20), [a]);
    expect(m.maximum).toBe(20);
  });
});
