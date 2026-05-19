import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import {
  IDENTITY,
  INVERT_LIGHTNESS,
  Oklch,
  type ThemeKey,
} from "../../src/core/oklch.js";
import { Palette } from "../../src/themes/palette.js";
import { getThemePalette } from "../../src/themes/registry.js";
import {
  ANCHORED_ROOTS,
  isAnchored,
  transposePalette,
} from "../../src/themes/transpose.js";

describe("ANCHORED_ROOTS / isAnchored", () => {
  it("anchors the three semantic roots", () => {
    expect(ANCHORED_ROOTS).toEqual(new Set(["error", "success", "warning"]));
  });

  it("anchors bare roots and their hyphen-prefixed variants", () => {
    expect(isAnchored("error")).toBe(true);
    expect(isAnchored("error-darken-1")).toBe(true);
    expect(isAnchored("error-lighten-3")).toBe(true);
    expect(isAnchored("success")).toBe(true);
    expect(isAnchored("warning-darken-2")).toBe(true);
  });

  it("leaves decorative roles unlocked", () => {
    expect(isAnchored("primary")).toBe(false);
    expect(isAnchored("accent")).toBe(false);
    expect(isAnchored("secondary-lighten-1")).toBe(false);
    expect(isAnchored("background")).toBe(false);
    expect(isAnchored("boost")).toBe(false);
  });

  it("does not anchor merely-contains matches (root prefix only)", () => {
    // A var named "no-error" should NOT anchor — only literal `error*` does.
    expect(isAnchored("no-error")).toBe(false);
    // Defensive: an "errors" plural would not match the strict root set.
    expect(isAnchored("errors")).toBe(false);
  });
});

describe("transposePalette — identity", () => {
  it("IDENTITY returns byte-exact colors (no round-trip)", () => {
    const gruv = getThemePalette("gruvbox");
    expect(gruv).not.toBeNull();
    const out = transposePalette(gruv!, IDENTITY);
    // Same vars, same instance equality on each ColorRgba would be too
    // strict (we construct a new Palette wrapper). Byte equality on every
    // channel is the contract.
    expect(out.vars.size).toBe(gruv!.vars.size);
    for (const [k, src] of gruv!.vars) {
      const dst = out.get(k)!;
      expect([dst.red, dst.green, dst.blue, dst.alpha]).toEqual([
        src.red,
        src.green,
        src.blue,
        src.alpha,
      ]);
    }
  });

  it("IDENTITY preserves the name when no override is given", () => {
    const gruv = getThemePalette("gruvbox")!;
    expect(transposePalette(gruv, IDENTITY).name).toBe("gruvbox");
  });

  it("name override is applied when provided", () => {
    const gruv = getThemePalette("gruvbox")!;
    expect(transposePalette(gruv, IDENTITY, "gruv-renamed").name).toBe("gruv-renamed");
  });
});

describe("transposePalette — anchor hue is locked", () => {
  // Build a synthetic palette so we can assert hue exactly without
  // entangling the test with theme-data values.
  function syntheticPalette(): Palette {
    return new Palette("synth", true, new Map<string, ColorRgba>([
      ["primary",  new ColorRgba(80, 140, 200)],   // a blue
      ["accent",   new ColorRgba(220, 180, 60)],   // a yellow
      ["error",    new ColorRgba(220, 60, 60)],    // a red
      ["error-darken-1",  new ColorRgba(180, 30, 30)],
      ["success",  new ColorRgba(60, 180, 80)],    // a green
      ["warning",  new ColorRgba(230, 160, 30)],   // an amber
    ]));
  }

  const ROTATE_60: ThemeKey = {
    hueShift: 60,
    chromaScale: 1,
    lightnessScale: 1,
    lightnessShift: 0,
  };

  it("decorative vars shift hue, anchored vars do not", () => {
    const before = syntheticPalette();
    const after = transposePalette(before, ROTATE_60);

    const primaryHueBefore = Oklch.fromRgba(before.get("primary")!).h;
    const primaryHueAfter  = Oklch.fromRgba(after.get("primary")!).h;
    // Decorative: rotated ~60° (allow generous tolerance for round-trip drift).
    const decorativeDelta = ((primaryHueAfter - primaryHueBefore) + 360) % 360;
    expect(decorativeDelta).toBeGreaterThan(55);
    expect(decorativeDelta).toBeLessThan(65);

    for (const anchorKey of ["error", "error-darken-1", "success", "warning"]) {
      const hueBefore = Oklch.fromRgba(before.get(anchorKey)!).h;
      const hueAfter  = Oklch.fromRgba(after.get(anchorKey)!).h;
      const anchorDelta = ((hueAfter - hueBefore) + 360) % 360;
      // Anchored hues should be within ~1° tolerance for round-trip.
      expect(Math.min(anchorDelta, 360 - anchorDelta)).toBeLessThan(2);
    }
  });

  it("real palette: rotating gruvbox keeps error red-ish", () => {
    const gruv = getThemePalette("gruvbox")!;
    const errorBefore = Oklch.fromRgba(gruv.get("error")!);

    for (const hueShift of [60, 120, 180, 240, 300]) {
      const transposed = transposePalette(gruv, {
        hueShift,
        chromaScale: 1,
        lightnessScale: 1,
        lightnessShift: 0,
      });
      const errorAfter = Oklch.fromRgba(transposed.get("error")!);
      expect(Math.abs(errorAfter.h - errorBefore.h)).toBeLessThan(2);
    }
  });
});

describe("transposePalette — INVERT_LIGHTNESS", () => {
  it("flips the dark flag", () => {
    const gruv = getThemePalette("gruvbox")!;     // dark = true
    const flipped = transposePalette(gruv, INVERT_LIGHTNESS);
    expect(flipped.dark).toBe(false);

    const light = getThemePalette("solarized-light")!;   // dark = false
    const flippedLight = transposePalette(light, INVERT_LIGHTNESS);
    expect(flippedLight.dark).toBe(true);
  });

  it("pure hue rotation does NOT flip the dark flag", () => {
    const gruv = getThemePalette("gruvbox")!;
    const rotated = transposePalette(gruv, {
      hueShift: 120,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    expect(rotated.dark).toBe(true);
  });

  it("dark→light flip increases background L past the midpoint", () => {
    // Note: pure `L → 1-L` produces a *medium*-light background, not the
    // very-bright (~0.95) backgrounds humans typically author by hand.
    // The demo's section 3 visualizes this delta on purpose.
    const gruv = getThemePalette("gruvbox")!;
    const flipped = transposePalette(gruv, INVERT_LIGHTNESS);
    const bgBefore = Oklch.fromRgba(gruv.get("background")!);
    const bgAfter  = Oklch.fromRgba(flipped.get("background")!);
    expect(bgAfter.l).toBeGreaterThan(bgBefore.l);
    expect(bgAfter.l).toBeGreaterThan(0.5);
  });
});

describe("transposePalette — composition", () => {
  it("transpose ∘ transpose ≈ single transpose with composed hue", () => {
    const gruv = getThemePalette("gruvbox")!;
    const step1 = transposePalette(gruv, {
      hueShift: 30,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    const step2 = transposePalette(step1, {
      hueShift: 50,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });
    const combined = transposePalette(gruv, {
      hueShift: 80,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    });

    // Both paths land within a few bytes of each other on every non-anchored channel.
    for (const [name, twoStep] of step2.vars) {
      const oneStep = combined.get(name)!;
      expect(Math.abs(twoStep.red - oneStep.red)).toBeLessThanOrEqual(3);
      expect(Math.abs(twoStep.green - oneStep.green)).toBeLessThanOrEqual(3);
      expect(Math.abs(twoStep.blue - oneStep.blue)).toBeLessThanOrEqual(3);
    }
  });
});
