import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import {
  darken,
  lighten,
  alphaBlend,
  contrastFor,
  contrastRatio,
  ensureContrast,
  relativeLuminance,
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

describe("contrastRatio", () => {
  it("black on white is the maximum 21:1", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
  });

  it("a color against itself is 1:1", () => {
    expect(contrastRatio(red, red)).toBeCloseTo(1, 5);
  });

  it("is symmetric in its arguments", () => {
    expect(contrastRatio(red, white)).toBeCloseTo(contrastRatio(white, red), 10);
  });

  it("matches the WCAG formula via relativeLuminance", () => {
    const la = relativeLuminance(red);
    const lb = relativeLuminance(white);
    const expected = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    expect(contrastRatio(red, white)).toBeCloseTo(expected, 10);
  });
});

describe("ensureContrast", () => {
  it("passes the themed fg through untouched when it already clears the bar", () => {
    // white on black is 21:1 — far above 4.5, so it must be returned as-is.
    expect(ensureContrast(white, black, 4.5)).toBe(white);
  });

  it("lightens/darkens within the hue instead of flipping to black/white", () => {
    // A blue foreground on a darker-blue background fails 4.5:1. ensureContrast
    // must lighten it to a *readable blue* — hue preserved, not white.
    const blue = new ColorRgba(60, 90, 200);
    const darkBlue = new ColorRgba(20, 30, 70);
    const out = ensureContrast(blue, darkBlue, 4.5);
    expect(contrastRatio(out, darkBlue)).toBeGreaterThanOrEqual(4.5);
    // Hue is preserved (still recognizably blue), not collapsed to b/w.
    const hIn = Oklch.fromRgba(blue).h;
    const hOut = Oklch.fromRgba(out).h;
    expect(Math.min(Math.abs(hOut - hIn), 360 - Math.abs(hOut - hIn))).toBeLessThan(8);
    expect([out.red, out.green, out.blue]).not.toEqual([255, 255, 255]);
    expect([out.red, out.green, out.blue]).not.toEqual([0, 0, 0]);
  });

  it("makes the smallest lightness change that clears the ratio", () => {
    // The result should sit just past the threshold, not slammed to the pole:
    // its contrast is close to the floor, not the maximum.
    const blue = new ColorRgba(60, 90, 200);
    const darkBlue = new ColorRgba(20, 30, 70);
    const out = ensureContrast(blue, darkBlue, 4.5);
    expect(contrastRatio(out, darkBlue)).toBeLessThan(7); // not pushed all the way to white
  });

  it("flattens a translucent foreground so the guarantee reflects what's seen", () => {
    // A 38%-opaque near-white over a near-white surface looks near-white —
    // unreadable. The raw bytes (255,255,255) would falsely "pass"; flattening
    // first exposes the real low contrast, and the result is opaque + readable.
    const translucent = new ColorRgba(255, 255, 255, 0.38);
    const lightBg = new ColorRgba(235, 235, 235);
    const out = ensureContrast(translucent, lightBg, 4.5);
    expect(out.alpha).toBe(1);
    expect(contrastRatio(out, lightBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to the pole only when no hue lightness can meet the ratio", () => {
    // Against a mid-grey, even pure black/white tops out near 4.58:1, so a
    // target of 7 is physically impossible — return the max-contrast pole.
    const out = ensureContrast(new ColorRgba(120, 120, 120), mid, 7);
    expect(contrastRatio(out, mid)).toBeCloseTo(contrastRatio(contrastFor(mid), mid), 1);
  });

  it("the result always achieves min(target, best-possible-for-bg)", () => {
    // The honest theorem: at the AA threshold, contrastFor guarantees ≥4.58
    // for every background, so ensureContrast always reaches 4.5.
    const fgs = [black, white, red, new ColorRgba(90, 90, 90)];
    const bgs = [black, white, mid, red, new ColorRgba(128, 64, 200)];
    for (const fg of fgs) {
      for (const bg of bgs) {
        const out = ensureContrast(fg, bg, 4.5);
        const best = contrastRatio(contrastFor(bg), bg);
        expect(contrastRatio(out, bg)).toBeGreaterThanOrEqual(Math.min(4.5, best) - 1e-9);
      }
    }
  });
});
