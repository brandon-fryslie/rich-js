import { describe, it, expect } from "vitest";
import { Layout } from "../../src/renderables/layout.js";
import type { LayoutOptions } from "../../src/renderables/layout.js";
import type { Measurable, Renderable, RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { cellLen } from "../../src/core/cells.js";
import { RichText } from "../../src/core/text.js";

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
    const text = collectText(layout, { maxWidth: 40, height: { rows: 10, exact: true } });
    expect(text).toContain("Top");
    expect(text).toContain("Bottom");
  });

  // The column split sets each pane's region, so it is the one that shapes it:
  // a short pane is padded down to its share and a long one cropped to it, and
  // the pane below starts where its share does either way.
  it("holds every pane of a column split to its share", () => {
    const layout = new Layout();
    layout.splitColumn(
      new Layout("one line"),
      new Layout(new RichText("a\nb\nc\nd\ne\nf\ng")),
      new Layout("last"),
    );
    const rows = collectText(layout, { maxWidth: 10, height: { rows: 9, exact: true } })
      .split("\n")
      .slice(0, -1);
    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.trimEnd())).toEqual([
      "one line", "", "",
      "a", "b", "c",
      "last", "", "",
    ]);
  });

  describe("with no region, a layout keeps its natural height", () => {
    const rowsOf = (opts: RenderOptions): string[] => {
      const layout = new Layout();
      layout.splitColumn(
        new Layout("head", { size: 2 }),
        new Layout(new RichText("a\nb\nc")),
      );
      return collectText(layout, opts).split("\n").slice(0, -1).map((r) => r.trimEnd());
    };
    const natural = ["head", "", "a", "b", "c"];

    it("under no budget: a declared size, else the content's height", () => {
      expect(rowsOf({ maxWidth: 10 })).toEqual(natural);
    });

    it("under a ceiling, which is not a region to fill", () => {
      expect(rowsOf({ maxWidth: 10, height: { rows: 40, exact: false } })).toEqual(natural);
    });

    it("under a region of Infinity rows, which names no count to fill", () => {
      expect(rowsOf({ maxWidth: 10, height: { rows: Infinity, exact: true } })).toEqual(natural);
    });

    it("and a region that parses to no rows holds none", () => {
      for (const rows of [NaN, -1, 0]) {
        expect(rowsOf({ maxWidth: 10, height: { rows, exact: true } })).toEqual([]);
      }
    });
  });

  it("holds every pane of a row split to the region", () => {
    const layout = new Layout();
    layout.splitRow(
      new Layout(new RichText("1\n2\n3\n4\n5")),
      new Layout("x"),
    );
    const rows = collectText(layout, { maxWidth: 4, height: { rows: 3, exact: true } })
      .split("\n")
      .slice(0, -1);
    expect(rows.map((r) => r.trimEnd())).toEqual(["1 x", "2", "3"]);
  });

  // A split hands out every cell of its region. Floored per pane, a 1:1 split of
  // five rows drew 2 + 2 and the region pad left a fifth row blank; the spare
  // cell now goes where Rich's `ratio_resolve` puts it, to the pane after.
  it("fills an odd region with a 1:1 column split", () => {
    const layout = new Layout();
    layout.splitColumn(
      new Layout(new RichText("a\na\na\na\na")),
      new Layout(new RichText("b\nb\nb\nb\nb")),
    );
    const rows = collectText(layout, { maxWidth: 3, height: { rows: 5, exact: true } })
      .split("\n")
      .slice(0, -1)
      .map((r) => r.trimEnd());
    expect(rows).toEqual(["a", "a", "b", "b", "b"]);
  });

  it("fills an odd width with a 1:1 row split", () => {
    const layout = new Layout();
    layout.splitRow(new Layout("xxxxx"), new Layout("yyyyy"));
    const rows = collectText(layout, { maxWidth: 5, height: { rows: 1, exact: true } })
      .split("\n")
      .slice(0, -1);
    expect(rows).toEqual(["xxyyy"]);
  });

  // A Measurable is free to report a fractional width; the row reads it as the
  // whole cells that hold it rather than handing a fraction to exact arithmetic.
  it("measures a row holding a pane of fractional width", () => {
    const fractional: Renderable & Measurable = {
      *render() {},
      measure: () => ({ minimum: 1, maximum: 4.5 }),
    };
    const layout = new Layout();
    layout.splitRow(new Layout(fractional), new Layout("abc"));
    expect(layout.measure({ maxWidth: 80 }).maximum).toBe(10);
  });

  // A pane that cannot measure itself has no width of its own, so a row
  // holding one offered an unbounded width has none either: measure says so,
  // and render reaches `withBoundedWidth`'s explanation rather than a BigInt error.
  it("has no natural width when a pane of its row has none", () => {
    const opaque: Renderable = { *render() {} };
    const layout = new Layout();
    layout.splitRow(new Layout(opaque), new Layout("abc"));
    expect(layout.measure({ maxWidth: Infinity }).maximum).toBe(Infinity);
    expect(() => [...layout.render({ maxWidth: Infinity })]).toThrow(/no natural width/);
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
    const options: RenderOptions = { maxWidth: 40, height: { rows: 5, exact: true } };

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

  // `ratio` is the third `LayoutOptions` number doing width arithmetic, and it
  // was the one left unparsed after `size` and `minimumSize` were fixed above.
  // It is not a cell count — a ratio of 2.5 divides space perfectly well — so it
  // is parsed to a share weight instead: anything that cannot name a share
  // becomes 0, the ratio that already means "this pane does not grow".
  //
  // Unparsed, it escaped through `measure` two ways. A NaN ratio made
  // `totalRatio` NaN and the whole measurement NaN. A negative one summed with
  // its siblings to a `totalRatio` of 0, so a row holding twelve cells of text
  // reported a natural width of 0, and the split — dividing by the same
  // ratios at render time — disagreed by handing both panes real space.
  describe("a ratio is a share weight", () => {
    const options: RenderOptions = { maxWidth: 40, height: { rows: 5, exact: true } };

    const row = (paneOptions: LayoutOptions, other = "y"): Layout => {
      const layout = new Layout();
      layout.splitRow(new Layout("x", paneOptions), new Layout(other));
      return layout;
    };

    it.each([
      ["NaN", NaN],
      ["-1", -1],
      ["Infinity", Infinity],
    ])("takes a ratio of %s as a pane that does not grow", (_name, given) => {
      expect(row({ ratio: given }).measure(options)).toEqual(
        row({ ratio: 0 }).measure(options),
      );
    });

    // All three declared numbers are public, and `getByName` hands a caller the
    // pane to assign to long after it was built, so a constructor-only parse is
    // a border with a door beside it.
    // Each pair is a raw value and what parsing it means: a ratio that cannot
    // name a share does not grow, a size is a whole count of cells, a negative
    // minimum is no minimum. Assigning the raw value must land on the parsed
    // one, which is what an unparsed setter would fail.
    it.each([
      ["ratio", { ratio: -1 }, { ratio: 0 }],
      ["size", { size: 5.5 }, { size: 5 }],
      ["minimumSize", { minimumSize: -3 }, { minimumSize: 0 }],
    ])("parses %s however late the value arrives", (_name, raw, parsed) => {
      const mutated = row({ name: "pane" });
      Object.assign(mutated.getByName("pane")!, raw);
      expect(mutated.measure(options)).toEqual(row(parsed).measure(options));
    });

    it("keeps a fractional ratio, which divides space meaningfully", () => {
      expect(row({ ratio: 2.5 }).measure(options)).not.toEqual(
        row({ ratio: 2 }).measure(options),
      );
    });

    it("reports the width its content needs when a sibling ratio is negative", () => {
      const measured = row({ ratio: -1 }, "wide content").measure(options);
      expect(measured).toEqual({ minimum: 1, maximum: 13 });
    });

    it("never reports a measurement that is not a number", () => {
      const measured = row({ ratio: NaN }).measure(options);
      expect(Number.isFinite(measured.minimum)).toBe(true);
      expect(Number.isFinite(measured.maximum)).toBe(true);
    });
  });

  // A leaf hands its content the offer and content is free to ignore it. The
  // row path crops each pane to its share, so only the leaf could emit a line
  // wider than the region it was given — which in a row split overwrites the
  // pane beside it.
  it("crops content that ignores the width it was given", () => {
    const wide: Renderable = {
      *render() {
        yield new Segment("x".repeat(40));
        yield Segment.line();
      },
    };
    for (const maxWidth of [0, 1, 5, 12]) {
      const text = collectText(new Layout(wide), { maxWidth, height: { rows: 5, exact: true } });
      for (const line of text.split("\n")) {
        expect(cellLen(line)).toBeLessThanOrEqual(maxWidth);
      }
    }
  });

  it("leaves a space where a pane's edge cuts through a wide glyph", () => {
    // Python Rich 9d8f9a3 prints this first row for the same layout at width 9.
    const pane = new Layout(new RichText("日本語日本語", { overflow: "ignore" }));
    const text = collectText(pane, { maxWidth: 9, height: { rows: 2, exact: true } });
    expect(text.split("\n")[0]).toBe("日本語日 ");
  });

  // rich-embed-1r2m review: a leaf pads every line to its width wherever it
  // stands. Python Rich 9d8f9a3 prints `Layout("hi")` at width 12 as
  // "hi" and ten spaces.
  it("pads a leaf printed on its own to the width, as Rich does", () => {
    expect(collectText(new Layout("hi"), { maxWidth: 12 })).toBe("hi          \n");
  });

  // rich-embed-1r2m: a leaf's content keeps its own `end`, so
  // `RichText("status: ok\n")` is two lines, and a leaf is shaped to its
  // region. Python Rich 9d8f9a3 prints these for `Layout(Text("status: ok\n"))`
  // at width 12, height 1 and height 3.
  const shaped = { 1: "status: ok  \n", 3: "status: ok  \n            \n            \n" };
  it.each([1, 3] as const)("shapes a leaf whose text ends in a newline to a region of %i rows, as Rich does", (rows) => {
    const expected = shaped[rows];
    const layout = new Layout(new RichText("status: ok\n"));
    expect(collectText(layout, { maxWidth: 12, height: { rows, exact: true } })).toBe(expected);

    const updated = new Layout("placeholder");
    updated.update(new RichText("status: ok\n"));
    expect(collectText(updated, { maxWidth: 12, height: { rows, exact: true } })).toBe(expected);
  });
});
