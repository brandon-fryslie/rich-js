import { describe, it, expect } from "vitest";
import { Viewport } from "../../src/renderables/viewport.js";
import { Panel } from "../../src/renderables/panel.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import type { Height, Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] What a viewport shows, under the `Height`
// contract in src/core/protocol.ts, and how its operations move it.

/** `n` lines reading "0", "1", … so a shown line names its own index. */
function numbered(n: number): Renderable {
  return new RichText(Array.from({ length: n }, (_, i) => String(i)).join("\n"));
}

function shown(viewport: Renderable, height?: Height, maxWidth = 10): string[] {
  const lines = Segment.splitLines(viewport.render({ maxWidth, height }));
  return lines.map((line) => line.map((s) => s.text).join("").trimEnd());
}

const region = (rows: number): Height => ({ rows, exact: true });
const ceiling = (rows: number): Height => ({ rows, exact: false });

describe("the rows a viewport shows", () => {
  it("a region's, whatever rows it was configured with", () => {
    expect(shown(new Viewport(numbered(10), { rows: 2 }), region(4))).toEqual(["0", "1", "2", "3"]);
  });

  it("its configured rows under a ceiling taller than them", () => {
    expect(shown(new Viewport(numbered(10), { rows: 3 }), ceiling(8))).toEqual(["0", "1", "2"]);
  });

  it("the ceiling's, when it is shorter than the configured rows", () => {
    expect(shown(new Viewport(numbered(10), { rows: 6 }), ceiling(2))).toEqual(["0", "1"]);
  });

  it("the content's length under a ceiling, with no rows configured — never padded up to the ceiling", () => {
    expect(shown(new Viewport(numbered(3)), ceiling(8))).toEqual(["0", "1", "2"]);
    expect(shown(new Viewport(numbered(10)), ceiling(4))).toEqual(["0", "1", "2", "3"]);
  });

  it("the content's full length with no budget and no rows", () => {
    expect(shown(new Viewport(numbered(5)))).toHaveLength(5);
  });

  it("pads short content with blank rows up to its rows", () => {
    expect(shown(new Viewport(numbered(2), { rows: 4 }))).toEqual(["0", "1", "", ""]);
    expect(shown(new Viewport(numbered(2)), region(3))).toEqual(["0", "1", ""]);
  });

  it("parses configured rows that are not a count", () => {
    expect(shown(new Viewport(numbered(5), { rows: 2.7 }))).toEqual(["0", "1"]);
    expect(shown(new Viewport(numbered(5), { rows: -3 }))).toEqual([]);
  });

  it("renders its content with no height: the content's natural length is the scroll extent", () => {
    const seen: (Height | undefined)[] = [];
    const probe: Renderable = {
      render(options: RenderOptions) {
        seen.push(options.height);
        return [new Segment("p"), Segment.line()];
      },
    };
    shown(new Viewport(probe), region(4));
    expect(seen).toEqual([undefined]);
  });

  it("fills the region a Panel hands it, less the Panel's borders", () => {
    const lines = shown(new Panel(new Viewport(numbered(20))), region(5));
    expect(lines).toHaveLength(5);
    expect(lines.slice(1, 4).map((l) => l.replace(/[│\s]/g, ""))).toEqual(["0", "1", "2"]);
  });
});

describe("scrolling", () => {
  it("content longer than the viewport scrolls", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollTo(4);
    expect(shown(viewport)).toEqual(["4", "5", "6"]);
    viewport.scrollBy(2);
    expect(shown(viewport)).toEqual(["6", "7", "8"]);
    viewport.scrollBy(-5);
    expect(shown(viewport)).toEqual(["1", "2", "3"]);
  });

  it("the offset cannot pass the last full view or the first line", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollTo(50);
    expect(shown(viewport)).toEqual(["7", "8", "9"]);
    expect(viewport.offset).toBe(7);
    viewport.scrollTo(-4);
    expect(shown(viewport)).toEqual(["0", "1", "2"]);
    expect(viewport.offset).toBe(0);
  });

  it("content no taller than the viewport cannot scroll", () => {
    const viewport = new Viewport(numbered(2), { rows: 4 });
    viewport.scrollBy(3);
    expect(shown(viewport)).toEqual(["0", "1", "", ""]);
    expect(viewport.offset).toBe(0);
  });

  it("clamps after every move, so a scroll past the end leaves no dead zone to scroll back through", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollBy(100);
    viewport.scrollBy(-1);
    expect(shown(viewport)).toEqual(["6", "7", "8"]);
  });

  it("moves requested before the first render resolve against the rows that render finds", () => {
    const viewport = new Viewport(numbered(20));
    viewport.scrollTo(18);
    expect(shown(viewport, region(4))).toEqual(["16", "17", "18", "19"]);
  });

  it("the offset reports the last render, and a queued move only once rendered", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollTo(5);
    expect(viewport.offset).toBe(0);
    shown(viewport);
    expect(viewport.offset).toBe(5);
  });

  it("a second render with nothing queued shows the same lines", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollTo(5);
    expect(shown(viewport)).toEqual(shown(viewport));
  });

  it("content that shrank pulls the offset back with it", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollTo(7);
    shown(viewport);
    viewport.content = numbered(5);
    expect(shown(viewport)).toEqual(["2", "3", "4"]);
  });

  it("replaced content keeps the scroll position", () => {
    const viewport = new Viewport(numbered(10), { rows: 3 });
    viewport.scrollTo(4);
    shown(viewport);
    viewport.content = numbered(12);
    expect(shown(viewport)).toEqual(["4", "5", "6"]);
  });

  it("the extent is the content's lines at the width it renders at", () => {
    const viewport = new Viewport(new RichText("aaaa bbbb cccc dddd"), { rows: 2 });
    viewport.scrollTo(10);
    expect(shown(viewport, undefined, 4)).toEqual(["cccc", "dddd"]);
  });
});

describe("ensureVisible", () => {
  it("brings a range below the view into view, at the bottom", () => {
    const viewport = new Viewport(numbered(20), { rows: 4 });
    viewport.ensureVisible(10, 12);
    expect(shown(viewport)).toEqual(["8", "9", "10", "11"]);
  });

  it("brings a range above the view into view, at the top", () => {
    const viewport = new Viewport(numbered(20), { rows: 4 });
    viewport.scrollTo(12);
    viewport.ensureVisible(3, 4);
    expect(shown(viewport)).toEqual(["3", "4", "5", "6"]);
  });

  it("does not move for a range already in view", () => {
    const viewport = new Viewport(numbered(20), { rows: 4 });
    viewport.scrollTo(5);
    viewport.ensureVisible(6, 8);
    expect(shown(viewport)).toEqual(["5", "6", "7", "8"]);
  });

  it("shows the first line of a range taller than the viewport", () => {
    const viewport = new Viewport(numbered(20), { rows: 3 });
    viewport.ensureVisible(5, 15);
    expect(shown(viewport)).toEqual(["5", "6", "7"]);
  });

  it("scrolls the least distance from where the last render left it, frame after frame", () => {
    const viewport = new Viewport(numbered(20), { rows: 4 });
    const frames = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1].map((selected) => {
      viewport.ensureVisible(selected, selected + 1);
      return shown(viewport)[0];
    });
    expect(frames).toEqual(["0", "0", "0", "0", "1", "2", "2", "2", "2", "1"]);
  });

  it("resolves against the rows a region gives it", () => {
    const viewport = new Viewport(numbered(20));
    viewport.ensureVisible(9, 10);
    expect(shown(viewport, region(5))).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("stops at the end of the content", () => {
    const viewport = new Viewport(numbered(10), { rows: 4 });
    viewport.ensureVisible(9, 14);
    expect(shown(viewport)).toEqual(["6", "7", "8", "9"]);
  });
});

describe("measure", () => {
  it("is its content's width", () => {
    const viewport = new Viewport(new RichText("hello"));
    expect(viewport.measure({ maxWidth: 20 })).toEqual({ minimum: 5, maximum: 5 });
  });
});
