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
import { declareCapabilities } from "../../src/core/terminal-capabilities.js";
import { Segment, ControlType } from "../../src/core/segment.js";
import { Style, caretMark, caretMarkOn } from "../../src/core/style.js";
import type { OutputTarget } from "../../src/core/color.js";
import type { TextOrder } from "../../src/core/text-order.js";

const SHOW = "\x1b[?25h";
const BAR = "\x1b[5 q";
const screen = { rows: 4, cols: 20 };

const target = (textOrder: TextOrder = "plain"): OutputTarget => ({ colorSystem: null, hyperlinks: false, isTerminal: false, reducedMotion: false, textOrder });

const field = (before: Segment[] = []): Segment[][] => [[...before, new Segment("ab"), new Segment(" ", Style.null().withCaret(caretMark("bar")))], [new Segment("status")]];

function painter(): { renderer: SurfaceRenderer; out: () => string } {
  let bytes = "";
  const renderer = new SurfaceRenderer("inline", (written) => (bytes += written), () => ({ capabilities: declareCapabilities([], "other"), policy: "strict", layers: [], onSend: undefined }));
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

  it.each([
    ["bar", 5, "\x1b[4C"],
    ["block", 1, "\x1b[2C"],
  ] as const)("puts a %s marked on its cell's right side where that shape stands (DECSCUSR %i)", (shape, code, to) => {
    const { renderer, out } = painter();
    // A two-cell glyph at column 2: a bar stands past it, a block covers it.
    const row = [[new Segment("ab"), new Segment("日", Style.null().withCaret(caretMarkOn(shape, "right")))], [new Segment("status")]];
    renderer.paint(() => row, screen, target("visual"));
    expect(out()).toContain(`\x1b[1A\r${to}\x1b[${code} q${SHOW}`);
  });

  it("stands on the last column when its cell is cut off past the screen's edge", () => {
    const { renderer, out } = painter();
    const wide = [[new Segment("x".repeat(20)), new Segment(" ", Style.null().withCaret(caretMark("bar")))], [new Segment("status")]];
    renderer.paint(() => wide, screen, target());
    expect(out()).toContain(`\x1b[1A\r\x1b[19C${BAR}${SHOW}`);
  });
});
