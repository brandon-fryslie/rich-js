// [LAW:no-silent-failure] `CoverageRenderable` is the kitchen-sink renderer
// that demonstrates a dozen exports with no narrative demo of their own, and
// it is reachable only by pressing 'c' inside the rich-explore TUI. The
// Playwright suite boots each demo bundle and checks its first frame, which
// never reaches this path — so without this smoke test, a renderer that
// throws stays silent until a user presses the key.
//
// [LAW:behavior-not-structure] The contract asserted is "renders a non-empty
// frame without throwing", not the presence of any particular section: the
// file is deliberately contrived and its content is expected to churn as
// exports come and go.

import { it, expect } from "vitest";
import { CoverageRenderable } from "../../examples/rich-explore/renderers/coverage.js";
import { renderToString } from "../../src/index.js";

it("the rich-explore coverage renderer produces a frame", () => {
  const frame = renderToString(new CoverageRenderable(), {
    width: 100,
    colorSystem: null,
  });
  expect(frame.trim().length).toBeGreaterThan(0);
});
