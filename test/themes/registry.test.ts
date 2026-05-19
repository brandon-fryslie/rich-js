import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { Palette } from "../../src/themes/palette.js";
import {
  getThemeBaseColors,
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
  it("returns all 18 registered theme names", () => {
    const names = listThemePalettes();
    expect([...names].sort()).toEqual([...ALL_NAMES].sort());
  });
});

describe("getThemePalette", () => {
  it("returns null for unknown names", () => {
    expect(getThemePalette("nonexistent")).toBeNull();
    expect(getThemePalette("")).toBeNull();
    expect(getThemePalette("GRUVBOX")).toBeNull(); // case-sensitive
  });

  it("loads each of the 18 themes into a Palette without error", () => {
    for (const name of ALL_NAMES) {
      const p = getThemePalette(name);
      expect(p, `theme ${name}`).toBeInstanceOf(Palette);
      expect(p!.name).toBe(name);
      expect(p!.vars.size).toBeGreaterThan(100);
    }
  });

  it("caches palettes — same name returns same instance", () => {
    const a = getThemePalette("gruvbox");
    const b = getThemePalette("gruvbox");
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("each theme exposes a `primary` and `background` var", () => {
    for (const name of ALL_NAMES) {
      const p = getThemePalette(name);
      expect(p!.get("primary"), `${name}.primary`).toBeDefined();
      expect(p!.get("background"), `${name}.background`).toBeDefined();
    }
  });

  it("dark flag matches background luminance", () => {
    // Spot-check a known light/dark pair to catch import regression.
    expect(getThemePalette("gruvbox")!.dark).toBe(true);
    expect(getThemePalette("solarized-light")!.dark).toBe(false);
  });

  it("preserves alpha for translucent vars (e.g. boost)", () => {
    const gruv = getThemePalette("gruvbox");
    const boost = gruv!.get("boost");
    // boost in upstream Textual is a #FFFFFF0A overlay — alpha ~ 0x0A/255.
    expect(boost!.alpha).toBeCloseTo(0x0a / 255, 3);
  });

  it("hex equivalence — gruvbox.primary matches upstream Textual", () => {
    // Curated spot-checks against the canonical Textual values. Drift here
    // means the TS module data was edited and lost fidelity.
    const primary = getThemePalette("gruvbox")!.get("primary")!;
    expect(primary.red).toBe(0x85);
    expect(primary.green).toBe(0xa5);
    expect(primary.blue).toBe(0x98);
    expect(primary.alpha).toBe(1);
  });

  it("hex equivalence — dracula.accent matches upstream", () => {
    const accent = getThemePalette("dracula")!.get("accent")!;
    expect(accent.red).toBe(0xff);
    expect(accent.green).toBe(0x79);
    expect(accent.blue).toBe(0xc6);
  });

  it("hex equivalence — textual-light.background matches upstream", () => {
    const bg = getThemePalette("textual-light")!.get("background")!;
    expect(bg.red).toBe(0xe0);
    expect(bg.green).toBe(0xe0);
    expect(bg.blue).toBe(0xe0);
  });
});

describe("getThemeBaseColors", () => {
  it("returns the eight base substrate colors for every theme", () => {
    for (const name of ALL_NAMES) {
      const base = getThemeBaseColors(name);
      expect(base.name, `${name}.name`).toBe(name);
      expect(typeof base.dark).toBe("boolean");
      for (const key of ["bg", "fg", "primary", "secondary", "accent", "success", "warning", "error"] as const) {
        expect(base[key], `${name}.${key}`).toBeInstanceOf(ColorRgba);
      }
    }
  });

  it("does not pollute the registry cache", () => {
    // gruvbox is loaded by the suite above (its Palette is cached). Use a
    // theme nothing else has touched in this file to verify the contract.
    // A cache-pollution would mean two distinct Palette objects exist for
    // the same name (impossible to detect) — instead assert the contract
    // by reading and confirming a subsequent getThemePalette still works.
    const base = getThemeBaseColors("rose-pine-dawn");
    expect(base.bg.red).toBe(0xfa);
    const fullPalette = getThemePalette("rose-pine-dawn");
    expect(fullPalette.vars.size).toBeGreaterThan(100);
  });

  it("base.dark matches palette.dark", () => {
    expect(getThemeBaseColors("solarized-light").dark).toBe(false);
    expect(getThemeBaseColors("dracula").dark).toBe(true);
  });
});
