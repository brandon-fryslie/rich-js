import { describe, it, expect } from "vitest";
import { Layout } from "../../src/renderables/layout.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

describe("Layout", () => {
  it("renders leaf content", () => {
    const layout = new Layout("Hello World");
    const text = collectText(layout, { maxWidth: 40 });
    expect(text).toContain("Hello World");
  });

  it("renders column split (vertical stacking)", () => {
    const layout = new Layout();
    layout.splitColumn(
      new Layout("Top", { name: "top" }),
      new Layout("Bottom", { name: "bottom" }),
    );
    const text = collectText(layout, { maxWidth: 40, height: 10, maxHeight: 10 });
    expect(text).toContain("Top");
    expect(text).toContain("Bottom");
  });

  it("getByName finds named layouts", () => {
    const layout = new Layout();
    layout.splitColumn(
      new Layout(undefined, { name: "a" }),
      new Layout(undefined, { name: "b" }),
    );
    expect(layout.getByName("a")).toBeDefined();
    expect(layout.getByName("b")).toBeDefined();
    expect(layout.getByName("c")).toBeUndefined();
  });

  it("update replaces content", () => {
    const layout = new Layout("Old");
    layout.update("New");
    const text = collectText(layout, { maxWidth: 40 });
    expect(text).toContain("New");
    expect(text).not.toContain("Old");
  });

  it("hidden layout produces no output", () => {
    const layout = new Layout("Hidden", { visible: false });
    const segs = [...layout.render({ maxWidth: 40 })];
    expect(segs).toHaveLength(0);
  });

  it("measurement returns valid values", () => {
    const layout = new Layout("Content");
    const m = layout.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
  });
});
