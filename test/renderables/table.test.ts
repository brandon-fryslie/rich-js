import { describe, it, expect } from "vitest";
import { Table, Column } from "../../src/renderables/table.js";
import { Segment } from "../../src/core/segment.js";
import { ASCII, MARKDOWN, HEAVY_HEAD } from "../../src/core/box.js";
import { cellLen } from "../../src/core/cells.js";
import type { PaddingDimensions } from "../../src/renderables/padding.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(r: Renderable, opts: RenderOptions): string[] {
  const segs = [...r.render(opts)];
  return Segment.splitLines(segs).map((l) => l.map((s) => s.text).join(""));
}

describe("Table", () => {
  it("renders with header and data rows", () => {
    const t = new Table({ box: ASCII });
    t.addColumn("Name");
    t.addColumn("Age");
    t.addRow("Alice", "30");
    t.addRow("Bob", "25");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.length).toBeGreaterThanOrEqual(5); // top + header + sep + 2 rows + bottom
    expect(lines.some((l) => l.includes("Alice"))).toBe(true);
    expect(lines.some((l) => l.includes("Bob"))).toBe(true);
    expect(lines.some((l) => l.includes("Name"))).toBe(true);
  });

  it("renders empty table without error", () => {
    const t = new Table({ box: ASCII });
    t.addColumn("Col");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it("renders with no columns as blank line", () => {
    const t = new Table();
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it("auto-creates columns from addRow", () => {
    const t = new Table({ box: ASCII });
    t.addRow("a", "b", "c");
    expect(t.columns).toHaveLength(3);
  });

  it("hides header when showHeader is false", () => {
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn("Name");
    t.addRow("Alice");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("Name"))).toBe(false);
    expect(lines.some((l) => l.includes("Alice"))).toBe(true);
  });

  it("shows lines between rows when showLines is true", () => {
    const t = new Table({ box: ASCII, showLines: true });
    t.addColumn("Name");
    t.addRow("Alice");
    t.addRow("Bob");
    const lines = collectLines(t, { maxWidth: 40 });
    // Should have separators between data rows
    const separatorLines = lines.filter((l) => l.includes("---") || l.includes("+-"));
    expect(separatorLines.length).toBeGreaterThanOrEqual(2); // header sep + row sep
  });

  it("renders with title", () => {
    const t = new Table({ box: ASCII, title: "My Table" });
    t.addColumn("Col");
    t.addRow("data");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("My Table"))).toBe(true);
  });

  it("renders with caption", () => {
    const t = new Table({ box: ASCII, caption: "End" });
    t.addColumn("Col");
    t.addRow("data");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("End"))).toBe(true);
  });

  it("renders MARKDOWN style", () => {
    const t = new Table({ box: MARKDOWN });
    t.addColumn("A");
    t.addColumn("B");
    t.addRow("1", "2");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("|"))).toBe(true);
  });

  it("renders as grid with no borders", () => {
    const t = Table.grid();
    t.addColumn();
    t.addColumn();
    t.addRow("left", "right");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("left"))).toBe(true);
    expect(lines.some((l) => l.includes("right"))).toBe(true);
    expect(lines.some((l) => l.includes("|"))).toBe(false);
  });

  it("rowCount reflects added rows", () => {
    const t = new Table();
    t.addColumn("Col");
    expect(t.rowCount).toBe(0);
    t.addRow("a");
    t.addRow("b");
    expect(t.rowCount).toBe(2);
  });

  it("shows footer when showFooter is true", () => {
    const t = new Table({ box: ASCII, showFooter: true });
    t.addColumn("Name", { footer: "Total" });
    t.addRow("Alice");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("Total"))).toBe(true);
  });

  // Spec: "expand: true — Table fills maxWidth"
  // Source does not yet expand columns to fill available width; width calculation
  // uses natural content width even when totalWidth is set. Skipped until fixed.
  it.skip("expands to fill maxWidth when expand is true", () => {
    const t = new Table({ box: ASCII, expand: true });
    t.addColumn("A");
    t.addRow("x");
    const lines = collectLines(t, { maxWidth: 40 });
    // All content lines should be maxWidth wide
    const contentLines = lines.filter((l) => l.length > 0);
    expect(contentLines.every((l) => l.length === 40)).toBe(true);
  });

  it("measurement returns minimum > 0 and maximum >= minimum", () => {
    const t = new Table({ box: ASCII });
    t.addColumn("Name");
    t.addRow("Alice");
    const m = t.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeGreaterThanOrEqual(m.minimum);
    expect(m.maximum).toBeLessThanOrEqual(40);
  });

  it("renders ASCII box with +, -, | characters", () => {
    const t = new Table({ box: ASCII });
    t.addColumn("Col");
    t.addRow("data");
    const lines = collectLines(t, { maxWidth: 40 });
    // ASCII box uses +, -, | for borders
    expect(lines.some((l) => l.includes("+"))).toBe(true);
    expect(lines.some((l) => l.includes("-"))).toBe(true);
    expect(lines.some((l) => l.includes("|"))).toBe(true);
  });

  it("renders empty table (no rows) without error when header is shown", () => {
    const t = new Table({ box: ASCII });
    t.addColumn("Col");
    const lines = collectLines(t, { maxWidth: 40 });
    // Should render header even with no data rows
    expect(lines.some((l) => l.includes("Col"))).toBe(true);
  });

  it("addSection adds separator between rows", () => {
    const t = new Table({ box: ASCII });
    t.addColumn("Name");
    t.addRow("Alice");
    t.addSection();
    t.addRow("Bob");
    const lines = collectLines(t, { maxWidth: 40 });
    // There should be a separator between Alice and Bob rows
    const aliceIdx = lines.findIndex((l) => l.includes("Alice"));
    const bobIdx = lines.findIndex((l) => l.includes("Bob"));
    // At least one separator line between them
    expect(bobIdx - aliceIdx).toBeGreaterThan(1);
  });

  // Negative padding used to reach the renderer, which either threw
  // `RangeError: Invalid count value` or drew rows wider than its own
  // border, depending on how wide the column was.
  it("treats negative padding as none", () => {
    const render = (padding: PaddingDimensions, cell: string): string[] => {
      const t = new Table({ box: ASCII, padding });
      t.addColumn(cell);
      t.addRow(cell);
      return collectLines(t, { maxWidth: 40 });
    };
    // "Alice" is the shape that used to render a row wider than its own
    // border; "x" is the shape that used to throw.
    for (const cell of ["Alice", "x"]) {
      expect(render(-1, cell), `cell ${cell}`).toEqual(render(0, cell));
    }
  });
});

describe("Column", () => {
  it("constructs with defaults", () => {
    const col = new Column();
    expect(col.justify).toBe("left");
    expect(col.noWrap).toBe(false);
  });

  it("flexible when ratio is set", () => {
    expect(new Column({ ratio: 2 }).flexible).toBe(true);
    expect(new Column().flexible).toBe(false);
  });

  it("overflow defaults to ellipsis", () => {
    const col = new Column();
    expect(col.overflow).toBe("ellipsis");
  });

  it("flexible is false when ratio is 0", () => {
    expect(new Column({ ratio: 0 }).flexible).toBe(false);
  });

  it("copy creates independent instance", () => {
    const col = new Column({ header: "Test", justify: "right" });
    const copy = col.copy();
    expect(copy.header.plain).toBe("Test");
    expect(copy.justify).toBe("right");
  });
});

describe("Table stays inside the width it is given", () => {
  // A table wide enough to be squeezed hard, in the three frame shapes that
  // divide a width differently: a full box, a box without its outer edge, and
  // no box at all.
  const shapes: Array<[string, () => Table]> = [
    ["boxed", () => new Table({ box: HEAVY_HEAD })],
    ["edgeless", () => new Table({ box: ASCII, showEdge: false })],
    ["grid", () => Table.grid()],
  ];

  function populate(t: Table): Table {
    t.addColumn("Name");
    t.addColumn("Qty");
    t.addColumn("Price");
    t.addRow("Widget", "12", "$3.50");
    t.addRow("Gadget", "7", "$11.00");
    return t;
  }

  const widths = Array.from({ length: 32 }, (_, i) => i);

  for (const [name, make] of shapes) {
    it(`emits no line wider than the requested width (${name})`, () => {
      for (const width of widths) {
        const lines = collectLines(populate(make()), { maxWidth: width });
        const widest = Math.max(0, ...lines.map(cellLen));
        expect({ width, widest }).toEqual({ width, widest: Math.min(widest, width) });
      }
    });

    it(`reports a measurement range that contains itself (${name})`, () => {
      for (const width of widths) {
        const m = populate(make()).measure({ maxWidth: width });
        expect({ width, ...m }).toEqual({
          width,
          minimum: Math.min(m.minimum, m.maximum, width),
          maximum: Math.min(m.maximum, width),
        });
      }
    });
  }

  it("stays inside the width with a title and caption longer than the table", () => {
    const t = new Table({
      box: ASCII,
      title: "A title far longer than this table will ever be",
      caption: "and a caption to match",
    });
    populate(t);
    for (const width of widths) {
      const widest = Math.max(0, ...collectLines(t, { maxWidth: width }).map(cellLen));
      expect({ width, widest }).toEqual({ width, widest: Math.min(widest, width) });
    }
  });

  it("crops a wide-character title by cells, not by code units", () => {
    // Each ideograph is two cells: a 10-code-unit slice would be 20 cells wide.
    const t = new Table({ box: ASCII, title: "\u5e45\u5e45\u5e45\u5e45\u5e45\u5e45\u5e45\u5e45\u5e45\u5e45" });
    t.addColumn("A");
    t.addRow("x");
    // The table's own natural width is 5, so the title crops to 5 cells — a
    // code-unit slice would have left it 10 characters and 20 cells wide.
    expect([...new Set(collectLines(t, { maxWidth: 6 }).map(cellLen))]).toEqual([5]);
  });

  it("keeps a fixed-width column at its width and squeezes the rest", () => {
    const t = new Table({ box: ASCII, padding: 0 });
    t.addColumn("Fixed", { width: 4 });
    t.addColumn("Elastic");
    t.addRow("abcd", "a much longer cell than the other one");
    // 2 edges + 1 divider + the reserved 4 leaves 5 for the elastic column,
    // which is far wider naturally and would win every cell if a declared
    // width competed on weight instead of being reserved ahead of the bidding.
    expect(collectLines(t, { maxWidth: 12 })).toContain("|abcd|a mu…|");
  });

  it("spends its last cells on content rather than on padding", () => {
    // 2 edges + 1 divider + 2 content cells = 5; a sixth cell cannot buy the
    // padding both columns would need, so it goes to a column instead.
    const t = new Table({ box: ASCII, showHeader: false, padding: [0, 1] });
    t.addColumn(undefined, { overflow: "crop" });
    t.addColumn(undefined, { overflow: "crop" });
    t.addRow("ab", "cd");
    // The ladder: content first, then one side of the padding, then the other.
    expect(collectLines(t, { maxWidth: 6 })).toContain("|ab|c|");
    expect(collectLines(t, { maxWidth: 7 })).toContain("| a| c|");
    expect(collectLines(t, { maxWidth: 9 })).toContain("| a | c |");
  });

  it("drops the columns a width cannot seat rather than overflowing", () => {
    const t = new Table({ box: ASCII, showHeader: false, padding: 0 });
    t.addColumn();
    t.addColumn();
    t.addColumn();
    t.addRow("a", "b", "c");
    // 2 edges + 3 cells + 2 dividers needs 7; at 6 the last column is dropped
    // rather than drawn past the frame, and the freed cell stays unspent
    // because both survivors are already at their natural width.
    expect(collectLines(t, { maxWidth: 6 })).toContain("|a|b|");
    expect(collectLines(t, { maxWidth: 7 })).toContain("|a|b|c|");
  });

  // A ratio column never reaches a cap of its own, so it is the shape that
  // decides whether the width apportionment terminates on its own or only
  // because the width happened to be small.
  function ratioTable(): Table {
    const t = new Table({ box: ASCII });
    t.addColumn("A", { ratio: 1 });
    t.addColumn("B", { ratio: 3 });
    t.addRow("x", "y");
    return t;
  }

  it("apportions a very large width exactly", () => {
    // A regression guard, not a demonstration: the cell-at-a-time version this
    // replaced also passed, in 11ms — a million rounds of a two-element loop is
    // not slow enough to catch that way.
    expect(Math.max(...collectLines(ratioTable(), { maxWidth: 1_000_000 }).map(cellLen)))
      .toBe(1_000_000);
  }, 2000);

  it("returns control on an unbounded width instead of looping forever", () => {
    // `Infinity - 1 === Infinity`, so a loop that drains a budget one cell at a
    // time never leaves it. An infinite cell count cannot be rendered, so this
    // fails — but it fails, which is the contract under test.
    //
    // Read the timeout below as documentation, not as a net: the regression is
    // a synchronous loop, so it blocks the event loop and vitest cannot
    // interrupt it. This test caught the bug by wedging the run until the CI
    // job was killed, which is how it will report a reintroduction too.
    expect(() => [...ratioTable().render({ maxWidth: Infinity })]).toThrow(RangeError);
  }, 2000);

  it("leaves an ordinary table renderable at an unbounded width", () => {
    // Every bounded column caps at its natural width, so there is nothing left
    // to apportion and no reason to fail. Rejecting non-finite widths outright
    // would have cost this.
    const t = new Table({ box: ASCII });
    t.addColumn("A");
    t.addColumn("B");
    t.addRow("x", "y");
    expect(collectLines(t, { maxWidth: Infinity })).toContain("| A | B |");
  }, 2000);

  it("renders at its natural width when the width offered exceeds it", () => {
    const wide = collectLines(populate(new Table({ box: HEAVY_HEAD })), { maxWidth: 200 });
    const exact = collectLines(populate(new Table({ box: HEAVY_HEAD })), { maxWidth: 25 });
    expect(wide).toEqual(exact);
    expect(Math.max(...wide.map(cellLen))).toBe(25);
  });
});
