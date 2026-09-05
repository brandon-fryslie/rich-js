/**
 * A renderable reports the width its content wants, never the width it happens
 * to have been offered.
 *
 * The distinction is invisible from a renderable's own output — `Tree`,
 * `Columns` and `Layout` all rendered correctly while `measure` answered every
 * question with "all of it" — and it only surfaces one layer up, in a parent
 * that divides space from the range it is given. So this file asks the question
 * from that layer: a `Panel` in fit mode is as wide as its content plus its
 * frame, and at width 40 around nine cells of tree it used to draw 40.
 *
 * The same lie is what made an unbounded offer unrenderable — a maximum of "the
 * offer" is `Infinity` when the offer is unbounded — and `width-sweep.test.ts`
 * holds that end. This one holds the ordinary-width end, which is where users
 * actually met it.
 */
import { describe, it, expect } from "vitest";
import { Panel } from "../../src/renderables/panel.js";
import { Tree } from "../../src/renderables/tree.js";
import { Columns } from "../../src/renderables/columns.js";
import { Layout } from "../../src/renderables/layout.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import { cellLen } from "../../src/core/cells.js";
import type { Measurable, Renderable, RenderOptions } from "../../src/core/protocol.js";

/** A generous offer: every renderable below wants far less than this. */
const OFFER = 40;

/** Panel's frame at its default padding: two borders and one cell either side. */
const PANEL_OVERHEAD = 4;

const options: RenderOptions = { maxWidth: OFFER, height: 8, maxHeight: 8 };

const contents: ReadonlyArray<{
  readonly name: string;
  readonly make: () => Renderable & Measurable;
  /**
   * The text that must survive, grouped by the row it belongs on. A width is a
   * claim about layout, and this is the half of that claim a cell count cannot
   * carry: `left` and `right` sharing one row is the whole content of "9 cells
   * wide", and a renderable that reports 9 and then wraps has told the truth
   * about its width and a lie about its content.
   */
  readonly rows: ReadonlyArray<readonly string[]>;
}> = [
  {
    name: "Tree",
    make: () => {
      const root = new Tree("root");
      root.add("child one");
      return root;
    },
    rows: [["root"], ["child one"]],
  },
  {
    name: "Columns",
    make: () => new Columns([new RichText("alpha"), new RichText("beta")]),
    rows: [["alpha", "beta"]],
  },
  {
    name: "Columns of items narrower than a column",
    // Auto mode sized its columns at a flat four cells while reporting a
    // natural width built from the items, so six two-cell items claimed 22 and
    // then wrapped into two rows at 22. Four-cell items never showed it.
    make: () => new Columns(["aa", "bb", "cc", "dd", "ee", "ff"]),
    rows: [["aa", "bb", "cc", "dd", "ee", "ff"]],
  },
  {
    name: "Layout row split",
    make: () => {
      const layout = new Layout();
      layout.splitRow(new Layout("left"), new Layout("right"));
      return layout;
    },
    rows: [["left", "right"]],
  },
  {
    name: "Layout row split at unequal ratios",
    // One budget feeds every pane, so the wider pane sets the width for all of
    // them: summing what each child wants under-reports whatever ratio is
    // hungriest, and that child renders cropped at the width sized to fit it.
    make: () => {
      const layout = new Layout();
      layout.splitRow(
        new Layout("narrow", { ratio: 2 }),
        new Layout("a wide pane", { ratio: 1 }),
      );
      return layout;
    },
    rows: [["narrow", "a wide pane"]],
  },
  {
    name: "Layout row split with a pane that does not grow",
    // `ratio: 0` says this pane stays at its `minimumSize`, so it is paid like
    // a fixed pane and never reaches the ratio division. Inverted through that
    // division instead, it divided by its own zero: `Infinity` here, which
    // `measure` clamped back into "I want the whole offer".
    make: () => {
      const layout = new Layout();
      layout.splitRow(new Layout("a", { ratio: 0 }), new Layout("bcd"));
      return layout;
    },
    rows: [["a", "bcd"]],
  },
  {
    name: "Layout row split of nothing but a non-growing pane",
    // The same division with no growing sibling to give it a non-zero
    // `totalRatio`, which made it `0/0` — `measure` returned {NaN, NaN}.
    make: () => {
      const layout = new Layout();
      layout.splitRow(new Layout("x", { ratio: 0 }));
      return layout;
    },
    rows: [["x"]],
  },
  {
    name: "Layout row split with a non-growing pane among growing ones",
    // The pane drew its minimum from a budget the ratio shares had already
    // spent, so the row consumed `3 + 2*floor(T/2)` cells out of `T` and no
    // budget satisfied everyone; it came out right at 16 only because the
    // trailing clamp happened to land there.
    make: () => {
      const layout = new Layout();
      layout.splitRow(
        new Layout("zzz", { ratio: 0, minimumSize: 3 }),
        new Layout("aaaaa"),
        new Layout("bbbbb"),
      );
      return layout;
    },
    rows: [["zzz", "aaaaa", "bbbbb"]],
  },
  {
    name: "Layout column split",
    make: () => {
      const layout = new Layout();
      layout.splitColumn(new Layout("top"), new Layout("a longer bottom"));
      return layout;
    },
    rows: [["top"], ["a longer bottom"]],
  },
];

/** Whether one rendered row holds every fragment, in order and unbroken. */
function holdsInOrder(line: string, fragments: readonly string[]): boolean {
  let from = 0;
  for (const fragment of fragments) {
    const at = line.indexOf(fragment, from);
    if (at === -1) return false;
    from = at + fragment.length;
  }
  return true;
}

function renderedLines(renderable: Renderable, maxWidth: number): string[][] {
  const segments = [...renderable.render({ ...options, maxWidth })];
  return Segment.splitLines(segments).map((line) => line.map((s) => s.text));
}

function lineWidths(renderable: Renderable, maxWidth: number): number[] {
  return renderedLines(renderable, maxWidth).map((line) =>
    line.reduce((total, text) => total + cellLen(text), 0),
  );
}

describe("natural width", () => {
  for (const content of contents) {
    describe(content.name, () => {
      it("measures its content, not the offer", () => {
        const measurement = content.make().measure(options);
        expect(
          measurement.maximum,
          `claimed the whole ${OFFER}-cell offer as its maximum`,
        ).toBeLessThan(OFFER);
        expect(measurement.minimum).toBeLessThanOrEqual(measurement.maximum);
      });

      it("shrink-wraps inside a fit-mode Panel", () => {
        const natural = content.make().measure(options).maximum;
        const panel = new Panel(content.make(), { expand: false });
        const widths = new Set(lineWidths(panel, OFFER));

        expect(
          [...widths],
          "a fit-mode panel is its content plus its frame, and every row of it agrees",
        ).toEqual([natural + PANEL_OVERHEAD]);
      });

      it("renders its content intact at the width it reports", () => {
        // The three assertions around this one all read a cell count, and a
        // cell count is exactly what a renderable that crops its own content
        // still gets right: `Panel`'s padding absorbed the shortfall, so the
        // totals agreed while the pane inside them wrapped. This one reads the
        // text.
        const natural = content.make().measure(options).maximum;
        const lines = renderedLines(content.make(), natural).map((line) =>
          line.join(""),
        );

        for (const row of content.rows) {
          expect(
            lines.some((line) => holdsInOrder(line, row)),
            `no row held ${row.join(" + ")} at the reported natural width of `
              + `${natural}; rendered ${JSON.stringify(lines)}`,
          ).toBe(true);
        }
      });

      it("still fills the offer inside an expanding Panel", () => {
        // Fit mode is a choice, not the only mode: the same content inside an
        // expanding panel takes the whole offer, so this is a narrower measure
        // rather than a renderable that forgot how to expand.
        const panel = new Panel(content.make());
        expect(new Set(lineWidths(panel, OFFER))).toEqual(new Set([OFFER]));
      });
    });
  }

  it("reports a declared Panel width as both ends of its range", () => {
    // `_getPanelWidth` returns a declared width before it measures anything, so
    // the panel draws at exactly that width and the range has nothing to vary.
    // Reported with a content-derived floor, `{width: 20}` around "hi" answered
    // 6..20 and drew 20, and a parent dividing from the floor granted it six.
    const panel = new Panel(new RichText("hi"), { width: 20 });
    const offered: RenderOptions = { ...options, maxWidth: 100 };

    expect(panel.measure(offered)).toEqual({ minimum: 20, maximum: 20 });
    expect(new Set(lineWidths(panel, 100))).toEqual(new Set([20]));
  });

  it("reports nothing for a split whose every child is hidden", () => {
    // `render` reads leafness off `_children`, so a layout that holds content
    // *and* children draws the children — none here, so nothing. `measure`
    // read it off the *visible* children, found none, and answered as a leaf
    // with the content's width, sizing a fit-mode Panel for twelve cells that
    // never reach the screen.
    const layout = new Layout("CONTENT-HERE");
    layout.splitRow(new Layout("hidden", { visible: false }));

    expect(layout.measure(options).maximum).toBe(0);
    expect(renderedLines(layout, OFFER)).toEqual([]);
  });
});
