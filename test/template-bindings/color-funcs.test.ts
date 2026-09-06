import { describe, it, expect } from "vitest";
import { createEngine, type Engine } from "@promptctl/go-template-js";
import { RichText } from "../../src/core/text.js";
import { blendRgb } from "../../src/core/color.js";
import { Oklch, IDENTITY } from "../../src/core/oklch.js";
import { richTextFuncs, paletteFuncs } from "../../src/template-bindings/index.js";
import {
  darken,
  contrastFor,
  ensureContrast,
  contrastRatio,
} from "../../src/themes/colorMath.js";
import { parseHexColor } from "../../src/themes/colorRef.js";
import { GRUVBOX, DRACULA } from "../../src/themes/terminalThemes.js";
import { ColorRamp } from "../../src/themes/ramp.js";

// [LAW:behavior-not-structure] Every assertion below compares what a template
// produces against what the underlying rich-js function produces for the same
// inputs. The binding's contract is "the template surface is a faithful,
// composable view of the color math" — not any particular registration shape.

const palette = GRUVBOX.palette;

function engineFor(getPalette: () => typeof palette): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: { ...richTextFuncs(), ...paletteFuncs(getPalette) },
  });
}

const engine = engineFor(() => palette);

/** Evaluate a template that produces a bare color value, as its hex text. */
function colorText(source: string): string {
  return engine
    .parse(source)
    .evaluate({})
    .map((f) => f.plain)
    .join("");
}

/** Evaluate a template producing one styled fragment; return its fg hex. */
function paintedFg(source: string): string {
  const frags = engine.parse(source).evaluate({});
  expect(frags.length).toBe(1);
  return frags[0]!.style.color!.getTruecolor().hex;
}

describe("colors are values", () => {
  it("a color survives a template variable", () => {
    // The ergonomic payoff of the whole redesign: name a color once, use it
    // many times. Impossible when every color function consumed its color
    // into a fragment in the same breath.
    const out = engine
      .parse(`{{ $c := color "primary" }}{{ fg $c "a" }}{{ fg $c "b" }}`)
      .evaluate({});
    expect(out.length).toBe(2);
    const expected = palette.get("primary")!.hex;
    for (const frag of out) {
      expect(frag.style.color!.getTruecolor().hex).toBe(expected);
    }
  });

  it("a color in text position renders as its literal hex", () => {
    // Deliberate: misuse is visible, never silent. An author who forgets the
    // `fg` sees `#83a598` in their output instead of an invisibly dropped
    // style. [LAW:no-silent-failure]
    expect(colorText(`{{ color "primary" }}`)).toBe(palette.get("primary")!.hex);
  });

  it("composition nests, and the simple case is a prefix of the composed case", () => {
    // `{{ fg (color "primary") … }}` grows into
    // `{{ fg (darken (color "primary") 2) … }}` by wrapping, never by
    // rewriting into a different form. [LAW:composability]
    const base = palette.get("primary")!;
    expect(paintedFg(`{{ fg (color "primary") "x" }}`)).toBe(base.hex);
    expect(paintedFg(`{{ fg (darken (color "primary") 2) "x" }}`)).toBe(
      darken(base, 2).hex,
    );
    expect(
      paintedFg(`{{ fg (lighten (darken (color "primary") 4) 2) "x" }}`),
    ).toBe(darken(darken(base, 4), -2).hex);
  });

  it("color math reaches colors that are not in any palette", () => {
    // The capability the old spec grammar could not express at all: its
    // modifiers only attached to registered palette names.
    expect(paintedFg(`{{ fg (darken "#af00ff" 3) "x" }}`)).toBe(
      darken(parseHexColor("#af00ff"), 3).hex,
    );
  });
});

describe("color math matches the underlying functions", () => {
  const a = "#102030";
  const b = "#a0b0c0";

  it("darken and lighten are the same axis in opposite directions", () => {
    expect(colorText(`{{ darken "${a}" 2 }}`)).toBe(darken(parseHexColor(a), 2).hex);
    expect(colorText(`{{ lighten "${a}" 2 }}`)).toBe(darken(parseHexColor(a), -2).hex);
    expect(colorText(`{{ lighten "${a}" 3 }}`)).toBe(colorText(`{{ darken "${a}" -3 }}`));
  });

  it("mix interpolates between its endpoints and hits them exactly", () => {
    expect(colorText(`{{ mix "${a}" "${b}" 0 }}`)).toBe(a);
    expect(colorText(`{{ mix "${a}" "${b}" 100 }}`)).toBe(b);
    expect(colorText(`{{ mix "${a}" "${b}" 65 }}`)).toBe(
      blendRgb(parseHexColor(a), parseHexColor(b), 0.65).hex,
    );
  });

  it("mix subsumes alpha compositing", () => {
    // colorMath's `alphaBlend(fg, bg, x)` is *defined* as `blendRgb(bg, fg, x)`
    // — one operation, so one binding. [LAW:one-type-per-behavior]
    const composited = blendRgb(parseHexColor(b), parseHexColor(a), 0.5).hex;
    expect(colorText(`{{ mix "${b}" "${a}" 50 }}`)).toBe(composited);
  });

  it("mix rejects a percentage outside 0..100", () => {
    expect(() => colorText(`{{ mix "${a}" "${b}" 150 }}`)).toThrow(/0\.\.100/);
    expect(() => colorText(`{{ mix "${a}" "${b}" -1 }}`)).toThrow(/0\.\.100/);
  });

  it("contrastOn picks the readable pole; readableOn keeps the color itself", () => {
    const dark = "#101010";
    expect(colorText(`{{ contrastOn "${dark}" }}`)).toBe(contrastFor(parseHexColor(dark)).hex);

    // The distinction that earns two functions rather than one with a flag:
    // contrastOn answers with black or white; readableOn answers with a
    // recognizably-still-blue blue.
    const blueOnBlue = colorText(`{{ readableOn "#1a1a4a" "#101030" 4.5 }}`);
    expect(blueOnBlue).toBe(
      ensureContrast(parseHexColor("#1a1a4a"), parseHexColor("#101030"), 4.5).hex,
    );
    expect(["#000000", "#ffffff"]).not.toContain(blueOnBlue);
  });

  it("readableOn takes its ratio explicitly, and rejects a non-WCAG one", () => {
    // The threshold is the decision the function makes, so it is stated at the
    // call site rather than inherited from a hidden default — a caller muting
    // text on purpose wants 3, and would be silently un-muted by an implicit
    // 4.5. [LAW:no-silent-failure]
    const quiet = colorText(`{{ readableOn "#3a3f58" "#31344a" 3 }}`);
    const loud = colorText(`{{ readableOn "#3a3f58" "#31344a" 7 }}`);
    expect(quiet).not.toBe(loud);
    expect(contrastRatio(parseHexColor(quiet), parseHexColor("#31344a"))).toBeGreaterThanOrEqual(2.99);
    expect(contrastRatio(parseHexColor(loud), parseHexColor("#31344a"))).toBeGreaterThanOrEqual(6.99);
    expect(() => colorText(`{{ readableOn "#3a3f58" "#31344a" 0.5 }}`)).toThrow(/1\.\.21/);
    expect(() => colorText(`{{ readableOn "#3a3f58" "#31344a" 30 }}`)).toThrow(/1\.\.21/);
  });

  it("registers one function per OKLCH ThemeKey axis, each matching applyKey", () => {
    // [LAW:one-source-of-truth] The bindings are derived from ThemeKey's field
    // set, so this table and the registration table describe the same axes.
    const cases = [
      { call: `shiftHue "${b}" 40`, key: { ...IDENTITY, hueShift: 40 } },
      { call: `scaleChroma "${b}" 0.5`, key: { ...IDENTITY, chromaScale: 0.5 } },
      { call: `scaleLightness "${b}" 0.8`, key: { ...IDENTITY, lightnessScale: 0.8 } },
      { call: `shiftLightness "${b}" 0.1`, key: { ...IDENTITY, lightnessShift: 0.1 } },
    ];
    for (const { call, key } of cases) {
      expect(colorText(`{{ ${call} }}`)).toBe(
        Oklch.fromRgba(parseHexColor(b)).applyKey(key).toRgba().hex,
      );
    }
  });
});

describe("loud failure", () => {
  it("a palette name passed to color math names the fix, not just the rule", () => {
    // The single most likely authoring mistake. The message must move the
    // author one step, not restate the type. [LAW:no-silent-failure]
    let message = "";
    try {
      colorText(`{{ darken "primary" 2 }}`);
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain("to use a palette name here, wrap it:");
    expect(message).toContain(`darken (color "primary")`);
  });

  it("an unknown palette name throws rather than resolving to anything", () => {
    // Naming the palette matters as much as naming the variable: the same
    // reference is valid or not depending on which theme is current, so the
    // message has to say which one it looked in.
    expect(() => colorText(`{{ color "nosuchvar" }}`)).toThrow(/nosuchvar/);
    expect(() => colorText(`{{ color "nosuchvar" }}`)).toThrow(/gruvbox/);
  });

  it("a text fragment cannot be passed where a color belongs", () => {
    // The reason the carrier is a string and not an opaque object: "string" is
    // the one arg slot that refuses typed T, so the color and fragment slots
    // are mutually exclusive by type rather than by convention.
    // [LAW:types-are-the-program]
    expect(() => colorText(`{{ darken (bold "x") 2 }}`)).toThrow();
  });
});

describe("the palette is read at evaluate time, not at registration", () => {
  it("one parsed template follows a live theme change", () => {
    // [LAW:one-source-of-truth] A captured palette would freeze these colors
    // while the rest of a consumer's theme moved on — two palettes in one
    // render. The getter is what makes that unrepresentable, and it costs
    // nothing: FuncMap bodies run per evaluation, so parse-once/evaluate-many
    // is untouched (this test parses exactly once).
    let current = GRUVBOX.palette;
    const live = engineFor(() => current);
    const tpl = live.parse(`{{ color "primary" }}`);

    const before = tpl.evaluate({}).map((f) => f.plain).join("");
    expect(before).toBe(GRUVBOX.palette.get("primary")!.hex);

    current = DRACULA.palette;
    const after = tpl.evaluate({}).map((f) => f.plain).join("");
    expect(after).toBe(DRACULA.palette.get("primary")!.hex);
    expect(after).not.toBe(before);
  });

  it("the function inventory does not depend on which palette is current", () => {
    // Why a fixed inventory matters: a per-variable function family would
    // have had a *different set of names* per theme, and a template parsed
    // under one theme could hit FuncNotFound under another. `color` and
    // `ramp` are the same two names regardless of palette contents.
    const names = Object.keys(paletteFuncs(() => GRUVBOX.palette));
    expect(names).toEqual(Object.keys(paletteFuncs(() => DRACULA.palette)));
    expect(names).toEqual(["color", "ramp"]);
  });
});

describe("ramp — a number becomes a color inside the theme", () => {
  const stops = (p: typeof palette) => [
    { at: 0, color: p.get("surface")! },
    { at: 50, color: p.get("warning")! },
    { at: 80, color: p.get("error")! },
  ];

  it("palette names and hex literals are both stops, through the same resolver", () => {
    // [LAW:behavior-not-structure] The template surface agrees with ColorRamp
    // over the same resolved stops, whichever spelling the author used.
    const byName = `{{ ramp 65 "linear" 0 "surface" 50 "warning" 80 "error" }}`;
    const byHex =
      `{{ ramp 65 "linear" 0 "${palette.get("surface")!.hex}" ` +
      `50 "${palette.get("warning")!.hex}" 80 "${palette.get("error")!.hex}" }}`;
    const expected = new ColorRamp("linear", stops(palette)).at(65).hex;
    expect(colorText(byName)).toBe(expected);
    expect(colorText(byHex)).toBe(expected);
  });

  it("step spells a threshold cascade, exact at the thresholds", () => {
    const at = (v: number) =>
      colorText(`{{ ramp ${v} "step" 0 "surface" 50 "warning" 80 "error" }}`);
    expect(at(0)).toBe(palette.get("surface")!.hex);
    expect(at(49)).toBe(palette.get("surface")!.hex);
    expect(at(50)).toBe(palette.get("warning")!.hex);
    expect(at(80)).toBe(palette.get("error")!.hex);
    expect(at(100)).toBe(palette.get("error")!.hex);
  });

  it("re-resolves its stops against the live palette on every evaluation", () => {
    // The whole reason the ramp lives in the theme: swap the palette and the
    // same template recolors, with no change to the template.
    let live = GRUVBOX.palette;
    const swapping = engineFor(() => live);
    const tpl = swapping.parse(`{{ ramp 65 "linear" 0 "surface" 50 "warning" 80 "error" }}`);
    const text = () => tpl.evaluate({}).map((f) => f.plain).join("");
    expect(text()).toBe(new ColorRamp("linear", stops(GRUVBOX.palette)).at(65).hex);
    live = DRACULA.palette;
    expect(text()).toBe(new ColorRamp("linear", stops(DRACULA.palette)).at(65).hex);
  });

  it("composes: the result is a color `bg`/`fg` paint and `mix` transforms", () => {
    const rampHex = colorText(`{{ ramp 65 "linear" 0 "surface" 80 "error" }}`);
    expect(paintedFg(`{{ fg (ramp 65 "linear" 0 "surface" 80 "error") "x" }}`)).toBe(rampHex);
    expect(colorText(`{{ mix (ramp 65 "linear" 0 "surface" 80 "error") "#000000" 0 }}`)).toBe(
      rampHex,
    );
  });

  it("every malformed call names its own fix", () => {
    // [LAW:no-silent-failure]
    expect(() => colorText(`{{ ramp }}`)).toThrow(/needs a value and an easing .*\(got 0\)/);
    expect(() => colorText(`{{ ramp 65 }}`)).toThrow(/needs a value and an easing .*\(got 1\)/);
    expect(() => colorText(`{{ ramp 65 "linear" }}`)).toThrow(/at least one stop/);
    expect(() => colorText(`{{ ramp 65 "linear" 0 "surface" 50 }}`)).toThrow(
      /last stop \(position 50\) has no color/,
    );
    expect(() => colorText(`{{ ramp 65 "smooth" 0 "surface" }}`)).toThrow(
      /unknown ramp easing "smooth"/,
    );
    expect(() => colorText(`{{ ramp 65 "step" 0 "nope" }}`)).toThrow(/no such variable/);
    expect(() => colorText(`{{ ramp 65 "step" 80 "error" 50 "warning" }}`)).toThrow(
      /ascending position order/,
    );
    // The engine's gate, not the body: a color where a position belongs.
    expect(() => colorText(`{{ ramp 65 "step" "surface" 0 }}`)).toThrow(/ramp/);
  });
});
