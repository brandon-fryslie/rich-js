/**
 * The standing guard for the `rich-width-3cf` epic: a renderable never emits a
 * line wider than the width it was given, at any width down to zero, without
 * throwing.
 *
 * [LAW:dataflow-not-control-flow] One sweep, applied to a table of
 * configurations. What differs between a Panel and a Layout here is a factory
 * and a shape — values crossing one boundary — never which assertions run.
 * Per-renderable copies of this file is how the same defect reached Panel,
 * Table, Tree, Columns, Layout and Padding independently in the first place.
 *
 * WHY THE ASSERTIONS ARE SHAPED AS THEY ARE. Each one is here because a bound
 * alone was measured to miss a real bug:
 *
 *   - A renderable that emits *nothing* satisfies "no line exceeds the width".
 *     `RichText` with the default `ellipsis` overflow emitted zero lines at
 *     maxWidth 1, so every table column squeezed to one cell rendered blank and
 *     a hard-squeezed table looked like an empty frame rather than a truncated
 *     one. Hence `emits at least one line`.
 *   - A broken frame's content rows are NARROWER than its border, not wider.
 *     Padding 1.5 on a Panel gave line widths [13, 11, 13] — an open frame that
 *     an upper bound passes without complaint. Hence the shape assertion.
 *   - A width that is not an integer, or not a number at all, corrupts output
 *     without ever exceeding anything: maxWidth 10.5 emitted 11 cells, maxWidth
 *     NaN emitted the full natural width. Both are silent. Hence the reference
 *     renders, which are the strongest assertion here — they pin an exact
 *     output rather than a bound on it, and they are what "a cell count is a
 *     non-negative integer" means from the outside.
 *
 * `maxWidth: Infinity` gets its own assertion rather than a place in the width
 * loop, because the epic's bound is trivially true there — nothing can exceed an
 * unbounded width — and the defect was the opposite one: a renderable expanding
 * into a budget with no top, reaching `" ".repeat(Infinity)`. What replaced it
 * is an equality, not a bound: an unbounded offer renders exactly as the natural
 * width the renderable reports, so the two renders are compared against each
 * other. A bound alone would pass on a renderable that emitted nothing at all.
 */
import { describe, it, expect } from "vitest";
import { Panel } from "../../src/renderables/panel.js";
import { Table } from "../../src/renderables/table.js";
import type { TableOptions } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";
import { Columns } from "../../src/renderables/columns.js";
import { Layout } from "../../src/renderables/layout.js";
import { Padding } from "../../src/renderables/padding.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import { cellLen } from "../../src/core/cells.js";
import { HEAVY, ASCII } from "../../src/core/box.js";
import type { Renderable, Measurable, RenderOptions } from "../../src/core/protocol.js";

/** A renderable's own geometry, which decides whether its rows must agree. */
type Shape =
  /** Draws a frame, so every row it emits is as wide as every other. */
  | "rectangular"
  /** Rows are independent — a tree's guides and a folded line are not a box. */
  | "ragged";

interface Configuration {
  readonly name: string;
  readonly shape: Shape;
  /** Rebuilt per render: a renderable may cache against the first width it saw. */
  readonly make: () => Renderable & Measurable;
}

function renderAt(config: Configuration, maxWidth: number): string[] {
  const options: RenderOptions = { maxWidth, height: 6, maxHeight: 6 };
  return Segment.splitLines([...config.make().render(options)]).map((line) =>
    line.map((segment) => segment.text).join(""),
  );
}

/** A renderable that ignores the width it is handed, as a caller's may. */
const oversized: Renderable = {
  *render(_options: RenderOptions) {
    yield new Segment("x".repeat(40));
    yield Segment.line();
  },
};

// A declared `width` is swept like any other configuration now that
// `Table._outerWidth` bounds it by the offer. It was excluded while `render`
// laid out at the declared width and ignored a narrower `options.maxWidth`,
// which made the sweep's own bound the wrong assertion for it
// (`rich-table-width-y1a`). `Columns` still has that defect and is still out.
function table(options: TableOptions, build: (t: Table) => void): () => Table {
  return () => {
    const t = new Table(options);
    build(t);
    return t;
  };
}

const configurations: readonly Configuration[] = [
  { name: "Panel bare", shape: "rectangular", make: () => new Panel("hello world") },
  {
    name: "Panel titled + subtitled",
    shape: "rectangular",
    make: () => new Panel("hello world", { title: "Title", subtitle: "Sub" }),
  },
  {
    name: "Panel fat padding",
    shape: "rectangular",
    make: () => new Panel("hello world", { padding: [1, 4] }),
  },
  {
    name: "Panel fractional padding",
    shape: "rectangular",
    make: () => new Panel("hello world", { padding: 1.5 }),
  },
  {
    name: "Panel wrapping content that ignores its width",
    shape: "rectangular",
    make: () => new Panel(oversized, { box: HEAVY }),
  },
  { name: "Panel wide characters", shape: "rectangular", make: () => new Panel("日本語テキスト") },
  {
    name: "Table two columns",
    shape: "rectangular",
    make: table({}, (t) => {
      t.addColumn("Name");
      t.addColumn("Qty");
      t.addRow("alpha", "12");
      t.addRow("beta", "3");
    }),
  },
  {
    name: "Table with an unbounded column demand",
    shape: "rectangular",
    make: table({}, (t) => {
      t.addColumn("Name", { minWidth: Infinity });
      t.addColumn("Qty", { ratio: Infinity });
      t.addRow("alpha", "12");
    }),
  },
  {
    name: "Table at a declared width",
    shape: "rectangular",
    make: table({ width: 40 }, (t) => {
      t.addColumn("Name");
      t.addColumn("Qty");
      t.addRow("alpha", "12");
    }),
  },
  {
    name: "Table at a declared unbounded width",
    shape: "rectangular",
    // The offer is not the only door an unbounded width comes through.
    // `render` preferred `tableWidth` outright, so this walked past the value
    // `withBoundedWidth` had just resolved, granted the ratio column
    // `UNBOUNDED` cells and threw `RangeError: Invalid string length` out of
    // the top border at an ordinary offer.
    make: table({ width: Infinity }, (t) => {
      t.addColumn("Name");
      t.addRow("alpha");
    }),
  },
  {
    name: "Table at a declared unbounded width with a ratio column",
    shape: "rectangular",
    // The configuration above describes this crash and cannot reach it: its one
    // column has no ratio, so `distribute` never has an open weighted column to
    // overshoot the budget with, and the catastrophic path — `cellWidths`
    // reaching `UNBOUNDED` and `String.repeat` throwing `Invalid string length`
    // — is only armed when a declared unbounded width and a ratio column meet.
    // Reverting `_outerWidth`'s clamp is caught either way; reverting it *here*
    // is caught for the reason the clamp exists.
    make: table({ width: Infinity }, (t) => {
      t.addColumn("Name", { ratio: 1 });
      t.addRow("alpha");
    }),
  },
  {
    name: "Columns wrapping content that ignores its width",
    shape: "rectangular",
    make: () => new Columns([oversized]),
  },
  {
    name: "Table fractional padding",
    shape: "rectangular",
    // `normalizePadding` is shared with Panel, so a padding that is not a whole
    // number of cells breaks both frames the same way — it reaches `" ".repeat`,
    // which truncates, while the borders around it are measured arithmetically.
    make: table({ padding: 1.5 }, (t) => {
      t.addColumn("Name");
      t.addRow("alpha");
    }),
  },
  {
    name: "Table ascii box, no header, with title",
    shape: "rectangular",
    make: table({ box: ASCII, showHeader: false, title: "A Long Table Title" }, (t) => {
      t.addRow("alpha", "beta", "gamma");
    }),
  },
  {
    name: "Tree nested",
    shape: "ragged",
    make: () => {
      const root = new Tree("root");
      const child = root.add("child one with a long label");
      child.add("grandchild");
      root.add("child two");
      return root;
    },
  },
  {
    name: "Columns auto",
    shape: "rectangular",
    make: () => new Columns(["alpha", "beta", "gamma", "delta"]),
  },
  {
    name: "Columns equal",
    shape: "rectangular",
    make: () => new Columns(["alpha", "beta", "gamma"], { equal: true }),
  },
  {
    name: "Columns of panels",
    shape: "rectangular",
    make: () => new Columns([new Panel("one"), new Panel("two")]),
  },
  {
    name: "Padding fat",
    shape: "rectangular",
    make: () => new Padding(new RichText("hello world"), [1, 4]),
  },
  {
    name: "Padding wrapping content that ignores its width",
    shape: "rectangular",
    make: () => new Padding(oversized, 2),
  },
  {
    name: "Padding unexpanded",
    // `expand: false` is the promise not to fill a short row out to the
    // canvas, so its rows are ragged by construction — but still cropped,
    // which is the half of the contract this configuration is here to hold.
    shape: "ragged",
    make: () => new Padding(oversized, 2, { expand: false }),
  },
  {
    name: "Layout row split",
    shape: "rectangular",
    make: () => {
      const l = new Layout();
      l.splitRow(new Layout("left", { name: "l" }), new Layout("right", { name: "r" }));
      return l;
    },
  },
  {
    name: "Layout wrapping content that ignores its width",
    shape: "rectangular",
    make: () => new Layout(oversized),
  },
  {
    name: "Tree with a label that ignores its width",
    shape: "ragged",
    make: () => new Tree(oversized),
  },
  {
    name: "Layout row split with minimum sizes",
    shape: "rectangular",
    make: () => {
      const l = new Layout();
      l.splitRow(
        new Layout("left", { name: "l", minimumSize: 10 }),
        new Layout("right", { name: "r", minimumSize: 10 }),
      );
      return l;
    },
  },
];

/**
 * Every width a caller can hand a renderable that is not simply a small
 * integer. The right-hand side is the render the left-hand side must equal:
 * flooring is what makes a cell count integral, and NaN floors to nothing.
 */
const equivalentWidths: ReadonlyArray<readonly [number, number]> = [
  [10.5, 10],
  [7.25, 7],
  [3.5, 3],
  [0.5, 0],
  [NaN, 0],
  [-5, 0],
];

/**
 * The configurations with no natural width to fall back on, and the two ways to
 * end up there. Most wrap `oversized`, a `Renderable` with no `measure`, so
 * nothing in the tree knows how wide the content wants to be. The other asks for
 * an unbounded width itself, in a column declared `{ ratio: Infinity }`.
 *
 * Named here rather than discovered from the measurement, so that a renderable
 * which quietly stops reporting a natural width fails this file instead of
 * joining this list.
 *
 * Every renderable that grew the unmeasurable-content fallback in this epic is
 * here, and that is the point of the list rather than a property of it: the
 * fallback reached `Panel`, `Padding` and `Table` first and was pinned, then
 * reached `Layout`'s leaf branch and `Tree`'s label and was not, so those two
 * could have regressed with the suite green.
 */
const noNaturalWidth: ReadonlySet<string> = new Set([
  "Panel wrapping content that ignores its width",
  "Padding wrapping content that ignores its width",
  "Padding unexpanded",
  "Table with an unbounded column demand",
  "Layout wrapping content that ignores its width",
  "Tree with a label that ignores its width",
  "Columns wrapping content that ignores its width",
]);

describe("width sweep", () => {
  for (const config of configurations) {
    describe(config.name, () => {
      it("emits nothing wider than the width it was given, from 0 up", () => {
        for (let width = 0; width <= 20; width++) {
          const lines = renderAt(config, width);
          const widths = lines.map(cellLen);

          expect(
            lines.length,
            `emitted no line at all at maxWidth ${width}, which no bound on line width can catch`,
          ).toBeGreaterThan(0);

          expect(
            Math.max(...widths),
            `overflowed at maxWidth ${width}: ${JSON.stringify(lines)}`,
          ).toBeLessThanOrEqual(width);
        }
      });

      it("emits rows that agree with each other, from 0 up", () => {
        // A ragged renderable promises nothing about its rows relative to each
        // other, so the sweep asserts nothing it did not promise.
        const expected = config.shape === "rectangular" ? 1 : Infinity;
        for (let width = 0; width <= 20; width++) {
          const lines = renderAt(config, width);
          expect(
            new Set(lines.map(cellLen)).size,
            `ragged rows at maxWidth ${width} — a frame whose rows disagree is an open frame: ${JSON.stringify(lines)}`,
          ).toBeLessThanOrEqual(expected);
        }
      });

      it("renders a fractional or non-numeric width exactly as its floor", () => {
        for (const [given, floor] of equivalentWidths) {
          expect(
            renderAt(config, given),
            `maxWidth ${given} did not render as maxWidth ${floor}`,
          ).toEqual(renderAt(config, floor));
        }
      });

      it("measures a range a parent layout can act on, from 0 up", () => {
        for (let width = 0; width <= 20; width++) {
          const m = config.make().measure({ maxWidth: width, height: 6, maxHeight: 6 });
          // An inverted range — `Panel.measure({maxWidth: 1})` returned
          // {minimum: 5, maximum: 1} before this epic — is invisible to any
          // render-only assertion and cannot be divided by the parent that
          // asked for it.
          expect(m.minimum, `inverted range at maxWidth ${width}: ${JSON.stringify(m)}`)
            .toBeLessThanOrEqual(m.maximum);
          expect(m.maximum, `measured past maxWidth ${width}: ${JSON.stringify(m)}`)
            .toBeLessThanOrEqual(width);
        }
      });

      it("renders an unbounded width exactly as its own natural width", () => {
        const unbounded: RenderOptions = { maxWidth: Infinity, height: 6, maxHeight: 6 };
        const natural = config.make().measure(unbounded).maximum;

        if (noNaturalWidth.has(config.name)) {
          expect(natural, "reported a natural width it cannot have").toBe(Infinity);
          expect(
            () => renderAt(config, Infinity),
            "an unbounded offer around unmeasurable content has no answer, and silence is not one",
          ).toThrow(RangeError);
          return;
        }

        expect(natural, `measured an unbounded natural width: ${natural}`).toBeLessThan(Infinity);
        expect(
          renderAt(config, Infinity),
          `an unbounded width did not render as its natural width ${natural}`,
        ).toEqual(renderAt(config, natural));
      });
    });
  }
});
