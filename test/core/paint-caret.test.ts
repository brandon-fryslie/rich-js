/**
 * Contract of the terminal's cursor on a `SurfaceRenderer`'s frames: it stands
 * on the frame's first `caret` cell, counted in the cells the terminal shows,
 * its shape written only when it changes, and never where the terminal
 * reorders the line itself. Text written around a frame leaves it there.
 *
 * [LAW:behavior-not-structure] What is asserted is the bytes the painter writes.
 */

import { describe, it, expect } from "vitest";

import { SurfaceRenderer } from "../../src/core/paint.js";
import { Segment, ControlType } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { OutputTarget } from "../../src/core/color.js";
import type { TextOrder } from "../../src/core/text-order.js";

const SHOW = "\x1b[?25h";
const BAR = "\x1b[5 q";
const screen = { rows: 4, cols: 20 };

const target = (textOrder: TextOrder = "plain"): OutputTarget => ({ colorSystem: null, hyperlinks: false, reducedMotion: false, textOrder });

const field = (before: Segment[] = []): Segment[][] => [[...before, new Segment("ab"), new Segment(" ", Style.null().withCaret("bar"))], [new Segment("status")]];

function painter(): { renderer: SurfaceRenderer; out: () => string } {
  let bytes = "";
  const renderer = new SurfaceRenderer("inline", (written) => (bytes += written));
  renderer.take();
  return { renderer, out: () => bytes };
}

describe("the terminal's cursor on a painted frame", () => {
  it("counts no cell for a control segment before the caret", () => {
    const { renderer, out } = painter();
    const control = new Segment("\x1b]0;title\x07", undefined, [[ControlType.SET_WINDOW_TITLE, "title"]]);
    renderer.paint(() => field([control]), screen, target());
    expect(out()).toContain(`\x1b[1A\r\x1b[2C${BAR}${SHOW}`);
  });

  it("writes the cursor's shape once while it stays the same", () => {
    const { renderer, out } = painter();
    renderer.paint(() => field(), screen, target());
    renderer.paint(() => field(), screen, target());
    expect(out().split(BAR)).toHaveLength(2);
    expect(out().split(SHOW)).toHaveLength(3);
  });

  it("is never shown where the terminal reorders the line itself", () => {
    const { renderer, out } = painter();
    expect(renderer.caret(target("logical"))).toBe(false);
    renderer.paint(() => field(), screen, target("logical"));
    expect(out()).not.toContain(SHOW);
  });

  it("goes back over the frame from the caret's row when text is written around it", () => {
    const { renderer } = painter();
    renderer.paint(() => field(), screen, target());
    const bytes = renderer.around("log line", () => field(), screen, target());
    // Home from the caret's row, the first: nothing to go up over.
    expect(bytes).toMatch(/^\x1b\[\?2026h\x1b\[\?25l\r\x1b\[2K/);
    expect(bytes).toContain("log line\n");
    expect(bytes).toContain(`\x1b[1A\r\x1b[2C${SHOW}`);
  });
});
