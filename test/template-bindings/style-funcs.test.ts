import { describe, it, expect } from "vitest";
import { createEngine, type Engine } from "@promptctl/go-template-js";
import {
  createRichTextEngine,
  richTextFuncs,
  paletteFuncs,
} from "../../src/template-bindings/index.js";
import {
  Style,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_SHORT_ALIASES,
} from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import type { Palette } from "../../src/themes/palette.js";
import { GRUVBOX, DRACULA } from "../../src/themes/terminalThemes.js";
import { darken, lighten, contrastFor, ensureContrast } from "../../src/themes/colorMath.js";
import { blendRgb, ColorRgba } from "../../src/core/color.js";
import { Oklch, IDENTITY, type ThemeKey } from "../../src/core/oklch.js";

// [LAW:behavior-not-structure] Tests assert the binding contract — fragments
// produced by template evaluation are equivalent to fragments produced by
// directly constructing the corresponding Style chain, and colours produced by
// template evaluation are equivalent to colours produced by calling the
// underlying rich-js colour function directly.
//
// The colour surface is three separable pieces and the tests follow that split:
//   `color "name"`  (palette-dependent)  → a hex string
//   `darken` / `mix` / … (palette-free)  → hex string in, hex string out
//   `fg` / `bg`     (sinks)              → paint a colour spec onto a fragment

const engine = createRichTextEngine();

function evalOne(template: string): RichText {
  const result = engine.parse(template).evaluate({});
  expect(result.length).toBe(1);
  return result[0]!;
}

/** Build an engine whose `color` resolves against a caller-controlled palette. */
function makePaletteEngine(getPalette: () => Palette): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: { ...richTextFuncs(), ...paletteFuncs(getPalette) },
  });
}

const gruvbox = GRUVBOX.palette;
const gruvboxEngine = makePaletteEngine(() => gruvbox);

// Backgrounds for the readability functions, built here rather than parsed by
// the module under test, so the expectation is independent of it.
const DARK_BG = new ColorRgba(20, 20, 20);
const LIGHT_BG = new ColorRgba(240, 240, 240);

function evalOneWith(e: Engine<RichText>, template: string): RichText {
  const result = e.parse(template).evaluate({});
  expect(result.length).toBe(1);
  return result[0]!;
}

/** The truecolor hex a fragment's foreground resolves to. */
function fgHex(rt: RichText): string | undefined {
  return rt.style.color?.getTruecolor().hex;
}

// ─── Colour sinks: fg / bg ──────────────────────────────────────────────────

describe("fg / bg accept the whole ColorSpec vocabulary", () => {
  it("fg paints a hex literal as truecolor", () => {
    const rt = evalOne(`{{ fg "#af00ff" "x" }}`);
    expect(rt.plain).toBe("x");
    expect(fgHex(rt)).toBe("#af00ff");
  });

  it("fg preserves the eight-digit RGBA form", () => {
    const rt = evalOne(`{{ fg "#af00ff80" "x" }}`);
    expect(fgHex(rt)).toBe("#af00ff80");
  });

  it("fg paints a symbolic ANSI colour name, matching Style.parse", () => {
    const rt = evalOne(`{{ fg "magenta" "x" }}`);
    expect(rt.style.color?.name).toBe(Style.parse("magenta").color?.name);
  });

  it("fg paints a 256-index colour, matching Style.parse", () => {
    // The sink takes symbolic colours the terminal resolves itself — the
    // reach the old one-function-per-colour-name family could never have.
    const rt = evalOne(`{{ fg "color(196)" "x" }}`);
    expect(rt.style.color?.name).toBe(Style.parse("color(196)").color?.name);
  });

  it("fg paints an rgb() triplet identically to the equivalent hex", () => {
    expect(fgHex(evalOne(`{{ fg "rgb(175,0,255)" "x" }}`))).toBe(
      fgHex(evalOne(`{{ fg "#af00ff" "x" }}`)),
    );
  });

  it("bg paints the background slot and leaves the foreground untouched", () => {
    const rt = evalOne(`{{ bg "white" "x" }}`);
    expect(rt.style.bgcolor?.name).toBe("white");
    expect(rt.style.color).toBeUndefined();
  });

  it("bg accepts hex / rgb / color(N) via ColorSpec.parse", () => {
    expect(evalOne(`{{ bg "#112233" "x" }}`).style.bgcolor?.name).toBe("#112233");
    expect(evalOne(`{{ bg "rgb(10,20,30)" "x" }}`).style.bgcolor?.name).toBe("rgb(10,20,30)");
    expect(evalOne(`{{ bg "color(42)" "x" }}`).style.bgcolor?.name).toBe("color(42)");
  });

  it("a spec ColorSpec.parse rejects fails loudly at the sink", () => {
    expect(() => evalOne(`{{ fg "notarealcolour" "x" }}`)).toThrowError(/parse color/i);
  });
});

// ─── Text attributes ────────────────────────────────────────────────────────

describe("text attributes", () => {
  // [LAW:one-source-of-truth] Driven by the same inventory `Style.parse`
  // consults, so a new attribute is covered the moment it is declared.
  it.each([...ATTRIBUTE_NAMES])("%s sets its flag and its negation clears it", (name) => {
    expect(evalOne(`{{ ${name} "x" }}`).style[name]).toBe(true);
    expect(evalOne(`{{ not_${name} "x" }}`).style[name]).toBe(false);
  });

  it.each(Object.entries(ATTRIBUTE_SHORT_ALIASES))(
    "short alias %s applies the same style as its canonical name",
    (alias, canonical) => {
      expect(evalOne(`{{ ${alias} "x" }}`).style[canonical]).toBe(
        evalOne(`{{ ${canonical} "x" }}`).style[canonical],
      );
      expect(evalOne(`{{ ${alias} "x" }}`).style[canonical]).toBe(true);
    },
  );
});

// ─── Colours are values ─────────────────────────────────────────────────────

describe("color produces a value, not a styled fragment", () => {
  it("resolves a palette name to that palette's hex", () => {
    const rt = evalOneWith(gruvboxEngine, `{{ color "primary" }}`);
    expect(rt.plain).toBe(gruvbox.get("primary")!.hex);
  });

  it("renders as its literal hex in text position — visibly wrong, never silently wrong", () => {
    // A colour that lands where text was expected must show up, not vanish.
    const rt = evalOneWith(gruvboxEngine, `{{ color "#af00ff" }}`);
    expect(rt.plain).toBe("#af00ff");
  });

  it("is idempotent: an already-literal colour passes through unchanged", () => {
    const once = evalOneWith(gruvboxEngine, `{{ color "primary" }}`).plain;
    const twice = evalOneWith(gruvboxEngine, `{{ color (color "primary") }}`).plain;
    expect(twice).toBe(once);
  });

  it("survives a $var and paints through fg", () => {
    const rt = evalOneWith(gruvboxEngine, `{{ $c := color "primary" }}{{ fg $c "x" }}`);
    expect(rt.plain).toBe("x");
    expect(fgHex(rt)).toBe(gruvbox.get("primary")!.hex);
  });

  it("one $var colour paints many fragments", () => {
    const out = gruvboxEngine
      .parse(`{{ $c := color "accent" }}{{ fg $c "a" }}{{ bg $c "b" }}`)
      .evaluate({});
    expect(out.length).toBe(2);
    expect(fgHex(out[0]!)).toBe(gruvbox.get("accent")!.hex);
    expect(out[1]!.style.bgcolor?.getTruecolor().hex).toBe(gruvbox.get("accent")!.hex);
  });
});

// ─── Colour math composes by nesting ────────────────────────────────────────

describe("colour math composes by nesting and matches the underlying function", () => {
  const primary = gruvbox.get("primary")!;
  const surface = gruvbox.get("surface")!;

  it("darken (color name) n equals darken(palette colour, n)", () => {
    const rt = evalOneWith(gruvboxEngine, `{{ fg (darken (color "primary") 2) "x" }}`);
    expect(fgHex(rt)).toBe(darken(primary, 2).hex);
  });

  it("lighten (color name) n equals lighten(palette colour, n)", () => {
    const rt = evalOneWith(gruvboxEngine, `{{ fg (lighten (color "primary") 2) "x" }}`);
    expect(fgHex(rt)).toBe(lighten(primary, 2).hex);
  });

  it("mix at 0 returns the first colour and at 100 the second", () => {
    const a = "#000000";
    const b = "#ffffff";
    expect(evalOne(`{{ fg (mix "${a}" "${b}" 0) "x" }}`).style.color?.getTruecolor().hex).toBe(a);
    expect(evalOne(`{{ fg (mix "${a}" "${b}" 100) "x" }}`).style.color?.getTruecolor().hex).toBe(b);
  });

  it("mix at an intermediate percentage equals blendRgb at the matching fraction", () => {
    const rt = evalOneWith(
      gruvboxEngine,
      `{{ fg (mix (color "primary") (color "surface") 65) "x" }}`,
    );
    expect(fgHex(rt)).toBe(blendRgb(primary, surface, 0.65).hex);
  });

  it("mix rejects a percentage outside 0..100", () => {
    expect(() => evalOne(`{{ fg (mix "#000000" "#ffffff" 140) "x" }}`)).toThrowError(
      /within 0\.\.100/,
    );
  });

  it("contrastOn equals contrastFor for the same background", () => {
    for (const bg of [DARK_BG, LIGHT_BG]) {
      const rt = evalOne(`{{ fg (contrastOn "${bg.hex}") "x" }}`);
      expect(fgHex(rt)).toBe(contrastFor(bg).hex);
    }
  });

  it("readableOn equals ensureContrast for the same pair", () => {
    const rt = evalOneWith(
      gruvboxEngine,
      `{{ fg (readableOn (color "primary") "${DARK_BG.hex}" 4.5) "x" }}`,
    );
    expect(fgHex(rt)).toBe(ensureContrast(primary, DARK_BG).hex);
  });

  it("each OKLCH axis function equals the matching single-axis ThemeKey", () => {
    const cases: [string, number, keyof ThemeKey][] = [
      ["shiftHue", 40, "hueShift"],
      ["scaleChroma", 0, "chromaScale"],
      ["scaleLightness", 1.2, "lightnessScale"],
      ["shiftLightness", 0.1, "lightnessShift"],
    ];
    for (const [func, amount, axis] of cases) {
      const rt = evalOneWith(
        gruvboxEngine,
        `{{ fg (${func} (color "primary") ${amount}) "x" }}`,
      );
      const expected = Oklch.fromRgba(primary)
        .applyKey({ ...IDENTITY, [axis]: amount })
        .toRgba().hex;
      expect(fgHex(rt)).toBe(expected);
    }
  });

  it("operations chain: fg (darken (mix a b 50) 1)", () => {
    const rt = evalOneWith(
      gruvboxEngine,
      `{{ fg (darken (mix (color "primary") (color "surface") 50) 1) "x" }}`,
    );
    expect(fgHex(rt)).toBe(darken(blendRgb(primary, surface, 0.5), 1).hex);
  });

  it("a palette name passed to colour math throws with the wrap-it hint", () => {
    // The one mistake that actually happens: `darken "primary" 2`. The error
    // must name the fix rather than just rejecting the shape.
    expect(() => evalOneWith(gruvboxEngine, `{{ fg (darken "primary" 2) "x" }}`)).toThrowError(
      /to use a palette name here, wrap it:/,
    );
    expect(() => evalOne(`{{ fg (contrastOn "red") "x" }}`)).toThrowError(
      /to use a palette name here, wrap it:/,
    );
  });
});

// ─── The palette getter is live ─────────────────────────────────────────────

describe("paletteFuncs reads its palette at evaluate time, not registration time", () => {
  it("one parsed template follows a palette swap", () => {
    // The whole reason the signature is `() => Palette`: templates are parsed
    // once and evaluated many times, and a consumer whose theme changes at
    // runtime must not be frozen to whichever palette was current when the
    // engine was built. [LAW:one-source-of-truth]
    let currentPalette: Palette = GRUVBOX.palette;
    const live = makePaletteEngine(() => currentPalette);
    const parsed = live.parse(`{{ fg (color "primary") "x" }}`);

    const before = parsed.evaluate({});
    expect(fgHex(before[0]!)).toBe(GRUVBOX.palette.get("primary")!.hex);

    currentPalette = DRACULA.palette;

    const after = parsed.evaluate({});
    expect(fgHex(after[0]!)).toBe(DRACULA.palette.get("primary")!.hex);
    expect(fgHex(after[0]!)).not.toBe(fgHex(before[0]!));
  });

  it("the swap reaches colours computed through the math chain too", () => {
    let currentPalette: Palette = GRUVBOX.palette;
    const live = makePaletteEngine(() => currentPalette);
    const parsed = live.parse(`{{ fg (darken (color "accent") 2) "x" }}`);

    expect(fgHex(parsed.evaluate({})[0]!)).toBe(
      darken(GRUVBOX.palette.get("accent")!, 2).hex,
    );

    currentPalette = DRACULA.palette;

    expect(fgHex(parsed.evaluate({})[0]!)).toBe(
      darken(DRACULA.palette.get("accent")!, 2).hex,
    );
  });
});

// ─── Composition semantics ──────────────────────────────────────────────────

describe("composition: outer wraps inner additively (Style.add semantics)", () => {
  it("fg over an inner attribute combines both", () => {
    const rt = evalOne(`{{ fg "red" (bold "x") }}`);
    expect(rt.plain).toBe("x");
    expect(rt.style.bold).toBe(true);
    expect(rt.style.color?.name).toBe("red");
  });

  it("nesting order does not matter for disjoint slots", () => {
    const a = evalOne(`{{ fg "red" (bold "x") }}`);
    const b = evalOne(`{{ bold (fg "red" "x") }}`);
    expect(b.style.bold).toBe(a.style.bold);
    expect(b.style.color?.name).toBe(a.style.color?.name);
  });

  it("bg over fg combines foreground and background", () => {
    const rt = evalOne(`{{ bg "white" (fg "red" "x") }}`);
    expect(rt.style.color?.name).toBe("red");
    expect(rt.style.bgcolor?.name).toBe("white");
  });

  it("conflicting slots: the outer call wins", () => {
    const rt = evalOne(`{{ fg "red" (fg "blue" "x") }}`);
    expect(rt.style.color?.name).toBe("red");
  });

  it("template-built fragment equals the directly-constructed Style chain", () => {
    const rt = evalOne(`{{ bg "white" (bold (fg "red" "hello")) }}`);
    const expected = Style.combine([
      Style.parse("red"),
      Style.parse("bold"),
      Style.parse("on white"),
    ]);
    expect(rt.style.color?.name).toBe(expected.color?.name);
    expect(rt.style.bgcolor?.name).toBe(expected.bgcolor?.name);
    expect(rt.style.bold).toBe(expected.bold);
  });
});

// ─── String lifting ─────────────────────────────────────────────────────────

describe("string lifting via the engine's fromString bridge", () => {
  it("a string literal is accepted and lifted to RichText", () => {
    const rt = evalOne(`{{ fg "red" "literal" }}`);
    expect(rt).toBeInstanceOf(RichText);
    expect(rt.plain).toBe("literal");
  });

  it("a scope field that resolves to a string is lifted the same way", () => {
    const rt = engine.parse(`{{ fg "red" .name }}`).evaluate({ name: "Brandon" });
    expect(rt[0]!.plain).toBe("Brandon");
    expect(rt[0]!.style.color?.name).toBe("red");
  });
});

// ─── Error surface ──────────────────────────────────────────────────────────

describe("error surface", () => {
  it("arity / type errors raise from the engine, not from the body", () => {
    // First arg of `bg` is declared "string" — a number is a TypeMismatchError
    // before the body ever runs.
    expect(() => engine.parse(`{{ bg 5 "x" }}`).evaluate({})).toThrowError(
      /TypeMismatch|expected/i,
    );
  });

  it("a number passed where a fragment is expected fails the liftable gate", () => {
    expect(() => engine.parse(`{{ bold 5 }}`).evaluate({})).toThrowError();
  });

  it("an unknown function name is a FuncNotFoundError", () => {
    expect(() => engine.parse(`{{ neonpurple "x" }}`).evaluate({})).toThrowError(
      /neonpurple|FuncNotFound/,
    );
  });

  it("color is unavailable on an engine built without a palette", () => {
    // [LAW:one-way-deps] `richTextFuncs()` is palette-free by construction;
    // naming a theme colour requires the consumer to merge `paletteFuncs`.
    expect(() => engine.parse(`{{ fg (color "primary") "x" }}`).evaluate({})).toThrowError(
      /color|FuncNotFound/,
    );
  });
});

// ─── Multi-fragment ─────────────────────────────────────────────────────────

describe("multi-fragment templates", () => {
  it("two top-level expressions emit two separate RichText fragments", () => {
    const out = engine.parse(`{{ fg "red" "a" }}{{ fg "blue" "b" }}`).evaluate({});
    expect(out.length).toBe(2);
    expect(out[0]!.plain).toBe("a");
    expect(out[0]!.style.color?.name).toBe("red");
    expect(out[1]!.plain).toBe("b");
    expect(out[1]!.style.color?.name).toBe("blue");
  });
});

// ─── style spec ─────────────────────────────────────────────────────────────

describe("style function (multi-attribute spec)", () => {
  it("applies a single attribute spec", () => {
    const rt = evalOne(`{{ style "bold" "x" }}`);
    expect(rt.style.bold).toBe(true);
  });

  it("applies multiple attributes from one spec", () => {
    const rt = evalOne(`{{ style "bold underline" "x" }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.underline).toBe(true);
  });

  it("mixes attributes and a foreground color in one spec", () => {
    const rt = evalOne(`{{ style "bold #ff6b6b" "alarm!" }}`);
    expect(rt.style.bold).toBe(true);
    expect(fgHex(rt)).toBe("#ff6b6b");
  });

  it("accepts 'on <bg>' for background", () => {
    const rt = evalOne(`{{ style "italic on white" "x" }}`);
    expect(rt.style.italic).toBe(true);
    expect(rt.style.bgcolor?.name).toBe("white");
  });

  it("accepts 'not <attr>' for negation", () => {
    const rt = evalOne(`{{ style "not bold" "x" }}`);
    expect(rt.style.bold).toBe(false);
  });

  it("accepts 'link <url>' inside the spec", () => {
    const rt = evalOne(`{{ style "bold link https://example.com" "x" }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.link).toBe("https://example.com");
  });

  it("empty spec is a no-op (matches Style.parse semantics)", () => {
    const rt = evalOne(`{{ style "" "x" }}`);
    expect(rt.plain).toBe("x");
    expect(rt.style.bold).toBeUndefined();
    expect(rt.style.color).toBeUndefined();
  });

  it("'none' spec is a no-op (DEFAULT_STYLES lookup)", () => {
    const rt = evalOne(`{{ style "none" "x" }}`);
    expect(rt.style.bold).toBeUndefined();
    expect(rt.style.color).toBeUndefined();
  });

  it("produces the same fragment as nested per-attribute calls", () => {
    const spec = evalOne(`{{ style "bold underline #ff6b6b" "x" }}`);
    const nested = evalOne(`{{ underline (fg "#ff6b6b" (bold "x")) }}`);
    expect(spec.style.bold).toBe(nested.style.bold);
    expect(spec.style.underline).toBe(nested.style.underline);
    expect(fgHex(spec)).toBe(fgHex(nested));
  });

  it("takes a computed colour through the spec string, same as fg", () => {
    // A colour is a hex string, so it flows into the `style` grammar via
    // `printf` with no extra machinery.
    const viaSpec = evalOneWith(
      gruvboxEngine,
      `{{ style (printf "bold %s" (darken (color "primary") 2)) "x" }}`,
    );
    const viaFg = evalOneWith(
      gruvboxEngine,
      `{{ bold (fg (darken (color "primary") 2) "x") }}`,
    );
    expect(fgHex(viaSpec)).toBe(fgHex(viaFg));
    expect(viaSpec.style.bold).toBe(true);
  });

  it("composes with outer style functions (outer wins on conflict)", () => {
    const rt = evalOne(`{{ fg "blue" (style "red bold" "x") }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.color?.name).toBe("blue");
  });

  it("composes inside a style spec (style spec wins over inner)", () => {
    const rt = evalOne(`{{ style "blue" (fg "red" "x") }}`);
    expect(rt.style.color?.name).toBe("blue");
  });

  it("reusable via Go template $var assignment", () => {
    const out = engine
      .parse(`{{ $s := "bold #ff6b6b" }}{{ style $s "a" }}{{ style $s "b" }}`)
      .evaluate({});
    expect(out.length).toBe(2);
    expect(out[0]!.plain).toBe("a");
    expect(out[1]!.plain).toBe("b");
    for (const rt of out) {
      expect(rt.style.bold).toBe(true);
      expect(fgHex(rt)).toBe("#ff6b6b");
    }
  });

  it("reusable via scope field", () => {
    const out = engine.parse(`{{ style .alert "danger" }}`).evaluate({ alert: "bold red" });
    expect(out[0]!.plain).toBe("danger");
    expect(out[0]!.style.bold).toBe(true);
    expect(out[0]!.style.color?.name).toBe("red");
  });

  it("works via the pipe form (last-arg piping)", () => {
    const a = evalOne(`{{ "alarm!" | style "bold red" }}`);
    const b = evalOne(`{{ style "bold red" "alarm!" }}`);
    expect(a.plain).toBe(b.plain);
    expect(a.style.bold).toBe(b.style.bold);
    expect(a.style.color?.name).toBe(b.style.color?.name);
  });

  it("an invalid token raises StyleSyntaxError through the engine", () => {
    expect(() => evalOne(`{{ style "notarealthing" "x" }}`)).toThrowError(
      /Invalid style definition/,
    );
  });

  it("a non-string spec is rejected by the argType gate, not the body", () => {
    expect(() => engine.parse(`{{ style 5 "x" }}`).evaluate({})).toThrowError(
      /TypeMismatch|expected/i,
    );
  });
});

// ─── link ───────────────────────────────────────────────────────────────────

describe("link function (cell-splitter contract)", () => {
  it("link wraps a string literal with the link slot set", () => {
    const rt = evalOne(`{{ link "https://example.com" "label" }}`);
    expect(rt.plain).toBe("label");
    expect(rt.style.link).toBe("https://example.com");
  });

  it("equivalent to Style.parse(\"link URL\") for the same URL", () => {
    const rt = evalOne(`{{ link "https://example.com" "x" }}`);
    expect(rt.style.link).toBe(Style.parse("link https://example.com").link);
  });

  it("nested links collapse with the outer winning", () => {
    const rt = evalOne(`{{ link "outer" (link "inner" "x") }}`);
    expect(rt.style.link).toBe("outer");
  });

  it("link inside a non-link style preserves both", () => {
    const rt = evalOne(`{{ bold (link "u" "x") }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.link).toBe("u");
  });

  it("non-link style inside a link preserves both", () => {
    const rt = evalOne(`{{ link "u" (bold "x") }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.link).toBe("u");
  });

  it("link composes with foreground / background colour", () => {
    const rt = evalOne(`{{ link "u" (fg "red" (bg "white" "x")) }}`);
    expect(rt.style.link).toBe("u");
    expect(rt.style.color?.name).toBe("red");
    expect(rt.style.bgcolor?.name).toBe("white");
  });

  it("link composes with a palette-derived colour", () => {
    const rt = evalOneWith(gruvboxEngine, `{{ link "u" (fg (color "primary") "x") }}`);
    expect(rt.style.link).toBe("u");
    expect(fgHex(rt)).toBe(gruvbox.get("primary")!.hex);
  });

  it("a link-bearing fragment's Style equals the directly-constructed equivalent", () => {
    const rt = evalOne(`{{ fg "red" (link "u" (bold "hello")) }}`);
    const expected = Style.combine([
      Style.parse("bold"),
      Style.parse("link u"),
      Style.parse("red"),
    ]);
    expect(rt.style.color?.name).toBe(expected.color?.name);
    expect(rt.style.bold).toBe(expected.bold);
    expect(rt.style.link).toBe(expected.link);
  });
});

// ─── Consumer-side cell splitting ───────────────────────────────────────────

describe("multi-cell contract (consumer-side cell splitting)", () => {
  // Test renderer implementing the consumer side of the fragment contract
  // described in docs/template-bindings.md: evaluation yields one RichText
  // per top-level expression, and a consumer that wants cells splits that
  // list itself rather than hunting for boundaries in a merged string.
  function splitCells(fragments: readonly RichText[]): {
    cells: { fragment: RichText; before: RichText[] }[];
    trailing: RichText[];
  } {
    const cells: { fragment: RichText; before: RichText[] }[] = [];
    let pending: RichText[] = [];
    for (const f of fragments) {
      if (f.style.link) {
        cells.push({ fragment: f, before: pending });
        pending = [];
      } else {
        pending.push(f);
      }
    }
    return { cells, trailing: pending };
  }

  it("a single top-level link is one cell with no joiner", () => {
    const out = engine.parse(`{{ link "u" "a" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.fragment.plain).toBe("a");
    expect(cells[0]!.fragment.style.link).toBe("u");
    expect(cells[0]!.before).toEqual([]);
    expect(trailing).toEqual([]);
  });

  it("two top-level links separated by literal text split into two cells with the literal as joiner", () => {
    const out = engine.parse(`{{ link "u1" "a" }} {{ link "u2" "b" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(2);

    expect(cells[0]!.fragment.plain).toBe("a");
    expect(cells[0]!.fragment.style.link).toBe("u1");
    expect(cells[0]!.before).toEqual([]);

    expect(cells[1]!.fragment.plain).toBe("b");
    expect(cells[1]!.fragment.style.link).toBe("u2");
    expect(cells[1]!.before.length).toBe(1);
    expect(cells[1]!.before[0]!.plain).toBe(" ");
    expect(cells[1]!.before[0]!.style.link).toBeUndefined();

    expect(trailing).toEqual([]);
  });

  it("nested links produce a single cell with the outer link applied", () => {
    const out = engine.parse(`{{ link "outer" (link "inner" "x") }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.fragment.style.link).toBe("outer");
    expect(trailing).toEqual([]);
  });

  it("link wrapped by bold yields one cell with both styles", () => {
    const out = engine.parse(`{{ bold (link "u" "x") }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.fragment.style.bold).toBe(true);
    expect(cells[0]!.fragment.style.link).toBe("u");
    expect(trailing).toEqual([]);
  });

  it("a link-free template yields no cells; everything is trailing joiner content", () => {
    const out = engine.parse(`{{ fg "red" "hello" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(0);
    expect(trailing.length).toBe(1);
    expect(trailing[0]!.plain).toBe("hello");
    expect(trailing[0]!.style.color?.name).toBe("red");
  });

  it("leading literal before a link becomes the cell's joiner", () => {
    const out = engine.parse(`prefix {{ link "u" "a" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.before.length).toBe(1);
    expect(cells[0]!.before[0]!.plain).toBe("prefix ");
    expect(trailing).toEqual([]);
  });
});
