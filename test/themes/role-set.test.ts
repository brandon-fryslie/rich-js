import { describe, it, expect } from "vitest";
import { ColorRgba, TerminalTheme, blendRgb, contrastRatio, parseHexColor, relativeLuminance } from "../../src/core/color.js";
import { THEMES } from "../../src/themes/data/index.js";
import { IDENTITY } from "../../src/core/oklch.js";
import { BASE_KEYS, PALETTE_ROLES, buildPalette } from "../../src/themes/buildPalette.js";
import type { Palette, PaletteRole, ShadedRole } from "../../src/themes/palette.js";
import { getThemePalette, listThemePalettes } from "../../src/themes/registry.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { adjustPalette } from "../../src/themes/adjust.js";
import { derivedFrom } from "./derived-palette.js";

const authored = listThemePalettes().map((name) => getThemePalette(name));
const derived = authored.map(derivedFrom);
const terminals = Object.values(terminalThemes).filter((value) => value instanceof TerminalTheme);
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
  adjustPalette(built, IDENTITY),
  adjustPalette(getThemePalette("nord"), { hueShift: 30, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 }),
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
  });
});

describe("a bundled theme's name means one palette", () => {
  it("every registry theme has a TerminalTheme", () => {
    expect(terminals.map((theme) => theme.palette.name).sort()).toEqual([...listThemePalettes()].sort());
  });

  it.each(terminals.map((theme) => [theme.palette.name, theme] as const))("%s", (name, theme) => {
    expect(theme.palette).toBe(getThemePalette(name));
  });
});

describe("a role's ladder", () => {
  // `boost` is a layer, so a rung of it can composite to the same color as its neighbour.
  const roots = PALETTE_ROLES.flatMap((role) => (role.endsWith("-lighten-1") && role !== "boost-lighten-1" ? [role.slice(0, -"-lighten-1".length) as ShadedRole] : []));

  it.each(authored.map((palette) => [palette.name, palette] as const))("steps through its root on %s", (_name, palette) => {
    const lit = (role: PaletteRole) => relativeLuminance(palette.get(role));
    const astray = roots.filter((root) => {
      const steps = [
        lit(`${root}-darken-3`),
        lit(`${root}-darken-2`),
        lit(`${root}-darken-1`),
        lit(root),
        lit(`${root}-lighten-1`),
        lit(`${root}-lighten-2`),
        lit(`${root}-lighten-3`),
      ];
      return steps[0]! >= steps[6]! || steps.some((step, i) => i > 0 && step < steps[i - 1]!);
    });
    expect(astray).toEqual([]);
  });
});

describe("a stated role", () => {
  it("keeps its color, and what is derived from it follows", () => {
    const panel = new ColorRgba(1, 2, 3);
    const palette = buildPalette("stated", true, { ...base, panel });
    expect(palette.get("panel")).toEqual(panel);
    expect(palette.get("footer-background")).toEqual(panel);
    expect(palette.get("panel-lighten-1")).not.toEqual(built.get("panel-lighten-1"));
  });
});

describe("what buildPalette is given", () => {
  it("a role holding undefined is not stated", () => {
    expect(buildPalette("t", true, { ...base, panel: undefined }).get("panel")).toEqual(built.get("panel"));
  });

  it("a key that names no role is refused by name", () => {
    const overrides = { "scrollbar-color": new ColorRgba(1, 2, 3) };
    expect(() => buildPalette("t", true, { ...base, ...overrides })).toThrow(/"t": "scrollbar-color" is not a role$/);
  });

  it.each(["text", "text-muted", "text-disabled", "on-primary"])("Textual's ground-relative %s points at textOn", (role) => {
    const overrides = { [role]: new ColorRgba(1, 2, 3) };
    expect(() => buildPalette("t", true, { ...base, ...overrides })).toThrow(/is not a role — text drawn relative to its ground is `textOn/);
  });

  it("a cursor's text is chosen on the cursor", () => {
    const cursor = new ColorRgba(250, 250, 240);
    const palette = buildPalette("t", true, { ...base, "block-cursor-background": cursor });
    // A light cursor on a dark palette whose primary is mid-blue: text chosen
    // for `primary` would be white, and white does not read on this cursor.
    expect(contrastRatio(palette.get("block-cursor-foreground"), cursor)).toBeGreaterThanOrEqual(4.5);
  });

  it("a stated translucent text-* composites over its own *-muted", () => {
    const tint = new ColorRgba(235, 242, 255, 0xdd / 255);
    const palette = buildPalette("t", true, { ...base, "text-primary": tint });
    expect(palette.get("text-primary").hex).toBe(tint.compositeOver(palette.get("primary-muted")).hex);
  });

  // Every bundled theme that states a cursor or hovered link's text as a tint
  // shows it on the cursor and the hovered link, not on `background`.
  const drawnOnItsGround = listThemePalettes().flatMap((name) =>
    (
      [
        ["block-cursor-foreground", "block-cursor-background"],
        ["link-color-hover", "link-background-hover"],
      ] as const
    ).flatMap(([text, ground]) => {
      const stated = THEMES[name].vars[text];
      return stated === undefined ? [] : [{ name, text, ground, stated }];
    }),
  );
  it.each(drawnOnItsGround)("$name draws $text on $ground", ({ name, text, ground, stated }) => {
    const palette = getThemePalette(name);
    const color = parseHexColor(stated);
    expect(palette.get(text).hex).toBe(color.compositeOver(palette.get(ground).compositeOver(palette.get("background"))).hex);
  });
});

describe("a stated role is read as it is drawn", () => {
  const light = { ...base, background: new ColorRgba(240, 240, 235), foreground: new ColorRgba(30, 30, 30) };

  it("a translucent ground is measured as the color it draws", () => {
    const palette = buildPalette("t", false, { ...light, "primary-muted": new ColorRgba(0, 0, 0, 0.1) });
    expect(contrastRatio(palette.get("text-primary"), palette.get("primary-muted"))).toBeGreaterThanOrEqual(4.5);
  });

  it("what is derived from a translucent role follows the color it draws", () => {
    const surface = new ColorRgba(255, 255, 255, 0.1);
    const opaque = surface.compositeOver(base.background);
    expect(buildPalette("t", true, { ...base, surface }).get("panel")).toEqual(buildPalette("t", true, { ...base, surface: opaque }).get("panel"));
  });

  it("boost stays the layer panel composites", () => {
    const boost = new ColorRgba(255, 255, 255, 0.5);
    const palette = buildPalette("t", true, { ...base, boost });
    expect(palette.get("panel")).toEqual(boost.compositeOver(blendRgb(palette.get("surface"), palette.get("primary"), 0.1)));
  });

  it("a muted that draws nothing leaves its text on background", () => {
    const palette = buildPalette("t", false, { ...light, "primary-muted": new ColorRgba(0, 0, 0, 0) });
    expect(contrastRatio(palette.get("text-primary"), palette.get("background"))).toBeGreaterThanOrEqual(4.5);
  });

  it("a stated text-* is held to read on its muted", () => {
    const palette = buildPalette("t", true, { ...base, "text-primary": new ColorRgba(40, 40, 40) });
    expect(contrastRatio(palette.get("text-primary"), palette.get("primary-muted"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("what a role is drawn on decides it", () => {
  it("panel takes boost only on a dark palette, as Textual's does", () => {
    const light = buildPalette("t", false, { ...base, background: new ColorRgba(240, 240, 235), foreground: new ColorRgba(30, 30, 30) });
    expect(light.get("panel")).toEqual(blendRgb(light.get("surface"), light.get("primary"), 0.1));
  });

  it.each(derived.map((palette) => [palette.name, palette] as const))("%s: the pairs on primary read", (_name, palette) => {
    const ground = palette.get("primary");
    for (const role of ["block-cursor-foreground", "link-color-hover", "button-color-foreground"] as const) {
      expect(contrastRatio(palette.get(role), ground), role).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(derived.map((palette) => [palette.name, palette] as const))("%s: the smallest heading reads", (_name, palette) => {
    expect(contrastRatio(palette.get("markdown-h6-color"), palette.get("background"))).toBeGreaterThanOrEqual(3);
  });
});

describe("a derived ladder continues the authored ones", () => {
  // Textual's generator drew these rungs from each theme's own colors, so the
  // rule run on a theme's bases lands on the authored rung.
  const RUNGS = ["darken-1", "darken-2", "darken-3", "lighten-1", "lighten-2", "lighten-3"] as const;

  it.each(["textual-dark", "textual-light", "nord", "dracula"])("%s", (name) => {
    const theme = getThemePalette(name)!;
    const rederived = derivedFrom(theme);
    for (const root of BASE_KEYS) {
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
