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
import type { Renderable, RenderOptions } from "../../src/index.js";

const WIDTH = 80;

function rows(renderable: Renderable): string[] {
  const out = renderToString(renderable, { width: WIDTH, colorSystem: null, hyperlinks: false });
  return out.replace(/\n$/, "").split("\n");
}

it("the rich-explore coverage renderer produces a frame", () => {
  expect(rows(new CoverageRenderable()).join("").trim().length).toBeGreaterThan(0);
});

it("every item in the coverage view starts its own row", () => {
  const view = new CoverageRenderable();
  const frame = rows(view);
  // An item left open runs the next onto its row — the frame loses a row per
  // join, and a long join draws wider than the width it was given.
  expect(frame.filter((row) => cellLen(row) > WIDTH)).toEqual([]);
  const options: RenderOptions = { maxWidth: WIDTH, isTerminal: false, asciiOnly: false, colorSystem: null };
  const itemRows = view.items(options).reduce((sum, item) => sum + rows(item).length, 0);
  expect(frame.length).toBe(itemRows);
});
