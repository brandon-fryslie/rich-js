import { describe, it, expect } from "vitest";
import { createRichTextEngine, richTextFuncs } from "../../src/template-bindings/index.js";
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

  it("exposes an empty bootstrap FuncMap from richTextFuncs()", () => {
    expect(richTextFuncs()).toEqual({});
  });
});
