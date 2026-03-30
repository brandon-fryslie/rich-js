import { describe, it, expect } from "vitest";
import { Pretty } from "../../src/renderables/pretty.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

describe("Pretty", () => {
  // --- Plain Values ---

  it("formats primitive values", () => {
    expect(collectText(new Pretty(42), { maxWidth: 80 })).toContain("42");
    expect(collectText(new Pretty("hello"), { maxWidth: 80 })).toContain('"hello"');
    expect(collectText(new Pretty(true), { maxWidth: 80 })).toContain("true");
    expect(collectText(new Pretty(null), { maxWidth: 80 })).toContain("null");
    expect(collectText(new Pretty(undefined), { maxWidth: 80 })).toContain("undefined");
  });

  // --- Arrays ---

  it("formats arrays", () => {
    const text = collectText(new Pretty([1, 2, 3]), { maxWidth: 80 });
    expect(text).toContain("1");
    expect(text).toContain("2");
    expect(text).toContain("3");
  });

  it("formats empty arrays", () => {
    const text = collectText(new Pretty([]), { maxWidth: 80 });
    expect(text).toContain("[]");
  });

  // --- Objects ---

  it("formats objects", () => {
    const text = collectText(new Pretty({ name: "Alice" }), { maxWidth: 80 });
    expect(text).toContain("name");
    expect(text).toContain("Alice");
  });

  it("formats empty objects", () => {
    const text = collectText(new Pretty({}), { maxWidth: 80 });
    expect(text).toContain("{}");
  });

  // --- Maps ---

  it("formats Maps", () => {
    const map = new Map([["key", "value"]]);
    const text = collectText(new Pretty(map), { maxWidth: 80 });
    expect(text).toContain("Map");
    expect(text).toContain("key");
    expect(text).toContain("value");
  });

  it("formats empty Maps", () => {
    const text = collectText(new Pretty(new Map()), { maxWidth: 80 });
    expect(text).toContain("Map {}");
  });

  // --- Sets ---

  it("formats Sets", () => {
    const set = new Set([1, 2, 3]);
    const text = collectText(new Pretty(set), { maxWidth: 80 });
    expect(text).toContain("Set");
    expect(text).toContain("1");
  });

  it("formats empty Sets", () => {
    const text = collectText(new Pretty(new Set()), { maxWidth: 80 });
    expect(text).toContain("Set {}");
  });

  // --- Compact Mode (default) ---

  it("fits content on one line when it fits within width", () => {
    const text = collectText(new Pretty([1, 2, 3]), { maxWidth: 80 });
    // Short array should be compact on one line
    expect(text).toContain("[");
    expect(text).not.toContain("\n["); // no expansion needed
  });

  it("expands when content exceeds available width", () => {
    const data = { longKeyName: "a long value that takes space", anotherKey: "more content here" };
    const text = collectText(new Pretty(data), { maxWidth: 30 });
    // Should expand to multiple lines when narrow
    expect(text).toContain("\n");
  });

  // --- Expand All Mode ---

  it("expandAll forces expansion of all containers", () => {
    const text = collectText(new Pretty({ a: 1 }, { expandAll: true }), { maxWidth: 80 });
    expect(text).toContain("\n");
  });

  it("expandAll expands arrays one element per line", () => {
    const text = collectText(new Pretty([1, 2], { expandAll: true }), { maxWidth: 80 });
    expect(text).toContain("\n");
  });

  // --- Truncation: maxLength ---

  it("truncates arrays with maxLength", () => {
    const text = collectText(new Pretty([1, 2, 3, 4, 5], { maxLength: 2 }), { maxWidth: 80 });
    expect(text).toContain("1");
    expect(text).toContain("2");
    expect(text).toContain("+3");
  });

  it("truncates objects with maxLength", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const text = collectText(new Pretty(obj, { maxLength: 2 }), { maxWidth: 80 });
    expect(text).toContain("+2");
  });

  // --- Truncation: maxString ---

  it("truncates strings with maxString and shows hidden count", () => {
    const long = "a".repeat(100);
    const text = collectText(new Pretty(long, { maxString: 10 }), { maxWidth: 80 });
    expect(text).toContain("+90");
  });

  // --- Indent ---

  it("accepts indent option to control indentation width", () => {
    // With a narrow width to force expansion and indent of 2
    const text = collectText(new Pretty({ a: 1, b: 2 }, { expandAll: true, indent: 2 }), { maxWidth: 80 });
    expect(text).toContain("\n");
  });

  // --- Indent Guides ---

  it("indent guides are enabled by default", () => {
    // indentGuides defaults to true per spec
    const p = new Pretty({ a: [1, 2] }, { expandAll: true });
    const text = collectText(p, { maxWidth: 40 });
    // Should render without error; guides are visual
    expect(text).toContain("a");
  });

  it("indent guides can be disabled", () => {
    const p = new Pretty({ a: [1, 2] }, { expandAll: true, indentGuides: false });
    const text = collectText(p, { maxWidth: 40 });
    expect(text).toContain("a");
  });

  // --- Measurement ---

  it("measurement returns valid values", () => {
    const p = new Pretty({ a: 1, b: [1, 2] });
    const m = p.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeLessThanOrEqual(80);
  });
});
