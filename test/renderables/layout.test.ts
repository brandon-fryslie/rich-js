import { describe, it, expect } from "vitest";
import { Layout } from "../../src/renderables/layout.js";
import type { LayoutOptions } from "../../src/renderables/layout.js";
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

  // A `size` and a `minimumSize` are cell counts a caller hands over as plain
  // numbers, and they never meet `withCellWidth`, which parses only what the
  // caller of `render` supplied. They became load-bearing in what `measure`
  // reports when a row learned to answer with the budget its panes need, so an
  // unparsed one stops being a layout mistake and escapes as a measurement:
  // `size: 5.5` measured 6.5 cells, and `size: -5` measured -4, which a
  // fit-mode Panel then threw `RangeError: Invalid count value` trying to draw.
  //
  // Same equivalence the width sweep pins for `options.maxWidth`, and the same
  // one `columns.test.ts` pins for a declared column width: a cell count is a
  // non-negative integer, and one that is not renders as the one it floors to.
  describe("a declared size is a cell count", () => {
    const options: RenderOptions = { maxWidth: 40, height: 5, maxHeight: 5 };

    const row = (paneOptions: LayoutOptions): Layout => {
      const layout = new Layout();
      layout.splitRow(new Layout("x", paneOptions), new Layout("y"));
      return layout;
    };

    const agrees = (given: LayoutOptions, floored: LayoutOptions): void => {
      expect(row(given).measure(options)).toEqual(row(floored).measure(options));
      expect(collectText(row(given), options)).toEqual(
        collectText(row(floored), options),
      );
    };

    it.each([
      ["NaN", NaN, 0],
      ["-5", -5, 0],
      ["5.5", 5.5, 5],
    ])("takes a size of %s as its floor", (_name, given, floor) => {
      agrees({ size: given }, { size: floor });
    });

    it.each([
      ["NaN", NaN, 0],
      ["-2", -2, 0],
      ["3.5", 3.5, 3],
    ])("takes a minimumSize of %s as its floor", (_name, given, floor) => {
      agrees({ ratio: 0, minimumSize: given }, { ratio: 0, minimumSize: floor });
    });
  });
});
