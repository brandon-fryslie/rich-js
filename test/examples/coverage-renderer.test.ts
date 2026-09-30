// [LAW:no-silent-failure] `CoverageRenderable` is the kitchen-sink renderer
// that demonstrates a dozen exports with no narrative demo of their own, and
// it is reachable only by pressing 'c' inside the rich-explore TUI. The
// Playwright suite boots each demo bundle and checks its first frame, which
// never reaches this path — so without these tests, a renderer that throws,
// or runs one item onto the next, stays silent until a user presses the key.
//
// [LAW:behavior-not-structure] The contracts asserted are "renders a frame"
// and "each item starts its own row", never the presence of any particular
// section: the file is deliberately contrived and its content is expected to
// churn as exports come and go.

import { it, expect } from "vitest";
import { CoverageRenderable } from "../../examples/rich-explore/renderers/coverage.js";
import { cellLen, renderToString } from "../../src/index.js";
import type { Renderable } from "../../src/index.js";

const WIDTH = 80;
const DRAW = { width: WIDTH, colorSystem: null, hyperlinks: false } as const;

it("the rich-explore coverage renderer produces a frame", () => {
  expect(renderToString(new CoverageRenderable(), DRAW).trim().length).toBeGreaterThan(0);
});

it("every item in the coverage view starts its own row", () => {
  const view = new CoverageRenderable();
  // The items are built from the options the frame is drawn with, read off
  // the draw itself rather than restated here.
  let items: Renderable[] = [];
  const frame = renderToString({
    render(options) {
      items = view.items(options);
      return view.render(options);
    },
  }, DRAW);
  expect(frame.split("\n").filter((row) => cellLen(row) > WIDTH)).toEqual([]);
  // An item whose output does not end its line runs whatever follows onto
  // that line; a closed item draws nothing or finishes with a newline.
  const open = items.map((item) => renderToString(item, DRAW)).filter((out) => /[^\n]$/.test(out));
  expect(open).toEqual([]);
});
