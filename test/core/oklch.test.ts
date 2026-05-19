import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import {
  IDENTITY,
  INVERT_LIGHTNESS,
  Oklch,
  isIdentityKey,
} from "../../src/core/oklch.js";

// Reference values from Björn Ottosson's OKLab spec; tolerance accounts
// for ULP-level drift through cbrt and the inverse cube.
const PRECISION = 0.005;

describe("Oklch.fromRgba — reference values", () => {
  it("pure red", () => {
    const c = Oklch.fromRgba(new ColorRgba(255, 0, 0));
    expect(c.l).toBeCloseTo(0.628, 2);
    expect(c.c).toBeCloseTo(0.258, 2);
    expect(c.h).toBeCloseTo(29.23, 1);
  });

  it("pure green", () => {
    const c = Oklch.fromRgba(new ColorRgba(0, 255, 0));
    expect(c.l).toBeCloseTo(0.866, 2);
    expect(c.c).toBeCloseTo(0.295, 2);
    expect(c.h).toBeCloseTo(142.5, 1);
  });

  it("pure blue", () => {
    const c = Oklch.fromRgba(new ColorRgba(0, 0, 255));
    expect(c.l).toBeCloseTo(0.452, 2);
    expect(c.c).toBeCloseTo(0.313, 2);
    expect(c.h).toBeCloseTo(264.05, 1);
  });

  it("white is L=1, C=0", () => {
    const c = Oklch.fromRgba(new ColorRgba(255, 255, 255));
    expect(c.l).toBeCloseTo(1, 3);
    expect(c.c).toBeLessThan(PRECISION);
  });

  it("black is L=0, C=0", () => {
    const c = Oklch.fromRgba(new ColorRgba(0, 0, 0));
    expect(c.l).toBeCloseTo(0, 3);
    expect(c.c).toBeLessThan(PRECISION);
  });

  it("hue is pinned to 0 for achromatic colors (stable round-trip)", () => {
    expect(Oklch.fromRgba(new ColorRgba(128, 128, 128)).h).toBe(0);
    expect(Oklch.fromRgba(new ColorRgba(0, 0, 0)).h).toBe(0);
  });

  it("alpha passes through", () => {
    const c = Oklch.fromRgba(new ColorRgba(100, 200, 50, 0.4));
    expect(c.alpha).toBeCloseTo(0.4, 6);
  });
});

describe("Oklch round-trip — fromRgba → toRgba", () => {
  // ULP-scale drift through cbrt and inverse-cube is bounded; for the
  // theme-data palette domain (saturated UI colors) the empirical max
  // drift is ≤1 byte per channel.
  const ROUND_TRIP_TOL = 1;

  const samples = [
    new ColorRgba(0, 0, 0),
    new ColorRgba(255, 255, 255),
    new ColorRgba(128, 128, 128),
    new ColorRgba(255, 0, 0),
    new ColorRgba(0, 255, 0),
    new ColorRgba(0, 0, 255),
    new ColorRgba(133, 165, 152),    // gruvbox primary
    new ColorRgba(255, 121, 198),    // dracula accent
    new ColorRgba(40, 42, 54),       // dracula background
    new ColorRgba(245, 194, 231),    // catppuccin pink
  ];

  it.each(samples)("preserves %s within tolerance", (rgba) => {
    const out = Oklch.fromRgba(rgba).toRgba();
    expect(Math.abs(out.red - rgba.red)).toBeLessThanOrEqual(ROUND_TRIP_TOL);
    expect(Math.abs(out.green - rgba.green)).toBeLessThanOrEqual(ROUND_TRIP_TOL);
    expect(Math.abs(out.blue - rgba.blue)).toBeLessThanOrEqual(ROUND_TRIP_TOL);
    expect(out.alpha).toBe(rgba.alpha);
  });

  it("preserves alpha exactly (no quantization on alpha)", () => {
    const src = new ColorRgba(120, 80, 40, 0.37);
    expect(Oklch.fromRgba(src).toRgba().alpha).toBe(0.37);
  });
});

describe("Oklch.applyKey", () => {
  it("IDENTITY returns the same instance (data-as-no-op)", () => {
    // [LAW:dataflow-not-control-flow] — same pattern as
    // ColorRgba.compositeOver short-circuiting on alpha=1.
    const c = Oklch.fromRgba(new ColorRgba(200, 100, 50));
    expect(c.applyKey(IDENTITY)).toBe(c);
  });

  it("isIdentityKey distinguishes identity from near-identity", () => {
    expect(isIdentityKey(IDENTITY)).toBe(true);
    expect(isIdentityKey({ ...IDENTITY, hueShift: 0.0001 })).toBe(false);
    expect(isIdentityKey({ ...IDENTITY, chromaScale: 1.0001 })).toBe(false);
  });

  it("rotates hue and wraps at 360", () => {
    const red = Oklch.fromRgba(new ColorRgba(255, 0, 0)); // h ~29°
    const rotated = red.applyKey({
      hueShift: 360,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    expect(rotated.h).toBeCloseTo(red.h, 5); // 360° rotation is identity
  });

  it("180° rotation puts red near cyan-blue family", () => {
    const red = Oklch.fromRgba(new ColorRgba(255, 0, 0));
    const flipped = red.applyKey({
      hueShift: 180,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    // Original red is ~29°; 180° away is ~209° (cyan-blue region).
    expect(flipped.h).toBeGreaterThan(180);
    expect(flipped.h).toBeLessThan(240);
  });

  it("negative hue shifts wrap positive", () => {
    const c = new Oklch(0.5, 0.1, 30, 1);
    const shifted = c.applyKey({
      hueShift: -60,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    expect(shifted.h).toBeCloseTo(330, 5);
  });

  it("chroma scale of 0 yields achromatic (no chroma)", () => {
    const c = Oklch.fromRgba(new ColorRgba(200, 100, 50));
    const muted = c.applyKey({
      hueShift: 0,
      chromaScale: 0,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    expect(muted.c).toBe(0);
    // toRgba on c=0 should produce a gray (R=G=B within tolerance).
    const gray = muted.toRgba();
    expect(Math.abs(gray.red - gray.green)).toBeLessThanOrEqual(1);
    expect(Math.abs(gray.green - gray.blue)).toBeLessThanOrEqual(1);
  });

  it("chroma collapse pins h=0 even when hueShift is non-zero", () => {
    // Without pinning, applyKey({chromaScale:0, hueShift:60}).h would be
    // (this.h + 60). With pinning, it's 0 — matching fromRgba's convention
    // for achromatic colors so the round-trip is stable.
    const c = Oklch.fromRgba(new ColorRgba(200, 100, 50));
    const muted = c.applyKey({
      hueShift: 60,
      chromaScale: 0,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    expect(muted.c).toBe(0);
    expect(muted.h).toBe(0);
    // Round-trip stability: fromRgba(muted.toRgba()).h should also be 0.
    expect(Oklch.fromRgba(muted.toRgba()).h).toBe(0);
  });

  it("INVERT_LIGHTNESS flips L around the midpoint", () => {
    const dark = new Oklch(0.15, 0.0, 0, 1);   // near-black
    const flipped = dark.applyKey(INVERT_LIGHTNESS);
    expect(flipped.l).toBeCloseTo(0.85, 5);
    expect(flipped.c).toBe(0);
    expect(flipped.h).toBe(0);
  });

  it("lightness shift clamps to [0,1]", () => {
    const c = new Oklch(0.5, 0.1, 30, 1);
    const high = c.applyKey({
      hueShift: 0,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 10,
    });
    expect(high.l).toBe(1);
    const low = c.applyKey({
      hueShift: 0,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: -10,
    });
    expect(low.l).toBe(0);
  });
});

describe("Oklch.toRgba — gamut clamping", () => {
  it("clamps out-of-gamut chroma without throwing", () => {
    // An extreme C value far beyond what sRGB can represent at this hue.
    const wild = new Oklch(0.5, 2.0, 30, 1);
    const out = wild.toRgba();
    expect(out).toBeInstanceOf(ColorRgba);
    // All channels in valid byte range (the constructor would have thrown otherwise).
    expect(out.red).toBeGreaterThanOrEqual(0);
    expect(out.red).toBeLessThanOrEqual(255);
  });

  it("gamut-clamping reduces chroma but preserves hue and lightness", () => {
    const wild = new Oklch(0.5, 2.0, 30, 1);
    const back = Oklch.fromRgba(wild.toRgba());
    // L and H should survive (up to round-trip noise); only C shrinks.
    expect(back.l).toBeCloseTo(0.5, 2);
    expect(back.h).toBeCloseTo(30, 1);
    expect(back.c).toBeLessThan(2.0);
  });
});

describe("Oklch constructor", () => {
  it("throws on non-finite l", () => {
    expect(() => new Oklch(NaN, 0, 0)).toThrow(RangeError);
  });
  it("throws on alpha out of [0,1]", () => {
    expect(() => new Oklch(0.5, 0.1, 30, -0.1)).toThrow(RangeError);
    expect(() => new Oklch(0.5, 0.1, 30, 1.1)).toThrow(RangeError);
  });
});
