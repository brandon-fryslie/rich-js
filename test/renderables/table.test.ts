import { describe, it, expect } from "vitest";
import { Table, Column } from "../../src/renderables/table.js";
import { Panel } from "../../src/renderables/panel.js";
import { RichText } from "../../src/core/text.js";
import { MarkupError } from "../../src/core/markup.js";
import { Segment } from "../../src/core/segment.js";
import { ASCII, MARKDOWN, HEAVY_HEAD, Box } from "../../src/core/box.js";
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

  it("draws the header row with the head characters", () => {
    const t = new Table();
    t.addColumn("A");
    t.addColumn("B");
    t.addRow("1", "2");
    expect(collectLines(t, { maxWidth: 40 })).toEqual([
      "┏━━━┳━━━┓",
      "┃ A ┃ B ┃",
      "┡━━━╇━━━┩",
      "│ 1 │ 2 │",
      "└───┴───┘",
    ]);
  });

  // Header, body and footer rows all come out of one code path, so selecting the
  // head glyphs per-row is the whole difficulty — hardcode them and every row
  // goes heavy. The default box draws its footer on the body verticals, which is
  // what the reference does for it; the sentinel-grid test below is the one that
  // proves the footer reads its own line rather than borrowing the body's.
  it("leaves the footer row on the body characters", () => {
    const t = new Table({ showFooter: true });
    t.addColumn("Head", { footer: "Foot" });
    t.addRow("1");
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines).toContain("┃ Head ┃");
    expect(lines).toContain("│ 1    │");
    expect(lines).toContain("│ Foot │");
  });

  // Every row a table can draw comes from its own line of the box grid, and a
  // grid of distinct glyphs is what makes a row sourced from the wrong line
  // visible. The exception is a content row's fill column — the reference
  // writes a space there and nothing ever draws it. The frames the shipped
  // constants draw are pinned in test/core/box.test.ts.
  it("draws each row from its own line of the box grid", () => {
    const sentinel = new Box(
      "1234\n" +
      "5 67\n" +
      "89ab\n" +
      "c de\n" +
      "fghi\n" +
      "jklm\n" +
      "n op\n" +
      "qrst",
    );
    const t = new Table({ box: sentinel, showFooter: true, showLines: true });
    t.addColumn("A", { footer: "F" });
    t.addColumn("B", { footer: "G" });
    t.addRow("1", "2");
    t.addRow("3", "4");

    expect(collectLines(t, { maxWidth: 40 })).toEqual([
      "122232224",   // top border
      "5 A 6 B 7",   // header content
      "8999a999b",   // header separator
      "c 1 d 2 e",   // body content
      "fggghgggi",   // row separator
      "c 3 d 4 e",   // body content
      "jkkklkkkm",   // footer separator
      "n F o G p",   // footer content
      "qrrrsrrrt",   // bottom border
    ]);
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

  it("leaves a column with no footer blank beside one that has a footer", () => {
    // The only test that reads the absent-footer arm's content: a footerless
    // column renders blank rather than borrowing anything. Matches the
    // reference character for character.
    const t = new Table({ showFooter: true });
    t.addColumn("A", { footer: "F" });
    t.addColumn("B");
    t.addRow("1", "2");
    expect(collectLines(t, { maxWidth: 20 })).toEqual([
      "┏━━━┳━━━┓",
      "┃ A ┃ B ┃",
      "┡━━━╇━━━┩",
      "│ 1 │ 2 │",
      "├───┼───┤",
      "│ F │   │",
      "└───┴───┘",
    ]);
  });

  // The flag alone decides whether these rows are drawn. Both used to
  // additionally require some column to have content, so a table that asked for
  // a row silently did not get one and nothing reported it. The four frames
  // below came from Python Rich at width 20, not from this port.
  it("draws the footer row when showFooter is set and no column has a footer", () => {
    const t = new Table({ showFooter: true });
    t.addColumn("H");
    t.addRow("x");
    expect(collectLines(t, { maxWidth: 20 })).toEqual([
      "┏━━━┓",
      "┃ H ┃",
      "┡━━━┩",
      "│ x │",
      "├───┤",
      "│   │",
      "└───┘",
    ]);
  });

  it("draws the same footer row whether the footer is absent or empty", () => {
    // `footer: ""` was the one spelling that unlocked the row, so the two
    // footerless spellings disagreed with each other as well as with Rich.
    // Absent and empty are the same footer; this is the arm that says so.
    const absent = new Table({ showFooter: true });
    absent.addColumn("H");
    absent.addRow("x");
    const empty = new Table({ showFooter: true });
    empty.addColumn("H", { footer: "" });
    empty.addRow("x");
    expect(collectLines(absent, { maxWidth: 20 })).toEqual(collectLines(empty, { maxWidth: 20 }));
  });

  it("draws the header row and its separator when every header is blank", () => {
    // Blank headers used to cost two lines rather than one: the guard sat above
    // the separator as well as the row it was about.
    const t = new Table();
    t.addColumn("");
    t.addRow("x");
    expect(collectLines(t, { maxWidth: 20 })).toEqual([
      "┏━━━┓",
      "┃   ┃",
      "┡━━━┩",
      "│ x │",
      "└───┘",
    ]);
  });

  it("draws no header row when showHeader is false and the header has content", () => {
    // The negative arm of the same flag. Reading the flag alone has to keep
    // suppressing a header that has content, not merely stop suppressing a
    // blank one — and the box goes plain-headed with it.
    const t = new Table({ showHeader: false });
    t.addColumn("H");
    t.addRow("x");
    expect(collectLines(t, { maxWidth: 20 })).toEqual([
      "┌───┐",
      "│ x │",
      "└───┘",
    ]);
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

  /*
   * A `RichText`'s own `noWrap` beats the options `render` is handed, so a
   * caller could hand the table a title it had unbounded and the frame had no
   * say: the title left at its natural width and ran straight through the
   * corner, 49 cells out of a 20-cell table. The invariant above is what makes
   * this a bug and not a preference — the table owns its canvas.
   */
  it("stays inside the width when the title and caption carry their own noWrap", () => {
    const long = "A title far longer than this table will ever be";
    const title = new RichText(long);
    title.noWrap = true;
    const caption = new RichText(long);
    caption.noWrap = true;
    const t = populate(new Table({ box: ASCII, title, caption }));

    for (const width of widths) {
      const widest = Math.max(0, ...collectLines(t, { maxWidth: width }).map(cellLen));
      expect({ width, widest }).toEqual({ width, widest: Math.min(widest, width) });
    }
  });

  /*
   * Where that rule stops. `noWrap` decides whether the line is bounded at all
   * and the frame is the bound, so the table takes it; `overflow` only decides
   * how a line meets an edge it cannot move, and every method cuts within the
   * budget. Clearing it too would overrule a caller for no invariant's sake,
   * so the caller keeps it — and this is the test that says so, because the
   * cheap way to fix the bug above is to clear all three and never notice.
   */
  it("leaves a title's own overflow method to the caller", () => {
    // Unbreakable, because that is the only text whose overflow method is
    // observable: anything a wrap can resolve is resolved before the method is
    // consulted, and `ellipsis` and `fold` render a wrappable title alike.
    const word = "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const titleOf = (overflow?: "fold" | "crop" | "ellipsis") => {
      const title = new RichText(word);
      title.overflow = overflow;
      const lines = collectLines(populate(new Table({ box: ASCII, title })), { maxWidth: 20 });
      return lines.slice(0, lines.findIndex((line) => line.startsWith("+")));
    };

    expect(titleOf("ellipsis")).toHaveLength(1);
    expect(titleOf("ellipsis")[0]!.trim().endsWith("\u2026")).toBe(true);
    expect(titleOf(undefined).length).toBeGreaterThan(1);
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
    // The elastic cell wraps down its five cells rather than ellipsizing on
    // one, so the first body line is what pins the split.
    expect(collectLines(t, { maxWidth: 12 })).toContain("|abcd|a    |");
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

  it("gives a width-0 column no content cell, only its padding and divider", () => {
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn(undefined, { width: 0 });
    t.addColumn();
    t.addRow("hidden", "shown");
    // A spacer asks for nothing, so the seating pass seats it at nothing — the
    // two cells are its padding.
    expect(collectLines(t, { maxWidth: 20 })).toContain("|  | shown |");
  });

  it("gives a column with no header and no content no content cell either", () => {
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn();
    t.addColumn();
    t.addRow("", "x");
    expect(collectLines(t, { maxWidth: 20 })).toContain("|  | x |");
  });

  it("floors a negative declared width at zero instead of throwing", () => {
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn(undefined, { width: -3 });
    t.addColumn();
    t.addRow("hidden", "shown");
    expect(collectLines(t, { maxWidth: 20 })).toContain("|  | shown |");
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

  it("treats a NaN declared width as zero rather than poisoning the budget", () => {
    // NaN fails every comparison, so `budget -= NaN` does not merely mis-size
    // this column — it disables the seating loop's `budget < cost` check for
    // every column after it.
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn(undefined, { width: NaN });
    t.addColumn();
    t.addRow("hidden", "shown");
    expect(collectLines(t, { maxWidth: 20 })).toContain("|  | shown |");
  });

  it("treats NaN column bounds as no bounds", () => {
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn(undefined, { minWidth: NaN });
    t.addColumn();
    t.addRow("hidden", "shown");
    expect(collectLines(t, { maxWidth: 20 })).toContain("|  | shown |");
  });

  it("renders a NaN width as a zero width rather than an unbounded frame", () => {
    const build = (): Table => {
      const t = new Table({ box: ASCII, showHeader: false });
      t.addColumn();
      t.addColumn();
      t.addRow("a", "b");
      return t;
    };
    // Comparing against width 0 rather than asserting no line is too wide:
    // every line is narrower than NaN, so a width check alone passes on any
    // output at all.
    expect(collectLines(build(), { maxWidth: NaN })).toEqual(
      collectLines(build(), { maxWidth: 0 }),
    );
  });

  it("keeps the measurement range upright when the declared width exceeds the offer", () => {
    // `Measurement.get` clamps only the maximum, so a floor laid out against
    // the declared width lands above its own ceiling.
    const t = new Table({ width: 1000, box: ASCII, showHeader: false });
    t.addColumn();
    t.addColumn();
    t.addColumn();
    t.addRow("a", "b", "c");
    const m = t.measure({ maxWidth: 5 });
    expect(m.minimum).toBeLessThanOrEqual(m.maximum);
    expect(m.maximum).toBeLessThanOrEqual(5);
  });

  it("keeps a NaN padding side from poisoning the budget", () => {
    // `normalizePadding` floors it, so `layoutTable` trusts its argument: a
    // NaN `per` would subtract NaN from the shared budget and switch off every
    // bounds check after it.
    const build = (padding: number): Table => {
      const t = new Table({ box: ASCII, showHeader: false, padding });
      t.addColumn();
      t.addColumn();
      t.addRow("aa", "shown");
      return t;
    };
    expect(collectLines(build(NaN), { maxWidth: 20 })).toEqual(
      collectLines(build(0), { maxWidth: 20 }),
    );
  });

  it("keeps an infinite column bound from skewing the columns beside it", () => {
    // `Infinity` is a legal outer width and not a legal demand: it reaches
    // `distribute` as `Infinity / Infinity`, which is NaN, and the NaN spreads
    // to every other elastic column.
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn(undefined, { minWidth: Infinity });
    t.addColumn();
    t.addRow("aa", "shown");
    const lines = collectLines(t, { maxWidth: 20 });
    expect(new Set(lines.map(cellLen))).toEqual(new Set([20]));
  });

  it("keeps an infinite ratio from skewing the columns beside it", () => {
    const t = new Table({ box: ASCII, showHeader: false });
    t.addColumn(undefined, { ratio: Infinity });
    t.addColumn(undefined, { ratio: 1 });
    t.addRow("a", "b");
    const lines = collectLines(t, { maxWidth: 20 });
    expect(new Set(lines.map(cellLen))).toEqual(new Set([20]));
  });

  it("pads a fractional side as its floor, so the frame still closes", () => {
    // A fractional pad reaches `" ".repeat`, which truncates, while the box
    // rows are measured arithmetically: the content row came out 11 cells
    // under a 13-cell border.
    const build = (padding: number): Table => {
      const t = new Table({ box: ASCII, showHeader: false, padding });
      t.addColumn();
      t.addColumn();
      t.addRow("ab", "cd");
      return t;
    };
    expect(collectLines(build(1.5), { maxWidth: 20 })).toEqual(
      collectLines(build(1), { maxWidth: 20 }),
    );
  });

  it("buys no more cells for a fractional width than for its floor", () => {
    // A fractional budget survives into `distribute`'s largest-remainder pass,
    // which grants a whole cell against a fractional residue — so a request of
    // 10.5 bought 11.
    const build = (): Table => {
      const t = new Table({ box: ASCII, showHeader: false });
      t.addColumn();
      t.addRow("abcdefgh");
      return t;
    };
    for (const width of [3.5, 7.25, 9.5, 10.5, 20.5]) {
      expect(collectLines(build(), { maxWidth: width }), `width ${width}`).toEqual(
        collectLines(build(), { maxWidth: Math.floor(width) }),
      );
    }
  });
});

// `Table.measure` was the one `measure` in the library that did not begin at
// `withCellWidth`, taking `rawOptions.maxWidth` straight into `_outerWidth` and
// `layoutTable`. It reported sane numbers anyway, because `layoutTable` floors
// the width again internally — a protection belonging to a different function's
// contract, one call deep, and invisible to a reader auditing this one.
//
// [LAW:behavior-not-structure] So this asserts the contract rather than which
// call enforces it: whatever a caller hands `measure`, the range that comes back
// is a pair of cell counts, and it equals the range for the width that number
// floors to. It survives either enforcement point moving, and fails if both go.
describe("Table measures against a parsed width", () => {
  function populated(): Table {
    const t = new Table({ box: ASCII });
    t.addColumn("Name");
    t.addRow("Widget");
    return t;
  }

  it.each([
    ["NaN", NaN, 0],
    ["-5", -5, 0],
    ["7.5", 7.5, 7],
  ])("measures a maxWidth of %s as the width it floors to", (_n, given, floored) => {
    expect(populated().measure({ maxWidth: given })).toEqual(
      populated().measure({ maxWidth: floored }),
    );
  });

  it("never reports a fractional or negative range", () => {
    for (const maxWidth of [NaN, -5, 7.5, 0.5, 20]) {
      const m = populated().measure({ maxWidth });
      expect(Number.isInteger(m.minimum)).toBe(true);
      expect(Number.isInteger(m.maximum)).toBe(true);
      expect(m.minimum).toBeGreaterThanOrEqual(0);
      expect(m.maximum).toBeGreaterThanOrEqual(m.minimum);
    }
  });
});

describe("Table markup", () => {
  // The five positions a caller's string reaches the terminal through. Each
  // built its own `RichText` straight from the constructor, which does not
  // parse markup, so each shipped `[red]…[/red]` to the terminal verbatim.
  // They are one rule with five call sites, so they are one assertion driven
  // by five values rather than five copies of it.
  function markupTable(): Table {
    const t = new Table({
      title: "[red]Title[/red]",
      caption: "[red]Caption[/red]",
      showFooter: true,
    });
    t.addColumn("[red]Head[/red]", { footer: "[red]Foot[/red]" });
    t.addRow("[red]Cell[/red]");
    return t;
  }

  it.each(["Title", "Caption", "Head", "Foot", "Cell"])(
    "renders %s's markup as style rather than literal tag text",
    (word) => {
      const segs = [...markupTable().render({ maxWidth: 40 })];
      const plain = segs.map((s) => s.text).join("");

      // Both halves are load-bearing: consuming the tags without applying the
      // style would satisfy the first assertion alone.
      expect(plain).toContain(word);
      expect(plain).not.toContain("[red]");
      expect(segs.find((s) => s.text === word)?.style?.color?.name).toBe("red");
    },
  );

  it("renders docs/tables.md's flagship row styled, tags consumed", () => {
    const t = new Table();
    t.addColumn("Movie");
    t.addRow("[red]Solo[/red]: A Star Wars Story");
    const segs = [...t.render({ maxWidth: 40 })];
    const plain = segs.map((s) => s.text).join("");

    expect(plain).toContain("Solo: A Star Wars Story");
    expect(plain).not.toContain("[red]");
    expect(segs.find((s) => s.text === "Solo")?.style?.color?.name).toBe("red");
  });

  it("sizes a column to the text markup leaves behind, not to the tags", () => {
    // The measure path is the other consumer of a cell's text. Measuring the
    // raw value sized this column to `[red]Solo[/red]` — fifteen cells for
    // four cells of text — and the table still rendered, just far too wide.
    const t = new Table();
    t.addColumn("H");
    t.addRow("[red]Solo[/red]");
    expect(collectLines(t, { maxWidth: 60 })).toEqual([
      "\u250f\u2501\u2501\u2501\u2501\u2501\u2501\u2513",
      "\u2503 H    \u2503",
      "\u2521\u2501\u2501\u2501\u2501\u2501\u2501\u2529",
      "\u2502 Solo \u2502",
      "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
    ]);
  });

  it("renders every line of a title, not just the first", () => {
    // Frame copied from the reference, which renders both lines centered.
    // Taking `splitLines(...)[0]` dropped the rest with no truncation mark.
    const t = new Table({ title: "Line one\nLine two" });
    t.addColumn("HeaderIsWide");
    t.addRow("x");
    expect(collectLines(t, { maxWidth: 40 }).slice(0, 2)).toEqual([
      "    Line one    ",
      "    Line two    ",
    ]);
  });

  // The reference emits no line for empty content in either position, and
  // `title`/`caption` each document two input shapes. The rule is one rule, so
  // it is one assertion driven by four values \u2014 a `RichText` arriving with its
  // default `end` of "\n" drew a blank line where a string drew none. The whole
  // frame is compared rather than its first line: a stray caption line lands at
  // the bottom, where reading `[0]` alone could never have found it.
  it.each([
    ["a string title", { title: "" }],
    ["a RichText title", { title: new RichText("") }],
    ["a string caption", { caption: "" }],
    ["a RichText caption", { caption: new RichText("") }],
  ])("gives %s with no content no line at all", (_, options) => {
    const t = new Table(options);
    t.addColumn("H");
    t.addRow("x");
    expect(collectLines(t, { maxWidth: 30 })).toEqual([
      "\u250f\u2501\u2501\u2501\u2513",
      "\u2503 H \u2503",
      "\u2521\u2501\u2501\u2501\u2529",
      "\u2502 x \u2502",
      "\u2514\u2500\u2500\u2500\u2518",
    ]);
  });

  it("lets titleJustify outrank a justify carried by the title text", () => {
    // Two owners of one alignment: a `RichText` with its own `justify` pads
    // itself to full width inside `render`, which used to collapse the gap and
    // silently win over the table's option.
    const title = new RichText("T");
    title.justify = "left";
    const t = new Table({ title, titleJustify: "right" });
    t.addColumn("HHHHHHHH");
    t.addRow("x");
    expect(collectLines(t, { maxWidth: 30 })[0]).toBe("           T");
  });

  it("sizes a column holding a renderable cell to something it can hold", () => {
    // `String(panel)` is `[object Object]`, which the tag pattern swallows
    // whole — markup-parsing a non-string cell measured this column as zero.
    const t = new Table();
    t.addColumn("H");
    t.addRow(new Panel(new RichText("hello")));
    const lines = collectLines(t, { maxWidth: 40 });
    expect(lines.some((l) => l.includes("hello"))).toBe(true);
    expect(lines.every((l) => cellLen(l) > 1)).toBe(true);
  });

  it("leaves brackets that are not tags alone", () => {
    // Matches the reference: `TAG_RE` needs `[a-zA-Z#]` after the bracket, so
    // indices and array literals in data survive as themselves.
    const t = new Table();
    t.addColumn("H");
    t.addRow("array[0] and [1, 2, 3]");
    const plain = [...t.render({ maxWidth: 40 })].map((s) => s.text).join("");
    expect(plain).toContain("array[0] and [1, 2, 3]");
  });

  // The same five positions and the same argument as above: one rule, one
  // assertion, five values. Rich raises this `MarkupError` from all five too,
  // but at print time, because it stores the raw string — parsing at the border
  // moves the throw to the call that supplies it without inventing one. That is
  // a stated divergence, so each position that carries it is pinned; none of
  // these render, which is what makes them a claim about *when*.
  it.each([
    ["a title", () => new Table({ title: "[/bad]" })],
    ["a caption", () => new Table({ caption: "[/bad]" })],
    ["a header", () => new Table().addColumn("[/bad]")],
    ["a footer", () => new Table().addColumn("H", { footer: "[/bad]" })],
    ["a cell", () => new Table().addColumn("H").addRow("[/bad]")],
  ])("raises %s's malformed markup from the call that supplies it", (_, build) => {
    expect(build).toThrow(MarkupError);
  });

  it("adds no column when a later cell in the same row throws", () => {
    // `addRow` is all-or-nothing: a caller that catches the error and retries
    // with valid data must not find a phantom column from the failed attempt.
    const t = new Table();
    t.addColumn("H");
    expect(() => t.addRow("ok", "[/bad]")).toThrow(MarkupError);
    expect(t.columns.length).toBe(1);
  });
});

describe("Table cells wrap before the overflow method sees them", () => {
  // Both arms are the same column, the same width and the same overflow
  // method — `ellipsis`, which is what a column defaults to here and in the
  // reference. Only the cell text differs, which is the point: the method is
  // not what decides whether a wide cell is cut, so a default-value fix could
  // not have produced either of these. Wrapping runs first and the method
  // answers only what wrapping could not help.
  function cell(text: string): string[] {
    const table = new Table();
    table.addColumn("H", { width: 10 });
    table.addRow(text);
    return collectLines(table, { maxWidth: 30 });
  }

  it("grows the row for a cell that word-wraps", () => {
    expect(cell("aaaa bbbb cccc dddd")).toEqual([
      "┏━━━━━━━━━━━━┓",
      "┃ H          ┃",
      "┡━━━━━━━━━━━━┩",
      "│ aaaa bbbb  │",
      "│ cccc dddd  │",
      "└────────────┘",
    ]);
  });

  it("still ellipsizes a word no break can help", () => {
    expect(cell("aaaaaaaaaaaaaaaaaaaa")).toEqual([
      "┏━━━━━━━━━━━━┓",
      "┃ H          ┃",
      "┡━━━━━━━━━━━━┩",
      "│ aaaaaaaaa… │",
      "└────────────┘",
    ]);
  });
});
