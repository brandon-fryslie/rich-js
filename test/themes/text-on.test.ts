/**
 * `textOn`: a theme's text drawn on whatever ground it sits on. Measured over
 * every shade every bundled palette names, because those are the grounds a
 * consumer (cc-candybar's bar) actually paints.
 */
import { describe, it, expect } from "vitest";
import { ColorDepth, ColorRgba } from "../../src/core/color.js";
import { contrastRatio } from "../../src/themes/colorMath.js";
import { buildPalette } from "../../src/themes/buildPalette.js";
import { getThemePalette, listThemePalettes, type ThemeName } from "../../src/themes/registry.js";
import { named, readsOn, slide, textFloor, textOn, tinted, TEXT_INTENTS, type TextFit, type TextIntent, type TextRequest } from "../../src/themes/text-on.js";

const FLOOR: Readonly<Record<TextIntent, number>> = {
  foreground: 4.5,
  "foreground-muted": 3,
  "foreground-disabled": 0,
  text: 4.5,
  "text-muted": 3,
  "text-disabled": 0,
  "text-primary": 4.5,
  "text-secondary": 4.5,
  "text-accent": 4.5,
  "text-success": 4.5,
  "text-warning": 4.5,
  "text-error": 4.5,
};

/** Every opaque color a palette names: the grounds a consumer can paint. */
const grounds = (name: ThemeName) => {
  const palette = getThemePalette(name);
  const colors = new Map([...palette.vars.values()].filter((c) => c.alpha === 1).map((c) => [c.hex, c]));
  return { palette, grounds: [...colors.values()] };
};

const BASE = {
  primary: new ColorRgba(0, 102, 204),
  secondary: new ColorRgba(120, 80, 200),
  accent: new ColorRgba(255, 166, 43),
  success: new ColorRgba(80, 200, 120),
  warning: new ColorRgba(255, 215, 0),
  error: new ColorRgba(128, 0, 0),
  background: new ColorRgba(30, 30, 30),
  foreground: new ColorRgba(230, 230, 230),
};

describe("textOn — Textual's ground-relative text", () => {
  const palette = buildPalette("test", true, BASE);

  it("is dark on a pale accent and light on a deep one", () => {
    expect(contrastRatio(textOn(palette, "text", palette.get("warning")), new ColorRgba(0, 0, 0))).toBeLessThan(2);
    expect(contrastRatio(textOn(palette, "text", palette.get("error")), new ColorRgba(255, 255, 255))).toBeLessThan(2);
  });

  it("depends on the ground, not on the theme it came from", () => {
    const light = buildPalette("light", false, { ...BASE, background: new ColorRgba(250, 250, 250), foreground: new ColorRgba(20, 20, 20) });
    expect(textOn(light, "text", BASE.primary)).toEqual(textOn(palette, "text", BASE.primary));
  });

  it("draws a theme's tinted text exactly as the theme names it where Textual promises it reads", () => {
    for (const ground of ["background", "surface", "panel", "primary-muted"] as const) {
      expect(textOn(palette, "text-primary", palette.get(ground))).toEqual(palette.get("text-primary").compositeOver(palette.get(ground)));
    }
  });
});

describe.each([
  ["slide", slide],
  ["tinted", tinted],
] as const)("the %s fit holds every floor on every shade a bundled palette names", (_name, fit) => {
  it.each(listThemePalettes())("%s", (name) => {
    const { palette, grounds: all } = grounds(name);
    for (const ground of all) {
      for (const intent of TEXT_INTENTS) {
        expect(contrastRatio(textOn(palette, intent, ground, { fit }), ground), `${intent} on ${ground.hex}`).toBeGreaterThanOrEqual(FLOOR[intent]);
      }
    }
  });
});

describe("the named fit draws only colors the theme names", () => {
  it.each(listThemePalettes())("%s", (name) => {
    const { palette, grounds: all } = grounds(name);
    const namedColors = new Set([...palette.vars.values()].map((c) => c.hex));
    for (const ground of all) {
      for (const intent of TEXT_INTENTS) {
        const drawn = textOn(palette, intent, ground, { fit: named });
        // Either the intent's own text read there, or the fit took a shade the theme names.
        const reads = contrastRatio(drawn, ground) >= FLOOR[intent];
        expect(reads || namedColors.has(drawn.hex), `${intent} on ${ground.hex}`).toBe(true);
      }
    }
  });
});

describe("textFloor", () => {
  it("is the floor each intent is held to", () => {
    for (const intent of TEXT_INTENTS) expect(textFloor(intent), intent).toBe(FLOOR[intent]);
  });
});

describe("a fit is any function", () => {
  const palette = getThemePalette("textual-dark");

  it("is asked only when the candidate misses its floor, and is handed opaque colors on the ground", () => {
    const asked: TextRequest[] = [];
    const record: TextFit = (request) => (asked.push(request), request.candidate);
    textOn(palette, "text-primary", palette.get("primary-muted"), { fit: record });
    expect(asked).toEqual([]);
    textOn(palette, "text-primary", palette.get("primary"), { fit: record });
    expect(asked).toHaveLength(1);
    const [request] = asked;
    expect(request!.floor).toBe(4.5);
    expect([request!.candidate, request!.ground, ...request!.shades].every((c) => c.alpha === 1)).toBe(true);
  });

  it("hands an accent's shades nearest first, both directions at each step out", () => {
    const asked: TextRequest[] = [];
    textOn(palette, "text-primary", palette.get("primary"), { fit: (request) => (asked.push(request), request.candidate) });
    const ground = palette.get("primary");
    const rung = (direction: string, n: number) => palette.get(`primary-${direction}-${n}` as "primary-lighten-1").compositeOver(ground).hex;
    const steps = asked[0]!.shades.slice(2).map((c) => c.hex);
    for (const [i, n] of [1, 2, 3].entries()) {
      expect(new Set(steps.slice(2 * i, 2 * i + 2))).toEqual(new Set([rung("lighten", n), rung("darken", n)]));
    }
  });

  it("named refuses a request that names no shades", () => {
    const request = { candidate: palette.get("primary"), ground: palette.get("background"), floor: 99, drawnAt: { depth: ColorDepth.TRUECOLOR }, tint: palette.get("primary"), shades: [] };
    expect(() => named(request)).toThrow(/names no shades/);
  });

  it("is never asked for disabled text, which has no floor", () => {
    const refuse: TextFit = () => {
      throw new Error("asked");
    };
    for (const ground of grounds("nord").grounds) {
      expect(() => textOn(palette, "text-disabled", ground, { fit: refuse })).not.toThrow();
    }
  });
});

describe("below truecolor the floor holds on the pair the terminal draws", () => {
  it.each(listThemePalettes())("%s at 256 colors", (name) => {
    const { palette, grounds: all } = grounds(name);
    const drawnAt = { depth: ColorDepth.EIGHT_BIT };
    for (const ground of all) {
      expect(readsOn(textOn(palette, "text-error", ground, { drawnAt }), ground, 4.5, drawnAt), ground.hex).toBe(true);
    }
  });
});
