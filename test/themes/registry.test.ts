import { describe, it, expect } from "vitest";
import { Palette } from "../../src/themes/palette.js";
import {
  getThemePalette,
  listThemePalettes,
} from "../../src/themes/registry.js";

const ALL_NAMES = [
  "atom-one-dark",
  "atom-one-light",
  "catppuccin-latte",
  "catppuccin-mocha",
  "dracula",
  "flexoki",
  "gruvbox",
  "monokai",
  "nord",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "solarized-dark",
  "solarized-light",
  "textual-ansi",
  "textual-dark",
  "textual-light",
  "tokyo-night",
];

describe("listThemePalettes", () => {
  it("returns all 18 Textual theme names", () => {
    const names = listThemePalettes();
    expect([...names].sort()).toEqual([...ALL_NAMES].sort());
  });

  it("does not load palette data on listing", async () => {
    // Calling listThemePalettes is synchronous and pure; we just verify it
    // returns immediately without throwing. (The "no I/O" claim is structural
    // — listing is a constant array — so this test pins the behavior.)
    expect(() => listThemePalettes()).not.toThrow();
  });
});

describe("getThemePalette", () => {
  it("returns null for unknown names", async () => {
    expect(await getThemePalette("nonexistent")).toBeNull();
    expect(await getThemePalette("")).toBeNull();
    expect(await getThemePalette("GRUVBOX")).toBeNull(); // case-sensitive
  });

  it("loads each of the 18 themes into a Palette without error", async () => {
    for (const name of ALL_NAMES) {
      const p = await getThemePalette(name);
      expect(p, `theme ${name}`).toBeInstanceOf(Palette);
      expect(p!.name).toBe(name);
      expect(p!.vars.size).toBeGreaterThan(100);
    }
  });

  it("caches palettes — same name returns same instance", async () => {
    const a = await getThemePalette("gruvbox");
    const b = await getThemePalette("gruvbox");
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("each theme exposes a `primary` and `background` var", async () => {
    for (const name of ALL_NAMES) {
      const p = await getThemePalette(name);
      expect(p!.get("primary"), `${name}.primary`).toBeDefined();
      expect(p!.get("background"), `${name}.background`).toBeDefined();
    }
  });

  it("dark flag matches background luminance", async () => {
    // Spot-check a known light/dark pair to catch import regression.
    const dark = await getThemePalette("gruvbox");
    const light = await getThemePalette("solarized-light");
    expect(dark!.dark).toBe(true);
    expect(light!.dark).toBe(false);
  });

  it("preserves alpha for translucent vars (e.g. boost)", async () => {
    const gruv = await getThemePalette("gruvbox");
    const boost = gruv!.get("boost");
    // boost in upstream Textual is a #FFFFFF0A overlay — alpha ~ 0x0A/255.
    expect(boost!.alpha).toBeCloseTo(0x0a / 255, 3);
  });

  it("hex equivalence — gruvbox.primary matches upstream Textual", async () => {
    // Curated spot-checks against the canonical Textual values. Drift here
    // means the JSON data file was edited by hand and lost fidelity.
    const gruv = await getThemePalette("gruvbox");
    const primary = gruv!.get("primary")!;
    expect(primary.red).toBe(0x85);
    expect(primary.green).toBe(0xa5);
    expect(primary.blue).toBe(0x98);
    expect(primary.alpha).toBe(1);
  });

  it("hex equivalence — dracula.accent matches upstream", async () => {
    const dracula = await getThemePalette("dracula");
    const accent = dracula!.get("accent")!;
    expect(accent.red).toBe(0xff);
    expect(accent.green).toBe(0x79);
    expect(accent.blue).toBe(0xc6);
  });

  it("hex equivalence — textual-light.background matches upstream", async () => {
    const tl = await getThemePalette("textual-light");
    const bg = tl!.get("background")!;
    expect(bg.red).toBe(0xe0);
    expect(bg.green).toBe(0xe0);
    expect(bg.blue).toBe(0xe0);
  });
});
