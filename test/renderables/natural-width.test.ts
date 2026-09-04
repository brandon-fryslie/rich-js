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
}> = [
  {
    name: "Tree",
    make: () => {
      const root = new Tree("root");
      root.add("child one");
      return root;
    },
  },
  {
    name: "Columns",
    make: () => new Columns([new RichText("alpha"), new RichText("beta")]),
  },
  {
    name: "Layout row split",
    make: () => {
      const layout = new Layout();
      layout.splitRow(new Layout("left"), new Layout("right"));
      return layout;
    },
  },
  {
    name: "Layout column split",
    make: () => {
      const layout = new Layout();
      layout.splitColumn(new Layout("top"), new Layout("a longer bottom"));
      return layout;
    },
  },
];

function lineWidths(renderable: Renderable, maxWidth: number): number[] {
  const segments = [...renderable.render({ ...options, maxWidth })];
  return Segment.splitLines(segments).map((line) =>
    line.reduce((total, segment) => total + cellLen(segment.text), 0),
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

      it("still fills the offer inside an expanding Panel", () => {
        // Fit mode is a choice, not the only mode: the same content inside an
        // expanding panel takes the whole offer, so this is a narrower measure
        // rather than a renderable that forgot how to expand.
        const panel = new Panel(content.make());
        expect(new Set(lineWidths(panel, OFFER))).toEqual(new Set([OFFER]));
      });
    });
  }
});
