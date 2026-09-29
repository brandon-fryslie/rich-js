import { describe, it, expect } from "vitest";
import { Columns } from "../../src/renderables/columns.js";
import { Panel } from "../../src/renderables/panel.js";
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

  // --- Multi-line children (rich-columns-9wd) ---

  it("renders every row of a multi-line child, not just the first", () => {
    // A single Panel renders as several visual rows (borders + content).
    // Columns must emit all of them, not truncate to lines[0].
    const panel = new Panel("hello", { expand: false });
    const standalone = collectLines(panel, { maxWidth: 40 });
    const cols = collectLines(new Columns([panel]), { maxWidth: 40 });
    expect(standalone.length).toBeGreaterThan(1);
    expect(cols.length).toBe(standalone.length);
  });

  it("merges multi-line children side by side row-by-row", () => {
    const cols = new Columns([
      new Panel("AAA", { expand: false }),
      new Panel("BBB", { expand: false }),
    ]);
    const lines = collectLines(cols, { maxWidth: 60 });
    // The content row carries both panels' text on the same visual line —
    // proof the two children are merged horizontally, not stacked.
    const contentRow = lines.find((l) => l.includes("AAA"));
    expect(contentRow).toBeDefined();
    expect(contentRow).toContain("BBB");
  });

  // --- A declared column width is a cell count ---

  // The sweep pins this equivalence for `options.maxWidth`; these pin it for the
  // declared width, which reaches the layout by the constructor instead. A cell
  // count is a non-negative integer, and a width that is not one renders as the
  // one it floors to.
  it.each([
    ["NaN", NaN, 0],
    ["-5", -5, 0],
    ["4.5", 4.5, 4],
  ])("lays out a declared width of %s as its floor", (_name, given, floor) => {
    const at = (width: number): string[] =>
      collectLines(new Columns(["alpha", "beta", "gamma"], { width }), {
        maxWidth: 80,
      });
    expect(at(given)).toEqual(at(floor));
  });

  // --- A declared column width yields to a narrower offer ---

  it("renders a declared width wider than the offer at the offer", () => {
    const cols = (): Columns => new Columns(["aaaaaa", "bbbbbb"], { width: 6 });
    // Laid out at the declared six cells, this emitted six-cell lines into a
    // three-cell request while `measure` reported three. Python Rich 9d8f9a3
    // has no answer to compare: it divides the offer by the declared width,
    // gets zero columns, and raises ZeroDivisionError.
    expect(collectLines(cols(), { maxWidth: 3 })).toEqual(["aa…", "bb…"]);
    expect(cols().measure({ maxWidth: 3 })).toEqual({ minimum: 1, maximum: 3 });
    // Offered room, the declared width is what each column gets. Python Rich
    // 9d8f9a3 prints this line for the same call.
    expect(collectLines(cols(), { maxWidth: 14 })).toEqual(["aaaaaa bbbbbb"]);
  });

  // --- Measurement (columns-behavior.md) ---

  it("measurement minimum is greater than 0", () => {
    const cols = new Columns(["a", "b"]);
    const m = cols.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
  });

  // rich-text-5ai: same gap the code review found in table cells — a
  // `RichText` item implements `render`, so it left
  // through the passthrough arm untouched, keeping its default `end: "\n"`
  // and drawing a stray extra row once `RichText.render` started honoring
  // `end` for non-empty text.
  it("does not draw a blank row for a RichText item with an embedded trailing newline", () => {
    const cols = new Columns([new RichText("foo\n"), "bar"]);
    expect(collectLines(cols, { maxWidth: 40 })).toHaveLength(1);
  });

  // --- The reference's layout (rich-columns-awe, rich-columns-sf4) ---
  //
  // Every expected value below that is not marked otherwise is what Python Rich
  // 9d8f9a3 prints for the same call, `Console(width=…).render_lines(…, pad=False)`.

  const listing = ["alpha", "be", "gamma", "d", "epsilon"];

  it("sizes each column by its own widest item and stops at that width", () => {
    // Offered 20, the grid is 18 wide: the columns fill nothing they were not
    // given content for, and `measure` reports exactly the width drawn.
    const lines = collectLines(new Columns(listing), { maxWidth: 20 });
    expect(lines).toEqual(["alpha   be gamma d", "epsilon           "]);
    expect(new Columns(listing).measure({ maxWidth: 20 })).toEqual({ minimum: 1, maximum: 18 });
    expect(collectLines(new Columns(["a", "b"]), { maxWidth: 20 })).toEqual(["a b"]);
  });

  it("expand stretches the columns to the offer, weighted by width", () => {
    expect(collectLines(new Columns(["a", "b"], { expand: true }), { maxWidth: 20 })).toEqual([
      "a             b     ",
    ]);
    expect(collectLines(new Columns(listing, { expand: true }), { maxWidth: 20 })).toEqual([
      "alpha    be  gamma d",
      "epsilon             ",
    ]);
    // What a Columns asks for is the unstretched grid, as a Table's measure is.
    expect(new Columns(["a", "b"], { expand: true }).measure({ maxWidth: 20 }).maximum).toBe(3);
  });

  it("expand renders each item at its stretched column width", () => {
    const panels = [new Panel("x", { expand: false }), new Panel("yy", { expand: false })];
    expect(collectLines(new Columns(panels, { expand: true }), { maxWidth: 16 })).toEqual([
      "╭───╮   ╭────╮  ",
      "│ x │   │ yy │  ",
      "╰───╯   ╰────╯  ",
    ]);
  });

  it("padding sets the gap between columns to its wider horizontal side", () => {
    expect(collectLines(new Columns(["a", "b"], { padding: 3 }), { maxWidth: 20 })).toEqual(["a   b"]);
    expect(collectLines(new Columns(["a", "b"], { padding: [0, 1, 0, 3] }), { maxWidth: 20 })).toEqual([
      "a   b",
    ]);
  });

  it("padding separates rows the way the reference's collapsed grid does", () => {
    const rows = (padding: [number, number] | [number, number, number, number]): string[] =>
      collectLines(new Columns(listing, { padding }), { maxWidth: 20 });
    const blank = " ".repeat(18);
    expect(rows([1, 1])).toEqual(["alpha   be gamma d", blank, "epsilon           "]);
    // The top is counted twice and a bottom-only padding separates nothing:
    // Rich collapses a row's bottom into `top - bottom` and keeps the next top.
    expect(rows([2, 1, 0, 1])).toEqual(["alpha   be gamma d", blank, blank, blank, blank, "epsilon           "]);
    expect(rows([0, 1, 2, 1])).toEqual(["alpha   be gamma d", "epsilon           "]);
  });

  it("columnFirst gives the leading columns the extra items", () => {
    expect(collectLines(new Columns(["a", "b", "c", "d", "e"], { columnFirst: true }), { maxWidth: 8 })).toEqual([
      "a c d e",
      "b      ",
    ]);
    expect(collectLines(new Columns(listing, { columnFirst: true }), { maxWidth: 20 })).toEqual([
      "alpha gamma epsilon",
      "be    d            ",
    ]);
  });

  it("equal counts columns by the widest item and sizes them by their own", () => {
    expect(collectLines(new Columns(listing, { equal: true }), { maxWidth: 20 })).toEqual([
      "alpha   be",
      "gamma   d ",
      "epsilon   ",
    ]);
    expect(collectLines(new Columns(listing, { equal: true, expand: true }), { maxWidth: 20 })).toEqual([
      "alpha           be  ",
      "gamma           d   ",
      "epsilon             ",
    ]);
  });

  it("expand stretches a declared width like any other", () => {
    const cols = (): Columns => new Columns(["a", "b", "c", "d"], { width: 3, expand: true });
    expect(collectLines(cols(), { maxWidth: 16 })).toEqual(["a    b   c   d  "]);
    expect(collectLines(cols(), { maxWidth: 18 })).toEqual(["a    b    c    d  "]);
  });

  it("never lays out more columns than items, in any mode", () => {
    // Not the reference: Rich divides a declared width into the offer without
    // counting items, and prints `"a   b              "` — three empty columns.
    expect(collectLines(new Columns(["a", "b"], { width: 3 }), { maxWidth: 20 })).toEqual(["a   b  "]);
    expect(collectLines(new Columns(["a", "b"], { equal: true }), { maxWidth: 20 })).toEqual(["a b"]);
  });

  it("an item wider than the offer takes one column and ends in an ellipsis", () => {
    expect(collectLines(new Columns(["x".repeat(12), "b"]), { maxWidth: 5 })).toEqual(["xxxx…", "b    "]);
  });

  it("gives an empty item a column one cell wide, as the reference's grid does (rich-columns-i08a)", () => {
    expect(collectLines(new Columns(["a", ""]), { maxWidth: 20 })).toEqual(["a  "]);
    expect(collectLines(new Columns(["", "a"], { padding: 0, expand: true }), { maxWidth: 9 })).toEqual(["     a   "]);
    expect(collectLines(new Columns(["", "a", ""], { padding: [0, 2] }), { maxWidth: 20 })).toEqual(["  a   "]);
    // Where that cell does not fit, the grid shrinks the other columns to make
    // room and then draws the empty column at no width after all.
    expect(collectLines(new Columns(["aaaa", ""]), { maxWidth: 5 })).toEqual(["aa… "]);
    expect(collectLines(new Columns(["a", "", "b"], { padding: 0 }), { maxWidth: 2 })).toEqual(["a"]);
  });

  it("measures a listing of 200,000 items", () => {
    // Taken as one argument per item, the widest of this many overflows the call stack.
    const columns = new Columns(Array.from({ length: 200_000 }, () => "a"));
    expect(columns.measure({ maxWidth: 80 })).toEqual({ minimum: 1, maximum: 79 });
  });
});
