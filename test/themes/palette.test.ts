import { describe, it, expect } from "vitest";
import { ColorQuad } from "../../src/core/color.js";
import { Palette } from "../../src/themes/palette.js";

describe("Palette", () => {
  const primary = new ColorQuad(133, 165, 152, 1);
  const accent = new ColorQuad(254, 128, 25, 1);
  const boost = new ColorQuad(255, 255, 255, 0x0a / 255);

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

  it("get(key) returns the matching ColorQuad", () => {
    const p = new Palette("t", false, new Map([["primary", primary]]));
    expect(p.get("primary")).toBe(primary);
  });

  it("get(key) preserves alpha for translucent vars", () => {
    const p = new Palette("t", true, new Map([["boost", boost]]));
    const got = p.get("boost");
    expect(got).toBeDefined();
    expect(got!.alpha).toBeCloseTo(0x0a / 255);
  });

  it("get(key) returns undefined for missing keys", () => {
    const p = new Palette("t", true, new Map([["primary", primary]]));
    expect(p.get("nonexistent")).toBeUndefined();
  });

  it("get(key) is case-sensitive", () => {
    const p = new Palette("t", true, new Map([["primary", primary]]));
    expect(p.get("Primary")).toBeUndefined();
  });

  it("supports empty palettes", () => {
    const p = new Palette("empty", false, new Map());
    expect(p.vars.size).toBe(0);
    expect(p.get("anything")).toBeUndefined();
  });
});

describe("Palette.fromHex", () => {
  it("parses 6-char hex as fully opaque", () => {
    const p = Palette.fromHex("gruvbox", true, {
      primary: "#85A598",
      accent: "#FE8019",
    });
    expect(p.get("primary")!.alpha).toBe(1);
    expect(p.get("primary")!.red).toBe(0x85);
    expect(p.get("accent")!.green).toBe(0x80);
  });

  it("parses 8-char hex with alpha", () => {
    const p = Palette.fromHex("t", true, { boost: "#FFFFFF0A" });
    const q = p.get("boost")!;
    expect(q.red).toBe(255);
    expect(q.alpha).toBeCloseTo(0x0a / 255);
  });

  it("accepts mixed 6 and 8 char entries", () => {
    const p = Palette.fromHex("t", true, {
      primary: "85A598",
      boost: "#FFFFFF0A",
    });
    expect(p.get("primary")!.alpha).toBe(1);
    expect(p.get("boost")!.alpha).toBeCloseTo(0x0a / 255);
  });

  it("throws on malformed hex (data-import bugs surface loudly)", () => {
    expect(() => Palette.fromHex("t", true, { bad: "not-hex" })).toThrow();
    expect(() => Palette.fromHex("t", true, { bad: "#FFF" })).toThrow();
  });

  it("preserves the dark hint", () => {
    expect(Palette.fromHex("t", true, {}).dark).toBe(true);
    expect(Palette.fromHex("t", false, {}).dark).toBe(false);
  });
});
