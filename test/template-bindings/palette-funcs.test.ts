import { describe, it, expect } from "vitest";
import { createEngine } from "@promptctl/go-template-js";
import { RichText } from "../../src/core/text.js";
import { ColorSpec, ColorRgba } from "../../src/core/color.js";
import { paletteFuncs } from "../../src/template-bindings/palette-funcs.js";
import { richTextFuncs } from "../../src/template-bindings/index.js";
import { PaletteResolver } from "../../src/themes/paletteResolver.js";
import { contrastFor, alphaBlend } from "../../src/themes/colorMath.js";
import { GRUVBOX, DRACULA } from "../../src/themes/terminalThemes.js";

// [LAW:behavior-not-structure] Tests assert the binding contract:
// - semantic name functions produce the expected resolved color
// - `palette` / `paletteOver` / `auto` match PaletteResolver.resolve() semantics
// - theme switching: same template source → different colors under different resolvers

const gruvboxResolver = new PaletteResolver(GRUVBOX.palette);
const draculaResolver = new PaletteResolver(DRACULA.palette);

function makeEngine(resolver: PaletteResolver) {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: { ...richTextFuncs(), ...paletteFuncs(resolver) },
  });
}

const gruvboxEngine = makeEngine(gruvboxResolver);
const draculaEngine = makeEngine(draculaResolver);

function evalOne(engine: ReturnType<typeof makeEngine>, template: string): RichText {
  const result = engine.parse(template).evaluate({});
  expect(result.length).toBe(1);
  return result[0]!;
}

function eqRgb(spec: ColorSpec | undefined, expected: ColorRgba) {
  expect(spec).toBeDefined();
  const got = spec!.getTruecolor();
  expect(got.red).toBe(expected.red);
  expect(got.green).toBe(expected.green);
  expect(got.blue).toBe(expected.blue);
}

// ─── Registration ──────────────────────────────────────────────────────────

describe("paletteFuncs() registration", () => {
  it("registers functions for identifier-safe palette var names", () => {
    const fns = paletteFuncs(gruvboxResolver);
    // Bare semantic names from buildPalette — all identifier-safe
    expect(fns.primary).toBeDefined();
    expect(fns.accent).toBeDefined();
    expect(fns.error).toBeDefined();
    expect(fns.success).toBeDefined();
    expect(fns.warning).toBeDefined();
    expect(fns.secondary).toBeDefined();
    expect(fns.background).toBeDefined();
    expect(fns.foreground).toBeDefined();
    expect(fns.surface).toBeDefined();
  });

  it("does NOT register hyphenated palette names as direct functions", () => {
    const fns = paletteFuncs(gruvboxResolver);
    // Hyphenated names cannot be Go template identifiers
    expect(fns["primary-muted"]).toBeUndefined();
    expect(fns["text-primary"]).toBeUndefined();
  });

  it("registers palette, paletteOver, auto", () => {
    const fns = paletteFuncs(gruvboxResolver);
    expect(fns.palette).toBeDefined();
    expect(fns.paletteOver).toBeDefined();
    expect(fns.auto).toBeDefined();
  });
});

// ─── Semantic name functions ────────────────────────────────────────────────

describe("semantic name functions — gruvbox", () => {
  it("primary resolves to gruvbox primary color", () => {
    const rt = evalOne(gruvboxEngine, `{{ primary "x" }}`);
    const expected = gruvboxResolver.resolve("primary")!;
    eqRgb(rt.style.color, expected);
  });

  it("accent resolves to gruvbox accent color", () => {
    const rt = evalOne(gruvboxEngine, `{{ accent "x" }}`);
    const expected = gruvboxResolver.resolve("accent")!;
    eqRgb(rt.style.color, expected);
  });

  it("error resolves to gruvbox error color", () => {
    const rt = evalOne(gruvboxEngine, `{{ error "x" }}`);
    const expected = gruvboxResolver.resolve("error")!;
    eqRgb(rt.style.color, expected);
  });
});

// ─── Theme switching ────────────────────────────────────────────────────────

describe("theme switching", () => {
  it("same template source produces different colors under gruvbox vs dracula", () => {
    const gruvboxResult = evalOne(gruvboxEngine, `{{ primary "x" }}`);
    const draculaResult = evalOne(draculaEngine, `{{ primary "x" }}`);

    const gruvboxPrimary = gruvboxResult.style.color!.getTruecolor();
    const draculaPrimary = draculaResult.style.color!.getTruecolor();

    // Both resolved but to different values
    expect(gruvboxPrimary).toBeDefined();
    expect(draculaPrimary).toBeDefined();
    expect(gruvboxPrimary.red).not.toBe(draculaPrimary.red);
  });

  it("gruvbox primary matches PaletteResolver.resolve('primary') for GRUVBOX", () => {
    const rt = evalOne(gruvboxEngine, `{{ primary "x" }}`);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary")!);
  });

  it("dracula primary matches PaletteResolver.resolve('primary') for DRACULA", () => {
    const rt = evalOne(draculaEngine, `{{ primary "x" }}`);
    eqRgb(rt.style.color, draculaResolver.resolve("primary")!);
  });
});

// ─── palette function (no against) ─────────────────────────────────────────

describe("palette function", () => {
  it("resolves a bare semantic name", () => {
    const rt = evalOne(gruvboxEngine, `{{ palette "primary" "x" }}`);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary")!);
  });

  it("resolves a hyphenated name", () => {
    const rt = evalOne(gruvboxEngine, `{{ palette "primary-muted" "x" }}`);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary-muted")!);
  });

  it("resolves a darken modifier", () => {
    const rt = evalOne(gruvboxEngine, `{{ palette "primary-darken-3" "x" }}`);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary-darken-3")!);
  });

  it("resolves text- prefixed name", () => {
    const rt = evalOne(gruvboxEngine, `{{ palette "text-accent" "x" }}`);
    eqRgb(rt.style.color, gruvboxResolver.resolve("text-accent")!);
  });

  it("throws on unknown palette variable", () => {
    expect(() => evalOne(gruvboxEngine, `{{ palette "nonexistent" "x" }}`)).toThrow();
  });

  it("throws when spec needs against (alpha)", () => {
    expect(() => evalOne(gruvboxEngine, `{{ palette "primary 50%" "x" }}`)).toThrow(
      /paletteOver/,
    );
  });

  it("throws when spec is auto (needs against)", () => {
    expect(() => evalOne(gruvboxEngine, `{{ palette "auto" "x" }}`)).toThrow(
      /paletteOver/,
    );
  });
});

// ─── paletteOver function (with against) ───────────────────────────────────

const darkBg = new ColorRgba(20, 20, 20);
const lightBg = new ColorRgba(240, 240, 240);
const darkBgHex = "#141414";
const lightBgHex = "#f0f0f0";

describe("paletteOver function", () => {
  it("resolves alpha spec against dark background", () => {
    const rt = evalOne(gruvboxEngine, `{{ paletteOver "primary 50%" "${darkBgHex}" "x" }}`);
    const expected = gruvboxResolver.resolve("primary 50%", { against: darkBg })!;
    eqRgb(rt.style.color, expected);
  });

  it("resolves alpha spec against light background", () => {
    const rt = evalOne(gruvboxEngine, `{{ paletteOver "primary 50%" "${lightBgHex}" "x" }}`);
    const expected = gruvboxResolver.resolve("primary 50%", { against: lightBg })!;
    eqRgb(rt.style.color, expected);
  });

  it("resolves 'auto' against dark background → white-ish contrast", () => {
    const rt = evalOne(gruvboxEngine, `{{ paletteOver "auto" "${darkBgHex}" "x" }}`);
    const expected = contrastFor(darkBg);
    eqRgb(rt.style.color, expected);
    expect(rt.style.color!.getTruecolor().red).toBe(255);
  });

  it("resolves 'auto' against light background → black-ish contrast", () => {
    const rt = evalOne(gruvboxEngine, `{{ paletteOver "auto" "${lightBgHex}" "x" }}`);
    const expected = contrastFor(lightBg);
    eqRgb(rt.style.color, expected);
    expect(rt.style.color!.getTruecolor().red).toBe(0);
  });

  it("resolves 'auto 33%' — blended contrast", () => {
    const rt = evalOne(gruvboxEngine, `{{ paletteOver "auto 33%" "${darkBgHex}" "x" }}`);
    const expected = alphaBlend(contrastFor(darkBg), darkBg, 0.33);
    eqRgb(rt.style.color, expected);
  });

  it("throws on invalid bg hex", () => {
    expect(() =>
      evalOne(gruvboxEngine, `{{ paletteOver "auto" "notahex" "x" }}`),
    ).toThrow(/background expected/);
  });

  it("throws on unknown palette variable (with against)", () => {
    expect(() =>
      evalOne(gruvboxEngine, `{{ paletteOver "ghost 50%" "${darkBgHex}" "x" }}`),
    ).toThrow();
  });
});

// ─── auto function ──────────────────────────────────────────────────────────

describe("auto function", () => {
  it("dark bg → white contrast text", () => {
    const rt = evalOne(gruvboxEngine, `{{ auto "${darkBgHex}" "x" }}`);
    expect(rt.style.color!.getTruecolor().red).toBe(255);
  });

  it("light bg → black contrast text", () => {
    const rt = evalOne(gruvboxEngine, `{{ auto "${lightBgHex}" "x" }}`);
    expect(rt.style.color!.getTruecolor().red).toBe(0);
  });

  it("matches paletteOver 'auto' for the same bg", () => {
    const viaAuto = evalOne(gruvboxEngine, `{{ auto "${darkBgHex}" "x" }}`);
    const viaPaletteOver = evalOne(gruvboxEngine, `{{ paletteOver "auto" "${darkBgHex}" "x" }}`);
    const autoColor = viaAuto.style.color!.getTruecolor();
    const paletteOverColor = viaPaletteOver.style.color!.getTruecolor();
    expect(autoColor.red).toBe(paletteOverColor.red);
    expect(autoColor.green).toBe(paletteOverColor.green);
    expect(autoColor.blue).toBe(paletteOverColor.blue);
  });

  it("throws on invalid bg hex", () => {
    expect(() => evalOne(gruvboxEngine, `{{ auto "bad" "x" }}`)).toThrow(/background expected/);
  });
});

// ─── Composition with style functions ──────────────────────────────────────

describe("composition with style functions", () => {
  it("bold wraps a palette-resolved fragment", () => {
    const rt = evalOne(gruvboxEngine, `{{ bold (primary "x") }}`);
    expect(rt.style.bold).toBe(true);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary")!);
  });

  it("primary wraps a bold fragment — same result, composition is commutative for disjoint slots", () => {
    const rt = evalOne(gruvboxEngine, `{{ primary (bold "x") }}`);
    expect(rt.style.bold).toBe(true);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary")!);
  });

  it("auto wraps a bold fragment", () => {
    const rt = evalOne(gruvboxEngine, `{{ auto "${darkBgHex}" (bold "x") }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.color!.getTruecolor().red).toBe(255);
  });

  it("on wraps a primary fragment — auto-contrast color + explicit background", () => {
    const rt = evalOne(gruvboxEngine, `{{ on "${darkBgHex}" (primary "x") }}`);
    eqRgb(rt.style.color, gruvboxResolver.resolve("primary")!);
    // bgcolor set via the on function
    expect(rt.style.bgcolor).toBeDefined();
  });
});
