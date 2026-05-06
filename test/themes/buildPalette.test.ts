import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { buildPalette } from "../../src/themes/buildPalette.js";

const TEST_BASE = {
  primary: new ColorRgba(0, 111, 184),
  secondary: new ColorRgba(118, 38, 113),
  accent: new ColorRgba(0, 111, 184),
  success: new ColorRgba(0, 128, 0),
  warning: new ColorRgba(128, 128, 0),
  error: new ColorRgba(128, 0, 0),
  background: new ColorRgba(0, 0, 0),
  foreground: new ColorRgba(255, 255, 255),
};

describe("buildPalette", () => {
  it("stores name and dark flag", () => {
    const p = buildPalette("test", true, TEST_BASE);
    expect(p.name).toBe("test");
    expect(p.dark).toBe(true);
  });

  it("includes all base accent keys", () => {
    const p = buildPalette("test", true, TEST_BASE);
    expect(p.get("primary")).toEqual(TEST_BASE.primary);
    expect(p.get("secondary")).toEqual(TEST_BASE.secondary);
    expect(p.get("accent")).toEqual(TEST_BASE.accent);
    expect(p.get("success")).toEqual(TEST_BASE.success);
    expect(p.get("warning")).toEqual(TEST_BASE.warning);
    expect(p.get("error")).toEqual(TEST_BASE.error);
  });

  it("includes background and foreground", () => {
    const p = buildPalette("test", true, TEST_BASE);
    expect(p.get("background")).toEqual(TEST_BASE.background);
    expect(p.get("foreground")).toEqual(TEST_BASE.foreground);
  });

  it("derives surface as background lifted toward foreground", () => {
    const p = buildPalette("test", true, TEST_BASE);
    const surface = p.get("surface")!;
    expect(surface.red).toBeGreaterThan(TEST_BASE.background.red);
    expect(surface.green).toBeGreaterThan(TEST_BASE.background.green);
    expect(surface.blue).toBeGreaterThan(TEST_BASE.background.blue);
  });

  it("derives muted variants blended toward background", () => {
    const p = buildPalette("test", true, TEST_BASE);
    const muted = p.get("primary-muted")!;
    // Muted blue should be dimmer than primary blue (blended 70% toward black bg)
    expect(muted.blue).toBeLessThan(TEST_BASE.primary.blue);
    expect(muted.blue).toBeGreaterThan(TEST_BASE.background.blue);
  });

  it("derives text- variants as tinted contrast text", () => {
    const p = buildPalette("test", true, TEST_BASE);
    const textPrimary = p.get("text-primary")!;
    // On dark background, contrast text is white, tinted with primary
    expect(textPrimary.red).toBeGreaterThan(0);
    expect(textPrimary.blue).toBeGreaterThan(0);
  });

  it("derives keys for all accent colors", () => {
    const p = buildPalette("test", true, TEST_BASE);
    const accents = ["primary", "secondary", "accent", "success", "warning", "error"];
    for (const key of accents) {
      expect(p.get(`${key}-muted`)).toBeDefined();
      expect(p.get(`text-${key}`)).toBeDefined();
      expect(p.get(`on-${key}`)).toBeDefined();
    }
  });

  describe("on-${accent} contrast keys", () => {
    it("on-${accent} is pure black or pure white per WCAG luminance", () => {
      const p = buildPalette("test", true, TEST_BASE);
      const accents = ["primary", "secondary", "accent", "success", "warning", "error"];
      for (const key of accents) {
        const c = p.get(`on-${key}`)!;
        const isBlack = c.red === 0 && c.green === 0 && c.blue === 0;
        const isWhite = c.red === 255 && c.green === 255 && c.blue === 255;
        expect(isBlack || isWhite).toBe(true);
      }
    });

    it("on-warning picks black when warning is high-luminance (yellow)", () => {
      const base = { ...TEST_BASE, warning: new ColorRgba(255, 215, 0) };
      const p = buildPalette("test", true, base);
      expect(p.get("on-warning")).toEqual(new ColorRgba(0, 0, 0));
    });

    it("on-error picks white when error is low-luminance (dark red)", () => {
      const base = { ...TEST_BASE, error: new ColorRgba(128, 0, 0) };
      const p = buildPalette("test", true, base);
      expect(p.get("on-error")).toEqual(new ColorRgba(255, 255, 255));
    });

    it("contrast choice depends on the accent itself, not the theme background", () => {
      // Same accent (mid-blue) on dark and light themes → same on- value.
      const dark = buildPalette("dark", true, TEST_BASE);
      const lightBase = {
        ...TEST_BASE,
        background: new ColorRgba(255, 255, 255),
        foreground: new ColorRgba(0, 0, 0),
      };
      const light = buildPalette("light", false, lightBase);
      expect(dark.get("on-primary")).toEqual(light.get("on-primary"));
    });
  });
});
