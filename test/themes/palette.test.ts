import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { Palette } from "../../src/themes/palette.js";

describe("Palette", () => {
  const primary = new ColorRgba(133, 165, 152);
  const accent = new ColorRgba(254, 128, 25);

  it("stores name, dark flag, and vars", () => {
    const p = new Palette(
      "gruvbox",
      true,
      new Map([
        ["primary", primary],
        ["accent", accent],
      ]),
    );
    expect(p.name).toBe("gruvbox");
    expect(p.dark).toBe(true);
    expect(p.vars.size).toBe(2);
  });

  it("get(key) returns the matching ColorRgba", () => {
    const p = new Palette("t", false, new Map([["primary", primary]]));
    expect(p.get("primary")).toBe(primary);
  });

  it("get(key) returns undefined for missing keys (no exception, no default)", () => {
    const p = new Palette("t", true, new Map([["primary", primary]]));
    expect(p.get("nonexistent")).toBeUndefined();
  });

  it("get(key) is case-sensitive", () => {
    const p = new Palette("t", true, new Map([["primary", primary]]));
    expect(p.get("Primary")).toBeUndefined();
    expect(p.get("PRIMARY")).toBeUndefined();
  });

  it("draws a translucent var onto the palette's background", () => {
    const background = new ColorRgba(200, 200, 200);
    const tint = new ColorRgba(0, 0, 0, 0.5);
    const p = new Palette("t", false, new Map([["background", background], ["hover", tint]]));
    expect(p.get("hover")).toEqual(new ColorRgba(100, 100, 100));
  });

  it("refuses a translucent var when there is no background to draw it on", () => {
    const tint = new ColorRgba(0, 0, 0, 0.5);
    expect(() => new Palette("t", false, new Map([["hover", tint]]))).toThrow(/hover is translucent/);
  });

  it("hands out a fully transparent var as itself, with or without a background", () => {
    const nothing = new ColorRgba(0, 0, 0, 0);
    expect(new Palette("t", false, new Map([["background", new ColorRgba(200, 200, 200)], ["link-background", nothing]])).get("link-background")).toEqual(nothing);
    expect(new Palette("t", false, new Map([["link-background", nothing]])).get("link-background")).toEqual(nothing);
  });

  it("refuses a translucent background", () => {
    const background = new ColorRgba(200, 200, 200, 0.5);
    expect(() => new Palette("t", false, new Map([["background", background]]))).toThrow(/must be opaque/);
  });

  it("supports empty palettes", () => {
    const p = new Palette("empty", false, new Map());
    expect(p.vars.size).toBe(0);
    expect(p.get("anything")).toBeUndefined();
  });
});
