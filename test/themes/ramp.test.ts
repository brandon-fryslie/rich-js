import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import { EASES, cubicBezier } from "../../src/core/easing.js";
import { ColorRamp } from "../../src/themes/ramp.js";

const panel = new ColorRgba(40, 44, 52);
const warning = new ColorRgba(229, 192, 123);
const error = new ColorRgba(224, 108, 117);

// The bundled cc-candybar threshold cascade — `≥ 50 warning, ≥ 80 error,
// else panel` — spelled as data.
const cascade = new ColorRamp(EASES.step, [
  { at: 0, color: panel },
  { at: 50, color: warning },
  { at: 80, color: error },
]);

const gradient = new ColorRamp(EASES.linear, [
  { at: 0, color: panel },
  { at: 50, color: warning },
  { at: 80, color: error },
]);

describe("ColorRamp — shape is checked once, in the constructor", () => {
  it("refuses an empty ramp", () => {
    expect(() => new ColorRamp(EASES.linear, [])).toThrow(/at least one stop/);
  });

  it("refuses a non-finite position", () => {
    expect(
      () => new ColorRamp(EASES.linear, [{ at: Number.NaN, color: panel }]),
    ).toThrow(/stop 0 has a non-finite position NaN/);
  });

  it("refuses stops out of ascending order rather than sorting them", () => {
    // [LAW:no-silent-failure] `warning at 80, error at 50` read from a config
    // is an authoring mistake; a sorted ramp would render a ramp the author
    // never wrote.
    expect(
      () =>
        new ColorRamp(EASES.step, [
          { at: 0, color: panel },
          { at: 80, color: warning },
          { at: 50, color: error },
        ]),
    ).toThrow(/stop 2 at 50 follows stop 1 at 80/);
  });

  it("accepts two stops at one position as a hard edge, the later color winning there", () => {
    const hard = new ColorRamp(EASES.linear, [
      { at: 0, color: panel },
      { at: 50, color: panel },
      { at: 50, color: error },
      { at: 100, color: error },
    ]);
    expect(hard.at(49.999).hex).toBe(panel.hex);
    expect(hard.at(50).hex).toBe(error.hex);
  });
});

describe("ColorRamp.at", () => {
  it("is exactly each stop's color at that stop's position, byte for byte", () => {
    // The sRGB↔OKLCH round-trip is lossy by up to a channel unit; a ramp that
    // did not hit its own stops would paint colors the author never wrote.
    for (const ramp of [cascade, gradient]) {
      for (const stop of ramp.stops) {
        expect(ramp.at(stop.at)).toBe(stop.color);
      }
    }
  });

  it("clamps: below the first stop is the first color, at or above the last is the last", () => {
    for (const ramp of [cascade, gradient]) {
      expect(ramp.at(-1000)).toBe(panel);
      expect(ramp.at(80)).toBe(error);
      expect(ramp.at(1e9)).toBe(error);
    }
  });

  it("step holds each color until the next position — the `≥ threshold` cascade", () => {
    expect(cascade.at(0)).toBe(panel);
    expect(cascade.at(49)).toBe(panel);
    expect(cascade.at(49.999)).toBe(panel);
    expect(cascade.at(50)).toBe(warning);
    expect(cascade.at(79.5)).toBe(warning);
    expect(cascade.at(80)).toBe(error);
  });

  it("linear is Oklch.mix of the two enclosing stops at the segment's progress", () => {
    const expected = (from: ColorRgba, to: ColorRgba, t: number) =>
      Oklch.fromRgba(from).mix(Oklch.fromRgba(to), t).toRgba().hex;
    expect(gradient.at(25).hex).toBe(expected(panel, warning, 0.5));
    expect(gradient.at(10).hex).toBe(expected(panel, warning, 0.2));
    expect(gradient.at(65).hex).toBe(expected(warning, error, 0.5));
  });

  it("a one-stop ramp is that color everywhere", () => {
    const flat = new ColorRamp(EASES.linear, [{ at: 10, color: warning }]);
    expect(flat.at(-5)).toBe(warning);
    expect(flat.at(10)).toBe(warning);
    expect(flat.at(500)).toBe(warning);
  });

  it("refuses a non-finite value", () => {
    expect(() => cascade.at(Number.NaN)).toThrow(/finite value, got NaN/);
    expect(() => cascade.at(Number.POSITIVE_INFINITY)).toThrow(/finite value/);
  });
});

describe("ColorRamp — every ease in the vocabulary", () => {
  const stops = [
    { at: 0, color: panel },
    { at: 50, color: warning },
    { at: 80, color: error },
  ];

  it("paints each stop's own color on it whenever the ease starts at 0", () => {
    for (const [name, ease] of Object.entries(EASES)) {
      if (ease(0) !== 0) continue;
      const ramp = new ColorRamp(ease, stops);
      for (const stop of stops) expect(ramp.at(stop.at), `${name} at ${stop.at}`).toBe(stop.color);
    }
  });

  it("jumps at the start of the interval under step-start, as CSS defines it", () => {
    const ramp = new ColorRamp(EASES["step-start"], stops);
    expect(ramp.at(0)).toBe(warning);
    expect(ramp.at(50)).toBe(error);
    expect(ramp.at(80)).toBe(error);
  });

  it("holds the end colors where an ease overshoots, never painting outside its stops", () => {
    const two = [
      { at: 0, color: panel },
      { at: 100, color: error },
    ];
    // A CSS "back" curve: above 1 well before the end of the interval…
    expect(new ColorRamp(cubicBezier(0.34, 1.56, 0.64, 1), two).at(70)).toBe(error);
    // …and its mirror, below 0 just after the start.
    expect(new ColorRamp(cubicBezier(0.36, 0, 0.66, -0.56), two).at(30)).toBe(panel);
  });
});
