import { describe, it, expect } from "vitest";
import { createRichTextEngine, richTextFuncs, renderTemplate } from "../../src/template-bindings/index.js";
import { RichText } from "../../src/core/text.js";

// [LAW:behavior-not-structure] Tests assert the binding contract, not internals.
// This is the bootstrap smoke test for rich-template-bindings-eeg: it proves
// the wiring end-to-end (engine constructs, parser runs, evaluator runs,
// fragments come back as RichText). Per-function behavioral tests land with
// each follow-up epic that registers the function.

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
    const segs = renderTemplate(engine, `{{ red "hi" }}`);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.map((s) => s.text).join("")).toContain("hi");
    const styled = segs.find((s) => s.style?.color?.name === "red");
    expect(styled).toBeDefined();
  });

  it("renderTemplate scope is threaded through to the engine", () => {
    const engine = createRichTextEngine();
    const segs = renderTemplate(engine, `{{ red .who }}`, { who: "world" });
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

  it("exposes a populated FuncMap from richTextFuncs()", () => {
    // Spot-check a representative from each registration category. The
    // exhaustive inventory is asserted in style-funcs.test.ts.
    const funcs = richTextFuncs();
    expect(funcs.red).toBeDefined();   // named foreground
    expect(funcs.bold).toBeDefined();  // canonical attribute
    expect(funcs.b).toBeDefined();     // short alias
    expect(funcs.not_bold).toBeDefined(); // negation
    expect(funcs.on).toBeDefined();    // background
    expect(funcs.color).toBeDefined(); // palette index
    expect(funcs.hex).toBeDefined();   // hex
    expect(funcs.rgb).toBeDefined();   // rgb
    expect(funcs.link).toBeDefined();  // hyperlink (cell splitter)
  });
});
