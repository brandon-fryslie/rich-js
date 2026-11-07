import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { buildPalette } from "../../src/themes/buildPalette.js";
import { contrastFor, contrastRatio } from "../../src/themes/colorMath.js";
import { getThemeBaseColors, getThemePalette, listThemePalettes } from "../../src/themes/registry.js";

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

  it("draws a translucent base color onto the background before deriving from it", () => {
    // 10% black on white is a pale grey, which wants dark text — a cursor's
    // text is dark exactly when white is what contrasts with it; over the
    // terminal's black it would be black and want white text.
    const white = new ColorRgba(255, 255, 255);
    const p = buildPalette("light", false, { ...TEST_BASE, background: white, primary: new ColorRgba(0, 0, 0, 0.1) });
    expect(p.get("primary")).toEqual(new ColorRgba(230, 230, 230));
    expect(contrastFor(p.get("block-cursor-foreground"))).toEqual(new ColorRgba(255, 255, 255));
  });

  it("refuses a fully transparent base color: there is no color to derive *-muted or text-* from", () => {
    const white = new ColorRgba(255, 255, 255);
    expect(() => buildPalette("light", false, { ...TEST_BASE, background: white, primary: new ColorRgba(0, 0, 0, 0) }))
      .toThrow(/primary is fully transparent/);
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

  it("derives foreground-muted and background-muted for the two base roles", () => {
    const p = buildPalette("test", true, TEST_BASE);
    const fgMuted = p.get("foreground-muted")!;
    // Muted foreground (white, blended 70% toward black bg) should be
    // dimmer than plain foreground but still brighter than background.
    expect(fgMuted.red).toBeLessThan(TEST_BASE.foreground.red);
    expect(fgMuted.red).toBeGreaterThan(TEST_BASE.background.red);

    const bgMuted = p.get("background-muted")!;
    // Muted background (black, blended 70% toward white fg) should be
    // brighter than plain background but still darker than foreground.
    expect(bgMuted.red).toBeGreaterThan(TEST_BASE.background.red);
    expect(bgMuted.red).toBeLessThan(TEST_BASE.foreground.red);
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
    }
  });
});

// Muted text is secondary text and disabled text is text that cannot be used,
// so muted reads the stronger, as every authored theme has it. Muted is held to
// its floor and disabled is a fixed tint, so this is not true by construction.
describe.each(listThemePalettes())("a palette derived from %s's base colors", (name) => {
  it("draws foreground-muted stronger on background than foreground-disabled", () => {
    const { bg, fg, primary, secondary, accent, success, warning, error } = getThemeBaseColors(name);
    const p = buildPalette(name, getThemePalette(name).dark, { background: bg, foreground: fg, primary, secondary, accent, success, warning, error });
    const background = p.get("background");
    const on = (role: "foreground-muted" | "foreground-disabled"): number => contrastRatio(p.get(role).compositeOver(background), background);
    expect(on("foreground-muted")).toBeGreaterThan(on("foreground-disabled"));
  });
});
