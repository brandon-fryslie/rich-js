import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import {
  darken,
  lighten,
  alphaBlend,
  contrastFor,
} from "../../src/themes/colorMath.js";

const mid = new ColorRgba(128, 128, 128);
const black = new ColorRgba(0, 0, 0);
const white = new ColorRgba(255, 255, 255);
const red = new ColorRgba(200, 50, 50);

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
    const sum = (t: ColorRgba) => t.red + t.green + t.blue;
    expect(sum(a)).toBeGreaterThan(sum(b));
    expect(sum(b)).toBeGreaterThan(sum(c));
  });

  it("clamps at black for very large levels", () => {
    const out = darken(mid, 100);
    expect(out.red).toBe(0);
    expect(out.green).toBe(0);
    expect(out.blue).toBe(0);
  });

  it("negative levels lighten", () => {
    const sum = (t: ColorRgba) => t.red + t.green + t.blue;
    expect(sum(darken(mid, -2))).toBeGreaterThan(sum(mid));
  });
});

describe("lighten", () => {
  it("monotonically increases lightness", () => {
    const sum = (t: ColorRgba) => t.red + t.green + t.blue;
    expect(sum(lighten(mid, 1))).toBeGreaterThan(sum(mid));
    expect(sum(lighten(mid, 3))).toBeGreaterThan(sum(lighten(mid, 1)));
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
});

describe("alphaBlend", () => {
  it("alpha=0 returns bg", () => {
    expect(alphaBlend(red, white, 0)).toEqual(white);
  });

  it("alpha=1 returns fg", () => {
    expect(alphaBlend(red, white, 1)).toEqual(red);
  });

  it("alpha=0.5 is the midpoint of fg and bg", () => {
    const out = alphaBlend(black, white, 0.5);
    expect(out.red).toBeCloseTo(128, -1);
    expect(out.green).toBeCloseTo(128, -1);
    expect(out.blue).toBeCloseTo(128, -1);
  });

  it("clamps alpha to [0,1]", () => {
    expect(alphaBlend(red, white, -0.5)).toEqual(white);
    expect(alphaBlend(red, white, 2)).toEqual(red);
  });
});

describe("contrastFor", () => {
  it("returns white for dark backgrounds", () => {
    expect(contrastFor(black)).toEqual(white);
    expect(contrastFor(new ColorRgba(40, 40, 40))).toEqual(white);
  });

  it("returns black for light backgrounds", () => {
    expect(contrastFor(white)).toEqual(black);
    expect(contrastFor(new ColorRgba(220, 220, 220))).toEqual(black);
  });

  it("threshold uses perceptual luminance — bright yellow is light", () => {
    const yellow = new ColorRgba(255, 255, 0);
    expect(contrastFor(yellow)).toEqual(black);
  });

  it("dark blue counts as dark even though it's a primary color", () => {
    const navy = new ColorRgba(0, 0, 128);
    expect(contrastFor(navy)).toEqual(white);
  });
});
