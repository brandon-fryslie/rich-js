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

  // The two non-finite numbers pull in opposite directions here, and only one of
  // them is a mistake. NaN is a width nobody meant, so it reads as no cells;
  // Infinity is a width `Table` means when a column asks for every cell there
  // is, and `withBoundedWidth` throws on it so an unanswerable offer says so.
  // Flooring both — the symmetric-looking `Number.isFinite(n) ? n : 0` — would
  // trade that RangeError for a table silently measured at no width at all.
  it("reads NaN as no cells at all", () => {
    const m = new Measurement(NaN, NaN).normalize();
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(0);
  });

  it("leaves an unbounded maximum unbounded", () => {
    const m = new Measurement(4, Infinity).normalize();
    expect(m.minimum).toBe(4);
    expect(m.maximum).toBe(Infinity);
  });
});

// `Measurement.get` is the single entry point for measuring a `Measurable`, and
// a `Measurable` is arbitrary third-party code: nothing stops it reporting a
// width that is negative, or a minimum above its own maximum. It used to cap
// the maximum against the offer and pass the rest through, so each consumer met
// the bad value itself and floored it — or did not. `Panel.measure` returned
// `{-16, -16}` and a `Layout` leaf returned `{-20, -20}`, both from content
// reporting `{-20, -20}`, while `Columns`, `Tree` and the `Layout` row path
// escaped only because each happened to seed its `Math.max` from a non-negative
// number. Normalizing here is what makes that one guarantee instead of five
// coincidences, and it is why no consumer carries a floor of its own.

describe("Measurement.get() stamps what it returns", () => {
  it("floors a negative measurement to zero", () => {
    const m = Measurement.get(opts(40), { measure: () => ({ minimum: -20, maximum: -20 }) });
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(0);
  });

  it("un-inverts a measurement whose minimum exceeds its maximum", () => {
    const m = Measurement.get(opts(40), { measure: () => ({ minimum: 12, maximum: 4 }) });
    expect(m.minimum).toBeLessThanOrEqual(m.maximum);
  });

  // A NaN reached `Columns`' `Math.max` accumulator and poisoned the widest
  // width it had; the fix is here rather than there, so nothing downstream of
  // the enforcer ever meets one.
  it("floors a measurement that is not a number at all", () => {
    const m = Measurement.get(opts(40), { measure: () => ({ minimum: NaN, maximum: NaN }) });
    expect(m.minimum).toBe(0);
    expect(m.maximum).toBe(0);
  });

  it("leaves a well-behaved measurement alone", () => {
    const m = Measurement.get(opts(40), { measure: () => ({ minimum: 3, maximum: 9 }) });
    expect(m.minimum).toBe(3);
    expect(m.maximum).toBe(9);
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
