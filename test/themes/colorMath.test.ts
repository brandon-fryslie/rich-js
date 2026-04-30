import { describe, it, expect } from "vitest";
import { ColorQuad } from "../../src/core/color.js";
import {
  darken,
  lighten,
  alphaBlend,
  contrastFor,
} from "../../src/themes/colorMath.js";

const mid = new ColorQuad(128, 128, 128, 1);
const black = new ColorQuad(0, 0, 0, 1);
const white = new ColorQuad(255, 255, 255, 1);
const red = new ColorQuad(200, 50, 50, 1);
const translucent = new ColorQuad(255, 255, 255, 0.04);

const sumRgb = (q: ColorQuad) => q.red + q.green + q.blue;

describe("darken", () => {
  it("level 0 round-trips within ±1 RGB unit", () => {
    const out = darken(mid, 0);
    expect(Math.abs(out.red - mid.red)).toBeLessThanOrEqual(1);
    expect(Math.abs(out.green - mid.green)).toBeLessThanOrEqual(1);
    expect(Math.abs(out.blue - mid.blue)).toBeLessThanOrEqual(1);
  });

  it("monotonically decreases lightness as levels increase", () => {
    const a = darken(mid, 1);
    const b = darken(mid, 2);
    const c = darken(mid, 3);
    expect(sumRgb(a)).toBeGreaterThan(sumRgb(b));
    expect(sumRgb(b)).toBeGreaterThan(sumRgb(c));
  });

  it("clamps at black for very large levels", () => {
    const out = darken(mid, 100);
    expect(out.red).toBe(0);
    expect(out.green).toBe(0);
    expect(out.blue).toBe(0);
  });

  it("negative levels lighten", () => {
    expect(sumRgb(darken(mid, -2))).toBeGreaterThan(sumRgb(mid));
  });

  it("preserves alpha", () => {
    expect(darken(translucent, 2).alpha).toBe(translucent.alpha);
    expect(darken(translucent, -3).alpha).toBe(translucent.alpha);
  });
});

describe("lighten", () => {
  it("monotonically increases lightness", () => {
    expect(sumRgb(lighten(mid, 1))).toBeGreaterThan(sumRgb(mid));
    expect(sumRgb(lighten(mid, 3))).toBeGreaterThan(sumRgb(lighten(mid, 1)));
  });

  it("clamps at white for very large levels", () => {
    const out = lighten(mid, 100);
    expect(out.red).toBe(255);
    expect(out.green).toBe(255);
    expect(out.blue).toBe(255);
  });

  it("equals darken with negated levels", () => {
    const a = lighten(red, 2);
    const b = darken(red, -2);
    expect(a.red).toBe(b.red);
    expect(a.green).toBe(b.green);
    expect(a.blue).toBe(b.blue);
  });

  it("preserves alpha", () => {
    expect(lighten(translucent, 2).alpha).toBe(translucent.alpha);
  });
});

describe("alphaBlend", () => {
  it("opacity=0 returns bg (rgb and alpha)", () => {
    const out = alphaBlend(red, white, 0);
    expect(out.red).toBe(white.red);
    expect(out.green).toBe(white.green);
    expect(out.blue).toBe(white.blue);
    expect(out.alpha).toBe(white.alpha);
  });

  it("opacity=1 returns fg (rgb and alpha)", () => {
    const out = alphaBlend(red, white, 1);
    expect(out.red).toBe(red.red);
    expect(out.green).toBe(red.green);
    expect(out.blue).toBe(red.blue);
    expect(out.alpha).toBe(red.alpha);
  });

  it("opacity=0.5 is the midpoint per channel", () => {
    const out = alphaBlend(black, white, 0.5);
    expect(out.red).toBeCloseTo(128, -1);
    expect(out.green).toBeCloseTo(128, -1);
    expect(out.blue).toBeCloseTo(128, -1);
    expect(out.alpha).toBe(1);
  });

  it("alpha channel rides the same ramp", () => {
    const opaque = new ColorQuad(0, 0, 0, 1);
    const transparent = new ColorQuad(0, 0, 0, 0);
    const half = alphaBlend(opaque, transparent, 0.5);
    expect(half.alpha).toBeCloseTo(0.5);
  });

  it("clamps opacity to [0,1]", () => {
    expect(alphaBlend(red, white, -0.5).red).toBe(white.red);
    expect(alphaBlend(red, white, 2).red).toBe(red.red);
  });
});

describe("contrastFor", () => {
  it("returns white for dark backgrounds", () => {
    expect(contrastFor(black).red).toBe(255);
    expect(contrastFor(new ColorQuad(40, 40, 40, 1)).red).toBe(255);
  });

  it("returns black for light backgrounds", () => {
    expect(contrastFor(white).red).toBe(0);
    expect(contrastFor(new ColorQuad(220, 220, 220, 1)).red).toBe(0);
  });

  it("threshold uses perceptual luminance — bright yellow is light", () => {
    const yellow = new ColorQuad(255, 255, 0, 1);
    expect(contrastFor(yellow).red).toBe(0);
  });

  it("dark blue counts as dark even though it's a primary color", () => {
    const navy = new ColorQuad(0, 0, 128, 1);
    expect(contrastFor(navy).red).toBe(255);
  });

  it("contrast color is always fully opaque, regardless of bg alpha", () => {
    expect(contrastFor(translucent).alpha).toBe(1);
    expect(contrastFor(new ColorQuad(0, 0, 0, 0.3)).alpha).toBe(1);
  });
});
