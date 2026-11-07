/**
 * `textOn`: a theme's text drawn on whatever ground it sits on. Measured over
 * every shade every bundled palette names, because those are the grounds a
 * consumer (cc-candybar's bar) actually paints.
 */
import { describe, it, expect } from "vitest";
import { ColorDepth, ColorRgba, ColorSpec, resolveTerminal } from "../../src/core/color.js";
import { contrastRatio } from "../../src/themes/colorMath.js";
import { buildPalette } from "../../src/themes/buildPalette.js";
import { getThemePalette, listThemePalettes, type ThemeName } from "../../src/themes/registry.js";
import { named, neutralAlpha, readsOn, slide, textFloor, textOn, tinted, withAlpha, writeText, TEXT_INTENTS, type TextFit, type TextIntent, type TextRequest } from "../../src/themes/text-on.js";

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

  // The palette's `foreground-disabled` is its tint already drawn on
  // `background`; on dracula's `secondary` that grey is 1.07:1, invisible.
  it("draws disabled text as a tint of the foreground on the ground it is on", () => {
    const dracula = getThemePalette("dracula");
    const ground = dracula.get("secondary");
    const disabled = textOn(dracula, "foreground-disabled", ground);
    expect(disabled).toEqual(withAlpha(dracula.get("foreground"), neutralAlpha("text-disabled")).compositeOver(ground));
    expect(contrastRatio(disabled, ground)).toBeGreaterThan(contrastRatio(dracula.get("foreground-disabled"), ground));
  });

  it("draws foreground-disabled and text-disabled alike where the foreground is the ground's pole", () => {
    const light = buildPalette("light", false, { ...BASE, background: new ColorRgba(250, 250, 250), foreground: new ColorRgba(0, 0, 0) });
    const white = new ColorRgba(255, 255, 255);
    expect(textOn(light, "foreground-disabled", white)).toEqual(textOn(light, "text-disabled", white));
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
  // A caller that rounds both colors itself — `readsOn` does, by the one rule
  // the writer rounds by — measures the pair `writeText` wrote: at the floor, or
  // the most the table reaches on that ground.
  it.each(listThemePalettes().flatMap((name) => [[name, "sixteen", ColorDepth.STANDARD], [name, "256", ColorDepth.EIGHT_BIT]] as const))("%s at %s colors", (name, _depth, depth) => {
    const { palette, grounds: all } = grounds(name);
    const drawnAt = { depth };
    const shown = (c: ColorRgba) => ColorSpec.fromRgba(c).downgrade(depth).getTruecolor(undefined, false);
    for (const ground of all) {
      for (const intent of ["text-error", "foreground"] as const) {
        const best = Math.max(...ColorSpec.indexed(depth, resolveTerminal(undefined, depth)).map(([, c]) => contrastRatio(c, shown(ground))));
        const floor = Math.min(textFloor(intent), best);
        expect(readsOn(textOn(palette, intent, ground, { drawnAt }), ground, floor - 1e-9, drawnAt), `${intent} on ${ground.hex}`).toBe(true);
      }
    }
  });
});

describe("at truecolor a translucent ground", () => {
  it("is written drawn on the palette's background, as the text is measured on it", () => {
    const palette = getThemePalette("nord");
    const ground = withAlpha(palette.get("primary"), 0.5);
    expect(writeText(palette, "text", ground).bgcolor.getTruecolor().hex).toBe(ground.compositeOver(palette.get("background")).hex);
  });
});
