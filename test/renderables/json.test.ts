import { describe, it, expect } from "vitest";
import { JSONRenderable } from "../../src/renderables/json.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

describe("JSONRenderable", () => {
  // --- Construction (json-behavior.md) ---

  it("fromData creates a renderable from data", () => {
    const j = JSONRenderable.fromData({ name: "Alice" });
    expect(j.text).toBeInstanceOf(RichText);
  });

  it("fromString parses a JSON string and creates a renderable", () => {
    const j = JSONRenderable.fromString('{"key": "value"}');
    expect(j.text).toBeInstanceOf(RichText);
    const text = collectText(j, { maxWidth: 80 });
    expect(text).toContain("key");
    expect(text).toContain("value");
  });

  // --- Pretty-printing (json-behavior.md) ---

  it("default indent is 2 spaces", () => {
    const j = JSONRenderable.fromData({ a: 1 });
    const plain = j.text.plain;
    // The key "a" should be indented by 2 spaces on its own line
    expect(plain).toContain("  ");
    expect(plain).not.toContain("    ");
  });

  it("custom indent of 4 produces 4-space indentation", () => {
    const j = JSONRenderable.fromData({ a: 1 }, { indent: 4 });
    const plain = j.text.plain;
    expect(plain).toContain("    ");
  });

  // --- Key sorting (json-behavior.md) ---

  it("sortKeys:true orders keys alphabetically", () => {
    const j = JSONRenderable.fromData({ z: 1, a: 2, m: 3 }, { sortKeys: true });
    const text = j.text.plain;
    const aIdx = text.indexOf('"a"');
    const mIdx = text.indexOf('"m"');
    const zIdx = text.indexOf('"z"');
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  // --- Syntax highlighting (json-behavior.md) ---

  it("highlight:true (default) produces spans on .text", () => {
    const j = JSONRenderable.fromData({ key: "value" });
    expect(j.text.spans.length).toBeGreaterThan(0);
  });

  it("highlight:false produces no spans on .text", () => {
    const j = JSONRenderable.fromData({ key: "value" }, { highlight: false });
    expect(j.text.spans).toHaveLength(0);
  });

  // --- Data types (json-behavior.md) ---

  it("renders objects with keys and values", () => {
    const j = JSONRenderable.fromData({ name: "Alice", age: 30 });
    const text = collectText(j, { maxWidth: 80 });
    expect(text).toContain('"name"');
    expect(text).toContain('"Alice"');
    expect(text).toContain("30");
  });

  it("renders arrays", () => {
    const j = JSONRenderable.fromData([1, 2, 3]);
    const text = collectText(j, { maxWidth: 80 });
    expect(text).toContain("1");
    expect(text).toContain("2");
    expect(text).toContain("3");
  });

  it("renders nested objects with recursive indentation", () => {
    const j = JSONRenderable.fromData({ outer: { inner: 1 } });
    const plain = j.text.plain;
    // Outer key at 2-space indent, inner key at 4-space indent
    const lines = plain.split("\n");
    const innerLine = lines.find((l) => l.includes('"inner"'));
    expect(innerLine).toBeDefined();
    // Inner key should have deeper indentation than outer key
    const outerLine = lines.find((l) => l.includes('"outer"'));
    expect(outerLine).toBeDefined();
    const outerIndent = outerLine!.search(/\S/);
    const innerIndent = innerLine!.search(/\S/);
    expect(innerIndent).toBeGreaterThan(outerIndent);
  });

  it("renders null", () => {
    const j = JSONRenderable.fromData(null);
    expect(j.text.plain).toBe("null");
  });

  it("renders booleans as true/false", () => {
    const jTrue = JSONRenderable.fromData(true);
    expect(jTrue.text.plain).toBe("true");
    const jFalse = JSONRenderable.fromData(false);
    expect(jFalse.text.plain).toBe("false");
  });

  it("renders numbers as numeric literals", () => {
    const j = JSONRenderable.fromData(42);
    expect(j.text.plain).toBe("42");
  });

  it("renders strings as quoted strings", () => {
    const j = JSONRenderable.fromData("hello");
    expect(j.text.plain).toBe('"hello"');
  });

  // --- Rendering (json-behavior.md) ---

  it("render yields Segments", () => {
    const j = JSONRenderable.fromData({ a: 1 });
    const segs = [...j.render({ maxWidth: 80 })];
    expect(segs.length).toBeGreaterThan(0);
    // All yielded items should be Segments
    for (const seg of segs) {
      expect(seg).toBeInstanceOf(Segment);
    }
  });

  // --- Measurement (json-behavior.md) ---

  it("measurement minimum is greater than 0", () => {
    const j = JSONRenderable.fromData({ a: 1 });
    const m = j.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
  });
});
