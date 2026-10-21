import { describe, it, expect } from "vitest";
import { ListView } from "../../src/renderables/list-view.js";
import { moveSelection } from "../../src/core/selection.js";
import { SCROLLBAR, Viewport, ViewportPerKey } from "../../src/renderables/viewport.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Measurement } from "../../src/core/measure.js";
import { render, type Renderable } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] What a list shows for a selection, and where a
// selection moves to.

function shown(list: Renderable, rows: number, maxWidth = 10): string[] {
  const lines = Segment.splitLines(render(list, { maxWidth, height: { rows, exact: true } }));
  return lines.map((line) => line.map((s) => s.text).join("").trimEnd());
}

/** Items named "a", "b", … each `heights[i]` lines tall: "a0", "a1", … */
function items(...heights: number[]): Renderable[] {
  return heights.map((h, i) => {
    const name = String.fromCharCode(97 + i);
    return new RichText(Array.from({ length: h }, (_, j) => `${name}${j}`).join("\n"));
  });
}

describe("moveSelection", () => {
  it("moves by delta inside the list", () => {
    expect(moveSelection(2, 1, 5)).toBe(3);
    expect(moveSelection(2, -2, 5)).toBe(0);
  });

  it("holds to the ends, and ±Infinity names them", () => {
    expect(moveSelection(1, -9, 5)).toBe(0);
    expect(moveSelection(1, 9, 5)).toBe(4);
    expect(moveSelection(3, -Infinity, 5)).toBe(0);
    expect(moveSelection(3, Infinity, 5)).toBe(4);
  });

  it("returns the index itself when nothing moves, an empty list included", () => {
    expect(moveSelection(4, 1, 5)).toBe(4);
    expect(moveSelection(0, 1, 0)).toBe(0);
  });
});

describe("ListView", () => {
  it("keeps a tall selected item in view, counting every line of the items above it", () => {
    const list = new ListView(new Viewport(), items(3, 1, 2), 2);
    expect(shown(list, 2)).toEqual(["c0", "c1"]);
  });

  it("counts lines an item wraps to at the viewport's width", () => {
    // "aaaaaaaaaa aaaaaaaaaa" wraps to two lines at 10 cells, so "b" is line 2.
    const list = new ListView(new Viewport(), [new RichText("aaaaaaaaaa aaaaaaaaaa"), new RichText("b")], 1);
    expect(shown(list, 1)).toEqual(["b"]);
  });

  it("puts gap blank lines between items, and the gap under the selection is not part of it", () => {
    const list = new ListView(new Viewport(), items(1, 1, 1), 1, { gap: 1 });
    expect(shown(list, 5)).toEqual(["a0", "", "b0", "", "c0"]);
    const scrolled = new ListView(new Viewport(), items(1, 1, 1), 1, { gap: 1 });
    expect(shown(scrolled, 1)).toEqual(["b0"]);
  });

  it("keeps context lines either side of the selection in view, where the list has them", () => {
    const viewport = new Viewport();
    expect(shown(new ListView(viewport, items(1, 1, 1, 1, 1), 3, { context: 1 }), 3)).toEqual(["c0", "d0", "e0"]);
    expect(shown(new ListView(viewport, items(1, 1, 1, 1, 1), 0, { context: 1 }), 3)).toEqual(["a0", "b0", "c0"]);
  });

  it("keeps its scroll position in the viewport handed to it, across frames", () => {
    const viewport = new Viewport();
    shown(new ListView(viewport, items(1, 1, 1, 1), 3), 2);
    expect(shown(new ListView(viewport, items(1, 1, 1, 1), 2), 2)).toEqual(["c0", "d0"]);
  });

  it("measures as its widest item plus the viewport's scrollbar gutter", () => {
    const list = new ListView(new Viewport({ scrollbar: SCROLLBAR }), [new RichText("abc"), new RichText("abcdef")], 0);
    const { minimum, maximum } = Measurement.get({ maxWidth: 40 }, list);
    expect(maximum).toBe(7);
    expect(minimum).toBe(7);
  });
});

describe("ListView's arguments", () => {
  const items = [new RichText("a"), new RichText("b")];
  it("refuses a selection that is not an item's index", () => {
    expect(() => new ListView(new Viewport(), items, -1)).toThrow(RangeError);
    expect(() => new ListView(new Viewport(), items, 2)).toThrow(RangeError);
    expect(() => new ListView(new Viewport(), items, 0.5)).toThrow(RangeError);
  });
  it("takes 0 as the selection of an empty list", () => {
    expect(() => new ListView(new Viewport(), [], 0)).not.toThrow();
  });
  it("puts its gap between items, not under the last", () => {
    const lines = Segment.splitLines(render(new ListView(new Viewport(), items, 0, { gap: 1 }), { maxWidth: 5 }));
    expect(lines.map((l) => l.map((s) => s.text).join("").trimEnd())).toEqual(["a", "", "b"]);
  });
  it("measures at an unbounded width", () => {
    const list = new ListView(new Viewport({ scrollbar: SCROLLBAR }), items, 0);
    expect(list.measure({ maxWidth: Infinity })).toEqual({ minimum: 2, maximum: 2 });
  });
  it("refuses a gap or context that is not a whole number of lines", () => {
    expect(() => new ListView(new Viewport(), items, 0, { gap: 1.5 })).toThrow(RangeError);
    expect(() => new ListView(new Viewport(), items, 0, { context: -1 })).toThrow(RangeError);
  });
});

describe("ViewportPerKey", () => {
  it("hands back the same viewport while the key holds, and a fresh one for a new key", () => {
    const viewports = new ViewportPerKey();
    const a = viewports.of("a");
    expect(viewports.of("a")).toBe(a);
    const b = viewports.of("b");
    expect(b).not.toBe(a);
    expect(viewports.of("a")).not.toBe(a);
  });

  it("makes each viewport with the options it was given", () => {
    expect(new ViewportPerKey({ rows: 3 }).of("x").rows).toBe(3);
  });
});

describe("a list rebuilt every frame", () => {
  it("lets the wheel scroll away from the selection until the selection moves", () => {
    const viewport = new Viewport();
    const frame = (selected: number) => shown(new ListView(viewport, items(1, 1, 1, 1, 1), selected), 2);
    expect(frame(0)).toEqual(["a0", "b0"]);
    viewport.scrollBy(3);
    expect(frame(0)).toEqual(["d0", "e0"]);
    expect(frame(1)).toEqual(["b0", "c0"]);
  });

  it("keeps where the wheel left it across a frame that hands its items no column", () => {
    const viewport = new Viewport({ scrollbar: SCROLLBAR });
    const frame = (maxWidth: number) => shown(new ListView(viewport, items(1, 1, 1, 1, 1), 0), 2, maxWidth);
    frame(10);
    viewport.scrollBy(3);
    expect(frame(10)[0]).toMatch(/^d0/);
    frame(1);
    expect(frame(10)[0]).toMatch(/^d0/);
  });

  it("scrolls the viewport it was handed", () => {
    const viewport = new Viewport();
    expect(shown(new ListView(viewport, items(1, 1, 1, 1, 1), 4), 2)).toEqual(["d0", "e0"]);
    expect(viewport.offset).toBe(3);
  });
});
