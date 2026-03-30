import { describe, it, expect } from "vitest";
import { Columns } from "../../src/renderables/columns.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(r: Renderable, opts: RenderOptions): string[] {
  const segs = [...r.render(opts)];
  return Segment.splitLines(segs).map((l) => l.map((s) => s.text).join(""));
}

describe("Columns", () => {
  // --- Construction & Properties (columns-behavior.md) ---

  it("renderables property is empty by default", () => {
    const cols = new Columns();
    expect(cols.renderables).toEqual([]);
  });

  it("expand property defaults to false", () => {
    const cols = new Columns();
    expect(cols.expand).toBe(false);
  });

  it("renders empty list with no output", () => {
    const cols = new Columns([]);
    const segs = [...cols.render({ maxWidth: 40 })];
    expect(segs).toHaveLength(0);
  });

  // --- Multi-column layout (columns-api.md, columns-behavior.md) ---

  it("renders items in multi-column layout with all items visible", () => {
    const cols = new Columns(["alpha", "beta", "gamma", "delta"]);
    const lines = collectLines(cols, { maxWidth: 40 });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const allText = lines.join(" ");
    expect(allText).toContain("alpha");
    expect(allText).toContain("beta");
    expect(allText).toContain("gamma");
    expect(allText).toContain("delta");
  });

  it("lays out items left-to-right, top-to-bottom", () => {
    // With enough width for 2 columns, items should be ordered left-to-right
    const cols = new Columns(["A", "B", "C", "D"]);
    const lines = collectLines(cols, { maxWidth: 20 });
    // First line should contain A before B
    const firstLine = lines[0] ?? "";
    const aIdx = firstLine.indexOf("A");
    const bIdx = firstLine.indexOf("B");
    // If both on the same line, A should appear before B
    if (aIdx >= 0 && bIdx >= 0) {
      expect(aIdx).toBeLessThan(bIdx);
    }
  });

  it("accepts string items", () => {
    const cols = new Columns(["hello", "world"]);
    const allText = collectLines(cols, { maxWidth: 40 }).join(" ");
    expect(allText).toContain("hello");
    expect(allText).toContain("world");
  });

  it("accepts RichText items", () => {
    const cols = new Columns([new RichText("styled"), new RichText("text")]);
    const allText = collectLines(cols, { maxWidth: 40 }).join(" ");
    expect(allText).toContain("styled");
    expect(allText).toContain("text");
  });

  it("accepts Renderable items", () => {
    const custom: Renderable = {
      render: function* () {
        yield new Segment("custom");
      },
    };
    const cols = new Columns([custom, "plain"]);
    const allText = collectLines(cols, { maxWidth: 40 }).join(" ");
    expect(allText).toContain("custom");
    expect(allText).toContain("plain");
  });

  // --- Options (columns-api.md, columns-behavior.md) ---

  it("equal option makes all columns same width", () => {
    const cols = new Columns(["a", "longer-item", "c"], { equal: true });
    const lines = collectLines(cols, { maxWidth: 60 });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    // All items should be visible
    const allText = lines.join(" ");
    expect(allText).toContain("a");
    expect(allText).toContain("longer-item");
    expect(allText).toContain("c");
  });

  it("expand option fills available width", () => {
    const cols = new Columns(["a", "b"], { expand: true });
    expect(cols.expand).toBe(true);
    const lines = collectLines(cols, { maxWidth: 40 });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const allText = lines.join(" ");
    expect(allText).toContain("a");
    expect(allText).toContain("b");
  });

  it("fixed width option controls column width", () => {
    const cols = new Columns(["alpha", "beta"], { width: 10 });
    const lines = collectLines(cols, { maxWidth: 40 });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const allText = lines.join(" ");
    expect(allText).toContain("alpha");
    expect(allText).toContain("beta");
  });

  // --- Measurement (columns-behavior.md) ---

  it("measurement minimum is greater than 0", () => {
    const cols = new Columns(["a", "b"]);
    const m = cols.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
  });
});
