import { describe, it, expect } from "vitest";
import { ColorRgba, TerminalTheme } from "../../src/core/color.js";
import { IDENTITY } from "../../src/core/oklch.js";
import { PALETTE_ROLES, buildPalette } from "../../src/themes/buildPalette.js";
import type { Palette } from "../../src/themes/palette.js";
import { getThemePalette, listThemePalettes } from "../../src/themes/registry.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { transposePalette } from "../../src/themes/transpose.js";

const authored = listThemePalettes().map((name) => getThemePalette(name));
const derived = Object.values(terminalThemes)
  .filter((value) => value instanceof TerminalTheme)
  .map((theme) => theme.palette);
const base = {
  primary: new ColorRgba(80, 140, 200),
  secondary: new ColorRgba(120, 90, 200),
  accent: new ColorRgba(220, 180, 60),
  success: new ColorRgba(60, 180, 80),
  warning: new ColorRgba(230, 160, 30),
  error: new ColorRgba(220, 60, 60),
  background: new ColorRgba(30, 30, 40),
  foreground: new ColorRgba(220, 220, 230),
};
const built = buildPalette("built", true, base);

// Every road to a palette. A new one belongs here.
const palettes: readonly Palette[] = [
  ...authored,
  ...derived,
  built,
  buildPalette("light", false, { ...base, background: new ColorRgba(240, 240, 235), foreground: new ColorRgba(30, 30, 30) }),
  buildPalette("stated", true, { ...base, panel: new ColorRgba(1, 2, 3) }),
  transposePalette(built, IDENTITY),
  transposePalette(getThemePalette("nord"), { hueShift: 30, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 }),
];

describe("every palette has the same roles", () => {
  it("reaches the bundled palettes and the derived ones", () => {
    expect(authored.length).toBeGreaterThan(0);
    expect(derived.length).toBeGreaterThan(0);
  });

  it.each(palettes.map((palette) => [palette.name, palette] as const))("%s", (_name, palette) => {
    expect([...palette.vars.keys()].sort()).toEqual([...PALETTE_ROLES].sort());
  });

  it("names no role twice", () => {
    expect(new Set(PALETTE_ROLES).size).toBe(PALETTE_ROLES.length);
  });

  it("the roles the cc-candybar bar asked for are on an authored theme", () => {
    const tokyo = getThemePalette("tokyo-night");
    expect(tokyo.get("background-muted")).toBeInstanceOf(ColorRgba);
    expect(tokyo.get("on-primary")).toBeInstanceOf(ColorRgba);
  });
});

describe("a stated role", () => {
  it("keeps its colour, and what is derived from it follows", () => {
    const panel = new ColorRgba(1, 2, 3);
    const palette = buildPalette("stated", true, { ...base, panel });
    expect(palette.get("panel")).toEqual(panel);
    expect(palette.get("footer-background")).toEqual(panel);
    expect(palette.get("panel-lighten-1")).not.toEqual(built.get("panel-lighten-1"));
  });
});

describe("a derived ladder continues the authored ones", () => {
  // Textual's generator drew these rungs from each theme's own colours, so the
  // rule run on a theme's bases lands on the authored rung.
  const ROOTS = ["primary", "secondary", "accent", "success", "warning", "error", "background", "foreground"] as const;
  const RUNGS = ["darken-1", "darken-2", "darken-3", "lighten-1", "lighten-2", "lighten-3"] as const;

  it.each(["textual-dark", "textual-light", "nord", "dracula"])("%s", (name) => {
    const theme = getThemePalette(name)!;
    const rederived = buildPalette(name, theme.dark, Object.fromEntries(ROOTS.map((root) => [root, theme.get(root)])) as typeof base);
    for (const root of ROOTS) {
      for (const rung of RUNGS) {
        const role = `${root}-${rung}` as const;
        const [was, is] = [theme.get(role), rederived.get(role)];
        expect(Math.abs(was.red - is.red), role).toBeLessThanOrEqual(1);
        expect(Math.abs(was.green - is.green), role).toBeLessThanOrEqual(1);
        expect(Math.abs(was.blue - is.blue), role).toBeLessThanOrEqual(1);
      }
    }
  });
});
