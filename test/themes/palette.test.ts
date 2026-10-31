import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { getThemePalette } from "../../src/themes/registry.js";
import { Palette, drawnOn, type PaletteRoles } from "../../src/themes/palette.js";

describe("Palette", () => {
  const primary = new ColorRgba(133, 165, 152);
  const roles = (stated: Partial<PaletteRoles>): PaletteRoles => ({
    ...getThemePalette("default").mapRoles((colour) => colour),
    ...stated,
  });

  it("stores name and dark flag", () => {
    const p = new Palette("gruvbox", true, roles({}));
    expect(p.name).toBe("gruvbox");
    expect(p.dark).toBe(true);
  });

  it("get(role) returns the matching ColorRgba", () => {
    const p = new Palette("t", false, roles({ primary }));
    expect(p.get("primary")).toBe(primary);
  });

  it("get(key) returns undefined for a key that is no role (no exception, no default)", () => {
    const p = new Palette("t", true, roles({}));
    expect(p.get("nonexistent")).toBeUndefined();
  });

  it("get(key) is case-sensitive", () => {
    const p = new Palette("t", true, roles({}));
    expect(p.get("Primary")).toBeUndefined();
    expect(p.get("PRIMARY")).toBeUndefined();
  });

  it("draws a translucent role onto the palette's background", () => {
    const background = new ColorRgba(200, 200, 200);
    const tint = new ColorRgba(0, 0, 0, 0.5);
    const p = new Palette("t", false, roles({ background, boost: tint }));
    expect(p.get("boost")).toEqual(new ColorRgba(100, 100, 100));
  });

  it("hands out a fully transparent role as itself", () => {
    const nothing = new ColorRgba(0, 0, 0, 0);
    expect(new Palette("t", false, roles({ "link-background": nothing })).get("link-background")).toEqual(nothing);
  });

  it("mapRoles puts every role through the function and says which it is", () => {
    const p = getThemePalette("nord");
    const mapped = p.mapRoles((colour, role) => (role === "primary" ? primary : colour));
    expect(mapped.primary).toBe(primary);
    expect(mapped.accent).toBe(p.get("accent"));
    expect(Object.keys(mapped)).toEqual([...p.vars.keys()]);
  });

  it("draws a tint onto the background, and a fully transparent colour as itself", () => {
    // drawnOn is what buildPalette and getThemeBaseColors draw through too, so
    // every producer of palette colours reads #00000000 the same way.
    const draw = drawnOn("t", new ColorRgba(200, 200, 200));
    expect(draw(new ColorRgba(0, 0, 0, 0))).toEqual(new ColorRgba(0, 0, 0, 0));
    expect(draw(new ColorRgba(0, 0, 0, 0.5))).toEqual(new ColorRgba(100, 100, 100));
  });

  it("refuses a translucent background", () => {
    const background = new ColorRgba(200, 200, 200, 0.5);
    expect(() => new Palette("t", false, roles({ background }))).toThrow(/must be opaque/);
  });
});
