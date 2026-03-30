import { describe, it, expect } from "vitest";
import { Syntax } from "../../src/renderables/syntax.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectLines(r: Renderable, opts: RenderOptions): string[] {
  const segs = [...r.render(opts)];
  return Segment.splitLines(segs).map((l) => l.map((s) => s.text).join(""));
}

describe("Syntax", () => {
  // --- Construction ---

  it("constructs from code string and language", () => {
    const s = new Syntax("const x = 42;", "javascript");
    const text = collectText(s, { maxWidth: 80 });
    expect(text).toContain("const");
    expect(text).toContain("42");
  });

  it("constructs with language defaulting to text", () => {
    const s = new Syntax("hello world");
    const text = collectText(s, { maxWidth: 80 });
    expect(text).toContain("hello world");
  });

  // --- fromPath static factory ---

  it("fromPath is a static factory method", () => {
    // fromPath requires file system access; currently throws
    expect(() => Syntax.fromPath("test.js")).toThrow();
  });

  // --- Line Numbers ---

  it("renders with line numbers", () => {
    const s = new Syntax("line1\nline2\nline3", "text", { lineNumbers: true });
    const lines = collectLines(s, { maxWidth: 80 });
    expect(lines[0]).toContain("1");
    expect(lines[2]).toContain("3");
  });

  it("renders with custom start line", () => {
    const s = new Syntax("code", "text", { lineNumbers: true, startLine: 10 });
    const lines = collectLines(s, { maxWidth: 80 });
    expect(lines[0]).toContain("10");
  });

  // --- Line Range ---

  it("applies line range to show only specified lines", () => {
    const s = new Syntax("a\nb\nc\nd", "text", { lineRange: [2, 3] });
    const text = collectText(s, { maxWidth: 80 });
    expect(text).toContain("b");
    expect(text).toContain("c");
    expect(text).not.toContain("d");
  });

  // --- Highlight Lines ---

  it("highlights specified lines", () => {
    const s = new Syntax("line1\nline2\nline3", "text", {
      lineNumbers: true,
      highlightLines: new Set([2]),
    });
    const text = collectText(s, { maxWidth: 80 });
    // All lines should still be present
    expect(text).toContain("line1");
    expect(text).toContain("line2");
    expect(text).toContain("line3");
  });

  // --- Tab Size ---

  it("expands tabs to specified tab size", () => {
    const s = new Syntax("\tindented", "text", { tabSize: 2 });
    const text = collectText(s, { maxWidth: 80 });
    // Tab should be expanded to 2 spaces
    expect(text).toContain("  indented");
  });

  it("uses default tab size of 4", () => {
    const s = new Syntax("\tindented", "text");
    const text = collectText(s, { maxWidth: 80 });
    // Tab should be expanded to 4 spaces
    expect(text).toContain("    indented");
  });

  // --- Word Wrap ---

  it("accepts wordWrap option", () => {
    const longLine = "x".repeat(100);
    const s = new Syntax(longLine, "text", { wordWrap: true });
    const text = collectText(s, { maxWidth: 80 });
    expect(text).toContain("x");
  });

  // --- Measurement ---

  it("measurement returns valid values", () => {
    const s = new Syntax("hello world", "text");
    const m = s.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeLessThanOrEqual(80);
  });

  it("measurement accounts for line numbers width", () => {
    const code = "a\nb\nc";
    const withoutNums = new Syntax(code, "text").measure({ maxWidth: 80 });
    const withNums = new Syntax(code, "text", { lineNumbers: true }).measure({ maxWidth: 80 });
    expect(withNums.maximum).toBeGreaterThanOrEqual(withoutNums.maximum);
  });
});
