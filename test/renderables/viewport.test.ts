import { describe, it, expect } from "vitest";
import { SCROLLBAR, Viewport } from "../../src/renderables/viewport.js";
import { Panel } from "../../src/renderables/panel.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Style, Theme } from "../../src/core/style.js";
import { cellLen } from "../../src/core/cells.js";
import { measure, render, type Height, type Renderable, type RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] What a viewport shows, under the `Height`
// contract in src/core/protocol.ts, and how its operations move it.

/** `n` lines reading "0", "1", … so a shown line names its own index. */
function numbered(n: number): Renderable {
  return new RichText(Array.from({ length: n }, (_, i) => String(i)).join("\n"));
}

function shown(showing: Renderable, height?: Height, maxWidth = 10): string[] {
  const lines = Segment.splitLines(render(showing, { maxWidth, height }));
  return lines.map((line) => line.map((s) => s.text).join("").trimEnd());
}

/** Every row exactly as emitted, trailing blanks and all. */
function rows(showing: Renderable, height?: Height, maxWidth = 10): string[] {
  const lines = Segment.splitLines(render(showing, { maxWidth, height }));
  return lines.map((line) => line.map((s) => s.text).join(""));
}

/** The scrollbar column of each row: its last cell. */
function bar(showing: Renderable, height?: Height, maxWidth = 10): string {
  return rows(showing, height, maxWidth).map((row) => row.slice(-1)).join("");
}

/** Emits one line `width` cells wide, whatever width it is offered. */
function wide(width: number): Renderable {
  return { render: () => [new Segment("x".repeat(width)), Segment.line()] };
}

const region = (rows: number): Height => ({ rows, exact: true });
const ceiling = (rows: number): Height => ({ rows, exact: false });

describe("the rows a viewport shows", () => {
  it("a region's, whatever rows it was configured with", () => {
    expect(shown(new Viewport({ rows: 2 }).showing(numbered(10)), region(4))).toEqual(["0", "1", "2", "3"]);
  });

  it("its configured rows under a ceiling taller than them", () => {
    expect(shown(new Viewport({ rows: 3 }).showing(numbered(10)), ceiling(8))).toEqual(["0", "1", "2"]);
  });

  it("the ceiling's, when it is shorter than the configured rows", () => {
    expect(shown(new Viewport({ rows: 6 }).showing(numbered(10)), ceiling(2))).toEqual(["0", "1"]);
  });

  it("the content's length under a ceiling, with no rows configured — never padded up to the ceiling", () => {
    expect(shown(new Viewport().showing(numbered(3)), ceiling(8))).toEqual(["0", "1", "2"]);
    expect(shown(new Viewport().showing(numbered(10)), ceiling(4))).toEqual(["0", "1", "2", "3"]);
  });

  it("the content's full length with no budget and no rows", () => {
    expect(shown(new Viewport().showing(numbered(5)))).toHaveLength(5);
  });

  it("pads short content with blank rows up to its rows", () => {
    expect(shown(new Viewport({ rows: 4 }).showing(numbered(2)))).toEqual(["0", "1", "", ""]);
    expect(shown(new Viewport().showing(numbered(2)), region(3))).toEqual(["0", "1", ""]);
  });

  it("parses configured rows that are not a count", () => {
    expect(shown(new Viewport({ rows: 2.7 }).showing(numbered(5)))).toEqual(["0", "1"]);
    expect(shown(new Viewport({ rows: -3 }).showing(numbered(5)))).toEqual([]);
  });

  it("renders its content with no height: the content's natural length is the scroll extent", () => {
    const seen: (Height | undefined)[] = [];
    const probe: Renderable = {
      render(options: RenderOptions) {
        seen.push(options.height);
        return [new Segment("p"), Segment.line()];
      },
    };
    shown(new Viewport().showing(probe), region(4));
    expect(seen).toEqual([undefined]);
  });

  it("fills the region a Panel hands it, less the Panel's borders", () => {
    const lines = shown(new Panel(new Viewport().showing(numbered(20))), region(5));
    expect(lines).toHaveLength(5);
    expect(lines.slice(1, 4).map((l) => l.replace(/[│\s]/g, ""))).toEqual(["0", "1", "2"]);
  });
});

describe("scrolling", () => {
  it("content longer than the viewport scrolls", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(4);
    expect(shown(showing)).toEqual(["4", "5", "6"]);
    viewport.scrollBy(2);
    expect(shown(showing)).toEqual(["6", "7", "8"]);
    viewport.scrollBy(-5);
    expect(shown(showing)).toEqual(["1", "2", "3"]);
  });

  it("the offset cannot pass the last full view or the first line", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(50);
    expect(shown(showing)).toEqual(["7", "8", "9"]);
    expect(viewport.offset).toBe(7);
    viewport.scrollTo(-4);
    expect(shown(showing)).toEqual(["0", "1", "2"]);
    expect(viewport.offset).toBe(0);
  });

  it("content no taller than the viewport cannot scroll", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(2));
    viewport.scrollBy(3);
    expect(shown(showing)).toEqual(["0", "1", "", ""]);
    expect(viewport.offset).toBe(0);
  });

  it("clamps after every move, so a scroll past the end leaves no dead zone to scroll back through", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollBy(100);
    viewport.scrollBy(-1);
    expect(shown(showing)).toEqual(["6", "7", "8"]);
  });

  it("moves requested before the first render resolve against the rows that render finds", () => {
    const viewport = new Viewport();
    const showing = viewport.showing(numbered(20));
    viewport.scrollTo(18);
    expect(shown(showing, region(4))).toEqual(["16", "17", "18", "19"]);
  });

  it("the offset reports the last render, and a queued move only once rendered", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(5);
    expect(viewport.offset).toBe(0);
    shown(showing);
    expect(viewport.offset).toBe(5);
  });

  it("a second render with nothing queued shows the same lines", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(5);
    expect(shown(showing)).toEqual(shown(showing));
  });

  it("content that shrank pulls the offset back with it", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(7);
    shown(showing);
    expect(shown(viewport.showing(numbered(5)))).toEqual(["2", "3", "4"]);
  });

  it("replaced content keeps the scroll position", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(4);
    shown(showing);
    expect(shown(viewport.showing(numbered(12)))).toEqual(["4", "5", "6"]);
  });

  it("the extent is the content's lines at the width it renders at", () => {
    const viewport = new Viewport({ rows: 2 });
    const showing = viewport.showing(new RichText("aaaa bbbb cccc dddd"));
    viewport.scrollTo(10);
    expect(shown(showing, undefined, 4)).toEqual(["cccc", "dddd"]);
  });
});

describe("canScrollBy", () => {
  it("answers against the last render: neither way before one, and not past either end", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    expect([viewport.canScrollBy(-1), viewport.canScrollBy(1)]).toEqual([false, false]);
    shown(showing);
    expect([viewport.canScrollBy(-1), viewport.canScrollBy(1)]).toEqual([false, true]);
    viewport.scrollTo(7);
    shown(showing);
    expect([viewport.canScrollBy(-1), viewport.canScrollBy(1)]).toEqual([true, false]);
  });

  it("counts the moves queued since the last render", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    shown(showing);
    viewport.scrollBy(6);
    expect(viewport.canScrollBy(1)).toBe(true);
    viewport.scrollBy(1);
    expect(viewport.canScrollBy(1)).toBe(false);
    expect(viewport.canScrollBy(-1)).toBe(true);
  });

    it("content that fits moves neither way", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(2));
    shown(showing);
    expect([viewport.canScrollBy(-1), viewport.canScrollBy(1)]).toEqual([false, false]);
  });
});

describe("ensureVisible", () => {
  it("brings a range below the view into view, at the bottom", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(20));
    viewport.ensureVisible(10, 12);
    expect(shown(showing)).toEqual(["8", "9", "10", "11"]);
  });

  it("brings a range above the view into view, at the top", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(20));
    viewport.scrollTo(12);
    viewport.ensureVisible(3, 4);
    expect(shown(showing)).toEqual(["3", "4", "5", "6"]);
  });

  it("does not move for a range already in view", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(20));
    viewport.scrollTo(5);
    viewport.ensureVisible(6, 8);
    expect(shown(showing)).toEqual(["5", "6", "7", "8"]);
  });

  it("shows the first line of a range taller than the viewport", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(20));
    viewport.ensureVisible(5, 15);
    expect(shown(showing)).toEqual(["5", "6", "7"]);
  });

  it("scrolls the least distance from where the last render left it, frame after frame", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(20));
    const frames = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1].map((selected) => {
      viewport.ensureVisible(selected, selected + 1);
      return shown(showing)[0];
    });
    expect(frames).toEqual(["0", "0", "0", "0", "1", "2", "2", "2", "2", "1"]);
  });

  it("resolves against the rows a region gives it", () => {
    const viewport = new Viewport();
    const showing = viewport.showing(numbered(20));
    viewport.ensureVisible(9, 10);
    expect(shown(showing, region(5))).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("stops at the end of the content", () => {
    const viewport = new Viewport({ rows: 4 });
    const showing = viewport.showing(numbered(10));
    viewport.ensureVisible(9, 14);
    expect(shown(showing)).toEqual(["6", "7", "8", "9"]);
  });
});

describe("the width a viewport shows", () => {
  it("crops content that ignores its width at the viewport's edge", () => {
    expect(rows(new Viewport({ rows: 2 }).showing(wide(40)), undefined, 6)).toEqual(["xxxxxx", "      "]);
  });

  it("pads every row, blank ones included, to the width it is given", () => {
    const widths = rows(new Viewport({ rows: 4 }).showing(numbered(2)), undefined, 7).map(cellLen);
    expect(widths).toEqual([7, 7, 7, 7]);
  });

  it("crops through a wide character without drawing past the edge", () => {
    const wideText: Renderable = { render: () => [new Segment("日本語"), Segment.line()] };
    const [row] = rows(new Viewport().showing(wideText), undefined, 3);
    expect(cellLen(row!)).toBe(3);
  });
});

describe("the scrollbar", () => {
  it("renders the content one cell narrower and draws the bar in the last column", () => {
    const viewport = new Viewport({ rows: 2, scrollbar: SCROLLBAR });
    const showing = viewport.showing(new RichText("aaaa bbbb"));
    expect(rows(showing, undefined, 5)).toEqual(["aaaa┃", "bbbb┃"]);
  });

  it("fills the track when the content fits", () => {
    expect(bar(new Viewport({ rows: 4, scrollbar: SCROLLBAR }).showing(numbered(3)))).toBe("┃┃┃┃");
  });

  it("names the width its content renders at, so lines to keep in view can be counted at it", () => {
    const offered: number[] = [];
    const content: Renderable = {
      render: ({ maxWidth }: RenderOptions) => {
        offered.push(maxWidth);
        return [];
      },
    };
    const plainScroll = new Viewport({ rows: 1 });
    const plain = plainScroll.showing(content);
    const barredScroll = new Viewport({ rows: 1, scrollbar: SCROLLBAR });
    const barred = barredScroll.showing(content);
    rows(plain, undefined, 7);
    rows(barred, undefined, 7);
    expect(offered).toEqual([plainScroll.contentWidth(7), barredScroll.contentWidth(7)]);
    expect(offered).toEqual([7, 6]);
  });

  it("has a thumb as long as the share of the content in view", () => {
    expect(bar(new Viewport({ rows: 10, scrollbar: SCROLLBAR }).showing(numbered(20)))).toBe("┃┃┃┃┃│││││");
    expect(bar(new Viewport({ rows: 4, scrollbar: SCROLLBAR }).showing(numbered(40)))).toBe("┃│││");
  });

  it("moves the thumb with the offset, top at the first line and bottom at the last full view", () => {
    const viewport = new Viewport({ rows: 10, scrollbar: SCROLLBAR });
    const showing = viewport.showing(numbered(20));
    const frames = [0, 5, 10].map((line) => {
      viewport.scrollTo(line);
      return bar(showing);
    });
    expect(frames).toEqual(["┃┃┃┃┃│││││", "│││┃┃┃┃┃││", "│││││┃┃┃┃┃"]);
  });

  it("touches an end only when the view has reached that end of the content", () => {
    const at = (rowsShown: number, lines: number, offset: number): string => {
      const viewport = new Viewport({ rows: rowsShown, scrollbar: SCROLLBAR });
      const showing = viewport.showing(numbered(lines));
      viewport.scrollTo(offset);
      return bar(showing);
    };
    // Rounded alone, offset 9 of 10 put the thumb on the bottom with line 19 unseen.
    expect(at(10, 20, 9)).toBe("││││┃┃┃┃┃│");
    expect(at(10, 20, 1)).toBe("│┃┃┃┃┃││││");
    expect(at(4, 40, 1)).toBe("│┃││");
    expect(at(4, 40, 35)).toBe("││┃│");
    expect(at(4, 40, 36)).toBe("│││┃");
  });

    it("reads the offset its render resolves, not the one before it", () => {
    const viewport = new Viewport({ scrollbar: SCROLLBAR });
    const showing = viewport.showing(numbered(20));
    viewport.scrollTo(99);
    expect(viewport.offset).toBe(0);
    expect(bar(showing, region(10))).toBe("│││││┃┃┃┃┃");
  });

  // Content handed no column draws no rows, as Rich's `Console.render` draws
  // nothing under one column, so the bar stands beside the rows a height asks for.
  it("gives the scrollbar the only cell there is, and draws nothing into no width at all", () => {
    expect(rows(new Viewport({ scrollbar: SCROLLBAR }).showing(numbered(2)), region(2), 1)).toEqual(["┃", "┃"]);
    expect(rows(new Viewport({ scrollbar: SCROLLBAR }).showing(numbered(2)), undefined, 1)).toEqual([]);
    expect(rows(new Viewport({ scrollbar: SCROLLBAR }).showing(numbered(2)), undefined, 0)).toEqual([]);
  });

  // Held, the content tells a render nothing about its length, so that render
  // commits nothing: it draws the scrollbar the last drawn render left.
  describe("across a render that hands its content no column", () => {
    it("keeps its offset and its thumb, under a region, a ceiling or no height", () => {
      for (const height of [region(5), ceiling(5), undefined]) {
        const viewport = new Viewport({ scrollbar: SCROLLBAR });
        const showing = viewport.showing(numbered(20));
        viewport.scrollTo(10);
        const drawn = rows(showing, height);
        const offset = viewport.offset;
        expect(bar(showing, height, 1)).toBe(drawn.map((row) => row.slice(-1)).join(""));
        expect(viewport.offset).toBe(offset);
        expect(rows(showing, height)).toEqual(drawn);
      }
    });

    it("keeps a followed range where the last drawn render left it", () => {
      const viewport = new Viewport({ scrollbar: SCROLLBAR });
      const showing = viewport.showing(numbered(20));
      viewport.scrollTo(10);
      shown(showing, ceiling(5));
      shown(viewport.showing(numbered(20), { start: 12, end: 13 }), ceiling(5));
      shown(showing, ceiling(5), 1);
      expect(viewport.offset).toBe(10);
      expect(shown(showing, ceiling(5))[0]).toMatch(/^10 /);
    });

    it("reports no move past the last full view the last drawn render found", () => {
      const viewport = new Viewport({ scrollbar: SCROLLBAR });
      const showing = viewport.showing(numbered(20));
      viewport.scrollTo(15);
      shown(showing, ceiling(5));
      shown(showing, ceiling(5), 1);
      expect(viewport.canScrollBy(1)).toBe(false);
    });

    it("leaves a move queued meanwhile for the next render that draws the content", () => {
      const viewport = new Viewport({ scrollbar: SCROLLBAR });
      const showing = viewport.showing(numbered(20));
      viewport.scrollTo(10);
      const drawn = bar(showing, region(5));
      viewport.scrollTo(0);
      expect(bar(showing, region(5), 1)).toBe(drawn);
      expect(viewport.offset).toBe(10);
      expect(shown(showing, region(5))[0]).toMatch(/^0 /);
    });
  });

  it("resolves its styles against the theme it renders for", () => {
    const theme = new Theme({ "scrollbar.thumb": "red", "scrollbar.track": "blue" });
    const segments = [...render(new Viewport({ rows: 4, scrollbar: SCROLLBAR }).showing(numbered(8)), { maxWidth: 4, theme })];
    // The look, not where the cell came from: every cell carries its anchor.
    const styleOf = (glyph: string): Style | undefined =>
      segments.find((s) => s.text === glyph)?.style?.withAnchor(undefined);
    expect(styleOf("┃")).toEqual(Style.parse("red"));
    expect(styleOf("│")).toEqual(Style.parse("blue"));
  });

  it("fills the rest of a narrower glyph's cell in that part's style", () => {
    const blocks = { thumb: { glyph: "██", style: "" }, track: { glyph: "░", style: "on blue" } };
    const segments = [...render(new Viewport({ rows: 2, scrollbar: blocks }).showing(numbered(8)), { maxWidth: 4 })];
    const afterTrack = segments[segments.findIndex((s) => s.text === "░") + 1]!;
    expect(afterTrack.text).toBe(" ");
    expect(afterTrack.style?.withAnchor(undefined)).toEqual(Style.parse("on blue"));
  });

    it("takes any glyphs, and its gutter is as wide as the wider", () => {
    const blocks = { thumb: { glyph: "██", style: "" }, track: { glyph: "░", style: "" } };
    expect(rows(new Viewport({ rows: 2, scrollbar: blocks }).showing(numbered(8)), undefined, 4)).toEqual([
      "0 ██",
      "1 ░ ",
    ]);
  });
});

describe("measure", () => {
  it("is its content's width", () => {
    const viewport = new Viewport();
    const showing = viewport.showing(new RichText("hello"));
    expect(showing.measure({ maxWidth: 20 })).toEqual({ minimum: 5, maximum: 5 });
  });

  it("is its content's width and its gutter's, within the offer", () => {
    const viewport = new Viewport({ scrollbar: SCROLLBAR });
    const showing = viewport.showing(new RichText("hello"));
    expect(showing.measure({ maxWidth: 20 })).toEqual({ minimum: 6, maximum: 6 });
    expect(showing.measure({ maxWidth: 4 })).toEqual({ minimum: 4, maximum: 4 });
  });
});

describe("showing, with a range followed", () => {
  /** Ten numbered lines shown through `viewport`, following lines `start` up to `end`. */
  const following = (viewport: Viewport, start: number, end: number) => viewport.showing(numbered(10), { start, end });

  it("brings a range into view only when it differs from the last one followed", () => {
    const viewport = new Viewport({ rows: 2 });
    expect(shown(following(viewport, 5, 6))).toEqual(["4", "5"]);
    viewport.scrollTo(0);
    expect(shown(following(viewport, 5, 6))).toEqual(["0", "1"]);
    expect(shown(following(viewport, 6, 7))).toEqual(["5", "6"]);
  });

  it("brings the followed range in again when the viewport gets shorter", () => {
    const viewport = new Viewport();
    expect(shown(following(viewport, 4, 5), { rows: 5, exact: true })).toEqual(["0", "1", "2", "3", "4"]);
    expect(shown(following(viewport, 4, 5), { rows: 3, exact: true })).toEqual(["2", "3", "4"]);
  });

  it("leaves a range the wheel scrolled away from where the wheel left it, at any row count", () => {
    const viewport = new Viewport();
    const showing = viewport.showing(numbered(10));
    shown(following(viewport, 0, 1), { rows: 3, exact: true });
    viewport.scrollBy(5);
    expect(shown(showing, { rows: 3, exact: true })).toEqual(["5", "6", "7"]);
    expect(shown(showing, { rows: 4, exact: true })).toEqual(["5", "6", "7", "8"]);
    expect(shown(showing, { rows: 2, exact: true })).toEqual(["5", "6"]);
  });

  it("leaves a wheel scroll alone while the rows stay the same", () => {
    const viewport = new Viewport();
    shown(following(viewport, 4, 5), { rows: 3, exact: true });
    viewport.scrollTo(0);
    expect(shown(following(viewport, 4, 5), { rows: 3, exact: true })).toEqual(["0", "1", "2"]);
  });

  it("keeps nothing from a range followed in a frame that held it or measured it", () => {
    const viewport = new Viewport({ rows: 2 });
    const showing = viewport.showing(numbered(10));
    [...render(following(viewport, 5, 6), { maxWidth: 0 })];
    measure(following(viewport, 5, 6), { maxWidth: 10 });
    expect(shown(showing)).toEqual(["0", "1"]);
  });
});

describe("a viewport keeps its scroll once the frame is drawn, never while", () => {
  // [LAW:effects-at-boundaries] What a render resolved becomes the viewport's
  // between passes, so a render draws it without writing anything.
  it("reports the offset a frame resolved only after the frame is drawn whole", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(4);
    const steps = render(showing, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    expect(viewport.offset).toBe(0);
    while (steps.next().done !== true);
    expect(viewport.offset).toBe(4);
  });

  it("keeps nothing from a frame its caller stopped drawing, and the next frame resolves the move", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(4);
    const steps = render(showing, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    steps.return?.();
    expect(viewport.offset).toBe(0);
    expect(shown(showing)).toEqual(["4", "5", "6"]);
    expect(viewport.offset).toBe(4);
  });

  it("keeps nothing from a measurement that renders it", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(4);
    const measuring = {
      render: (): Segment[] => [],
      measure: (options: RenderOptions) => {
        Segment.splitLines(render(showing, options));
        return { minimum: 1, maximum: 1 };
      },
    };
    measure(measuring, { maxWidth: 10 });
    expect(viewport.offset).toBe(0);
    expect(viewport.canScrollBy(-1)).toBe(false);
  });

  it("drops the moves its frame resolved and keeps one queued since", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(2);
    const steps = render(showing, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    viewport.scrollBy(3);
    while (steps.next().done !== true);
    expect(viewport.offset).toBe(2);
    expect(shown(showing)).toEqual(["5", "6", "7"]);
  });

  it("keeps what a drawn frame resolved when the same pass also holds it", () => {
    const viewport = new Viewport({ rows: 3, scrollbar: SCROLLBAR });
    const showing = viewport.showing(numbered(20));
    viewport.scrollTo(10);
    const frame: Renderable = {
      *render(options) {
        yield* render(showing, options);
        // One column is all the gutter: the content is held.
        yield* render(showing, { ...options, maxWidth: 1 });
      },
    };
    [...render(frame, { maxWidth: 10 })];
    expect(viewport.offset).toBe(10);
  });

  it("keeps a move queued after two draws of it in one pass resolved the same queue", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(2);
    const frame: Renderable = {
      *render(options) {
        yield* render(showing, options);
        yield* render(showing, options);
      },
    };
    const steps = render(frame, { maxWidth: 10 })[Symbol.iterator]();
    // Both draws have resolved the queue once each has drawn its last line, "4".
    for (let fours = 0; fours < 2; ) if ((steps.next().value as Segment).text === "4") fours++;
    viewport.scrollBy(3);
    while (steps.next().done !== true);
    expect(viewport.offset).toBe(2);
    expect(shown(showing)).toEqual(["5", "6", "7"]);
  });

  it("keeps its scroll when a frame drawn ahead is iterated inside another render", () => {
    const viewport = new Viewport({ rows: 3 });
    const showing = viewport.showing(numbered(10));
    viewport.scrollTo(4);
    const ahead = render(showing, { maxWidth: 10 });
    const host: Renderable = {
      *render() {
        yield* ahead;
      },
    };
    [...render(host, { maxWidth: 10 })];
    expect(viewport.offset).toBe(4);
  });

});
