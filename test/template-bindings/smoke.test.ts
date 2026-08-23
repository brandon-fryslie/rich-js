import { describe, it, expect } from "vitest";
import { createRichTextEngine, richTextFuncs, renderTemplate } from "../../src/template-bindings/index.js";
import { RichText } from "../../src/core/text.js";

// [LAW:behavior-not-structure] Tests assert the binding contract, not internals.
// This is the bootstrap smoke test: it proves the wiring end-to-end (engine
// constructs, parser runs, evaluator runs, fragments come back as RichText) and
// that the configuration-free half of the vocabulary — the colour sinks, the
// palette-free colour math, attributes, link — works with no theme in sight.
// Per-function behaviour lives in style-funcs.test.ts.

describe("template-bindings — bootstrap smoke", () => {
  it("evaluates a literal-only template to a single RichText fragment", () => {
    const engine = createRichTextEngine();
    const result = engine.compile("hello, world")({});

    expect(result).toHaveLength(1);
    const [fragment] = result;
    expect(fragment).toBeInstanceOf(RichText);
    expect(fragment!.plain).toBe("hello, world");
  });

  it("interpolates a scope variable through fromString", () => {
    const engine = createRichTextEngine();
    const result = engine.compile("hi {{ .name }}")({ name: "ada" });

    expect(result.map((rt) => rt.plain).join("")).toBe("hi ada");
    for (const fragment of result) {
      expect(fragment).toBeInstanceOf(RichText);
    }
  });

  it("renderTemplate returns segments for a valid template", () => {
    const engine = createRichTextEngine();
    const segs = renderTemplate(engine, `{{ fg "red" "hi" }}`);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.map((s) => s.text).join("")).toContain("hi");
    const styled = segs.find((s) => s.style?.color?.name === "red");
    expect(styled).toBeDefined();
  });

  it("renderTemplate scope is threaded through to the engine", () => {
    const engine = createRichTextEngine();
    const segs = renderTemplate(engine, `{{ fg "red" .who }}`, { who: "world" });
    expect(segs.map((s) => s.text).join("")).toContain("world");
  });

  it("renderTemplate degrades to a styled error segment on failure", () => {
    const engine = createRichTextEngine();
    const segs = renderTemplate(engine, `{{ bogus_function "x" }}`);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text.startsWith("[error:")).toBe(true);
    expect(segs[0]!.style?.color?.name).toBe("red");
  });

  it("renderTemplate accepts a custom error style", () => {
    const engine = createRichTextEngine();
    const segs = renderTemplate(engine, `{{ bogus }}`, {}, { errorStyle: "yellow" });
    expect(segs[0]!.style?.color?.name).toBe("yellow");
  });

  it("renderTemplate degrades silently even when the user-supplied errorStyle is invalid", () => {
    // The whole point of the helper is "never throw on the live-render path".
    // A bogus errorStyle in the catch branch must not propagate — it falls
    // back to a hard-coded safe Style so the caller still gets a segment.
    const engine = createRichTextEngine();
    expect(() =>
      renderTemplate(engine, `{{ bogus }}`, {}, { errorStyle: "::: not a real spec :::" }),
    ).not.toThrow();
    const segs = renderTemplate(engine, `{{ bogus }}`, {}, { errorStyle: "::: not a real spec :::" });
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text.startsWith("[error:")).toBe(true);
  });

  it("the theme-free engine covers the whole colour vocabulary via hex literals", () => {
    // [LAW:one-way-deps] `richTextFuncs()` needs no configuration: a consumer
    // with no theme system still composes colours, because the colour math is
    // palette-free and the sinks take any colour.
    const engine = createRichTextEngine();
    const segs = renderTemplate(
      engine,
      `{{ bg (darken "#3465a4" 2) (fg (contrastOn "#3465a4") (bold "ok")) }}`,
    );
    expect(segs.map((s) => s.text).join("")).toContain("ok");
    expect(segs.some((s) => s.style?.bold === true)).toBe(true);
    expect(segs.every((s) => !s.text.startsWith("[error:"))).toBe(true);
  });

  it("naming a theme colour needs paletteFuncs, which the bare engine does not register", () => {
    // `color` is the one palette-dependent function and ships separately, so a
    // template that names a theme colour fails loudly here rather than
    // silently rendering an unthemed colour. [LAW:no-silent-failure]
    const engine = createRichTextEngine();
    const segs = renderTemplate(engine, `{{ fg (color "primary") "x" }}`);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text.startsWith("[error:")).toBe(true);
  });

  it("richTextFuncs() is the union of the style set and the colour-math set", () => {
    // The one structural guarantee worth pinning: `richTextFuncs()` merges
    // both halves, so a consumer registering it gets painting AND colour
    // arithmetic from a single call. Behaviour per function lives in
    // style-funcs.test.ts.
    const funcs = richTextFuncs();
    const styleOnly = ["fg", "bg", "bold", "b", "not_bold", "style", "link"];
    const colorOnly = ["darken", "lighten", "mix", "contrastOn", "readableOn", "shiftHue"];
    for (const name of [...styleOnly, ...colorOnly]) {
      expect(funcs[name]).toBeDefined();
    }
  });

  it("does not register a palette-dependent function", () => {
    // [LAW:one-way-deps] Nothing in `richTextFuncs()` knows a palette exists;
    // `color` arrives only via `paletteFuncs(getPalette)`.
    expect(richTextFuncs()["color"]).toBeUndefined();
  });
});
