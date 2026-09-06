import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import {
  ColorRamp,
  RAMP_EASING_NAMES,
  parseRampEasing,
} from "../../src/themes/ramp.js";

const panel = new ColorRgba(40, 44, 52);
const warning = new ColorRgba(229, 192, 123);
const error = new ColorRgba(224, 108, 117);

// The bundled cc-candybar threshold cascade — `≥ 50 warning, ≥ 80 error,
// else panel` — spelled as data.
const cascade = new ColorRamp("step", [
  { at: 0, color: panel },
  { at: 50, color: warning },
  { at: 80, color: error },
]);

const gradient = new ColorRamp("linear", [
  { at: 0, color: panel },
  { at: 50, color: warning },
  { at: 80, color: error },
]);

describe("ColorRamp — shape is checked once, in the constructor", () => {
  it("refuses an empty ramp", () => {
    expect(() => new ColorRamp("linear", [])).toThrow(/at least one stop/);
  });

  it("refuses a non-finite position", () => {
    expect(
      () => new ColorRamp("linear", [{ at: Number.NaN, color: panel }]),
    ).toThrow(/stop 0 has a non-finite position NaN/);
  });

  it("refuses stops out of ascending order rather than sorting them", () => {
    // [LAW:no-silent-failure] `warning at 80, error at 50` read from a config
    // is an authoring mistake; a sorted ramp would render a ramp the author
    // never wrote.
    expect(
      () =>
        new ColorRamp("step", [
          { at: 0, color: panel },
          { at: 80, color: warning },
          { at: 50, color: error },
        ]),
    ).toThrow(/stop 2 at 50 follows stop 1 at 80/);
  });

  it("accepts two stops at one position as a hard edge, the later color winning there", () => {
    const hard = new ColorRamp("linear", [
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
    const flat = new ColorRamp("linear", [{ at: 10, color: warning }]);
    expect(flat.at(-5)).toBe(warning);
    expect(flat.at(10)).toBe(warning);
    expect(flat.at(500)).toBe(warning);
  });

  it("refuses a non-finite value", () => {
    expect(() => cascade.at(Number.NaN)).toThrow(/finite value, got NaN/);
    expect(() => cascade.at(Number.POSITIVE_INFINITY)).toThrow(/finite value/);
  });
});

describe("parseRampEasing", () => {
  it("narrows every listed name and nothing else", () => {
    for (const name of RAMP_EASING_NAMES) expect(parseRampEasing(name)).toBe(name);
    expect(() => parseRampEasing("smooth")).toThrow(
      /unknown ramp easing "smooth"; expected one of "linear", "step"/,
    );
    // Prototype names are not easings.
    expect(() => parseRampEasing("toString")).toThrow(/unknown ramp easing/);
  });
});
