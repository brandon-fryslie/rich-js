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

function shown(viewport: Renderable, height?: Height, maxWidth = 10): string[] {
  const lines = Segment.splitLines(render(viewport, { maxWidth, height }));
  return lines.map((line) => line.map((s) => s.text).join("").trimEnd());
}

/** Every row exactly as emitted, trailing blanks and all. */
function rows(viewport: Renderable, height?: Height, maxWidth = 10): string[] {
  const lines = Segment.splitLines(render(viewport, { maxWidth, height }));
  return lines.map((line) => line.map((s) => s.text).join(""));
}

/** The scrollbar column of each row: its last cell. */
function bar(viewport: Renderable, height?: Height, maxWidth = 10): string {
  return rows(viewport, height, maxWidth).map((row) => row.slice(-1)).join("");
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
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(4);
    expect(shown(viewport)).toEqual(["4", "5", "6"]);
    scroll.scrollBy(2);
    expect(shown(viewport)).toEqual(["6", "7", "8"]);
    scroll.scrollBy(-5);
    expect(shown(viewport)).toEqual(["1", "2", "3"]);
  });

  it("the offset cannot pass the last full view or the first line", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(50);
    expect(shown(viewport)).toEqual(["7", "8", "9"]);
    expect(scroll.offset).toBe(7);
    scroll.scrollTo(-4);
    expect(shown(viewport)).toEqual(["0", "1", "2"]);
    expect(scroll.offset).toBe(0);
  });

  it("content no taller than the viewport cannot scroll", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(2));
    scroll.scrollBy(3);
    expect(shown(viewport)).toEqual(["0", "1", "", ""]);
    expect(scroll.offset).toBe(0);
  });

  it("clamps after every move, so a scroll past the end leaves no dead zone to scroll back through", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollBy(100);
    scroll.scrollBy(-1);
    expect(shown(viewport)).toEqual(["6", "7", "8"]);
  });

  it("moves requested before the first render resolve against the rows that render finds", () => {
    const scroll = new Viewport();
    const viewport = scroll.showing(numbered(20));
    scroll.scrollTo(18);
    expect(shown(viewport, region(4))).toEqual(["16", "17", "18", "19"]);
  });

  it("the offset reports the last render, and a queued move only once rendered", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(5);
    expect(scroll.offset).toBe(0);
    shown(viewport);
    expect(scroll.offset).toBe(5);
  });

  it("a second render with nothing queued shows the same lines", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(5);
    expect(shown(viewport)).toEqual(shown(viewport));
  });

  it("content that shrank pulls the offset back with it", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(7);
    shown(viewport);
    expect(shown(scroll.showing(numbered(5)))).toEqual(["2", "3", "4"]);
  });

  it("replaced content keeps the scroll position", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(4);
    shown(viewport);
    expect(shown(scroll.showing(numbered(12)))).toEqual(["4", "5", "6"]);
  });

  it("the extent is the content's lines at the width it renders at", () => {
    const scroll = new Viewport({ rows: 2 });
    const viewport = scroll.showing(new RichText("aaaa bbbb cccc dddd"));
    scroll.scrollTo(10);
    expect(shown(viewport, undefined, 4)).toEqual(["cccc", "dddd"]);
  });
});

describe("canScrollBy", () => {
  it("answers against the last render: neither way before one, and not past either end", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    expect([scroll.canScrollBy(-1), scroll.canScrollBy(1)]).toEqual([false, false]);
    shown(viewport);
    expect([scroll.canScrollBy(-1), scroll.canScrollBy(1)]).toEqual([false, true]);
    scroll.scrollTo(7);
    shown(viewport);
    expect([scroll.canScrollBy(-1), scroll.canScrollBy(1)]).toEqual([true, false]);
  });

  it("counts the moves queued since the last render", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    shown(viewport);
    scroll.scrollBy(6);
    expect(scroll.canScrollBy(1)).toBe(true);
    scroll.scrollBy(1);
    expect(scroll.canScrollBy(1)).toBe(false);
    expect(scroll.canScrollBy(-1)).toBe(true);
  });

    it("content that fits moves neither way", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(2));
    shown(viewport);
    expect([scroll.canScrollBy(-1), scroll.canScrollBy(1)]).toEqual([false, false]);
  });
});

describe("ensureVisible", () => {
  it("brings a range below the view into view, at the bottom", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(20));
    scroll.ensureVisible(10, 12);
    expect(shown(viewport)).toEqual(["8", "9", "10", "11"]);
  });

  it("brings a range above the view into view, at the top", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(20));
    scroll.scrollTo(12);
    scroll.ensureVisible(3, 4);
    expect(shown(viewport)).toEqual(["3", "4", "5", "6"]);
  });

  it("does not move for a range already in view", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(20));
    scroll.scrollTo(5);
    scroll.ensureVisible(6, 8);
    expect(shown(viewport)).toEqual(["5", "6", "7", "8"]);
  });

  it("shows the first line of a range taller than the viewport", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(20));
    scroll.ensureVisible(5, 15);
    expect(shown(viewport)).toEqual(["5", "6", "7"]);
  });

  it("scrolls the least distance from where the last render left it, frame after frame", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(20));
    const frames = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1].map((selected) => {
      scroll.ensureVisible(selected, selected + 1);
      return shown(viewport)[0];
    });
    expect(frames).toEqual(["0", "0", "0", "0", "1", "2", "2", "2", "2", "1"]);
  });

  it("resolves against the rows a region gives it", () => {
    const scroll = new Viewport();
    const viewport = scroll.showing(numbered(20));
    scroll.ensureVisible(9, 10);
    expect(shown(viewport, region(5))).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("stops at the end of the content", () => {
    const scroll = new Viewport({ rows: 4 });
    const viewport = scroll.showing(numbered(10));
    scroll.ensureVisible(9, 14);
    expect(shown(viewport)).toEqual(["6", "7", "8", "9"]);
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
    const scroll = new Viewport({ rows: 2, scrollbar: SCROLLBAR });
    const viewport = scroll.showing(new RichText("aaaa bbbb"));
    expect(rows(viewport, undefined, 5)).toEqual(["aaaa┃", "bbbb┃"]);
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
    const scroll = new Viewport({ rows: 10, scrollbar: SCROLLBAR });
    const viewport = scroll.showing(numbered(20));
    const frames = [0, 5, 10].map((line) => {
      scroll.scrollTo(line);
      return bar(viewport);
    });
    expect(frames).toEqual(["┃┃┃┃┃│││││", "│││┃┃┃┃┃││", "│││││┃┃┃┃┃"]);
  });

  it("touches an end only when the view has reached that end of the content", () => {
    const at = (rowsShown: number, lines: number, offset: number): string => {
      const scroll = new Viewport({ rows: rowsShown, scrollbar: SCROLLBAR });
      const viewport = scroll.showing(numbered(lines));
      scroll.scrollTo(offset);
      return bar(viewport);
    };
    // Rounded alone, offset 9 of 10 put the thumb on the bottom with line 19 unseen.
    expect(at(10, 20, 9)).toBe("││││┃┃┃┃┃│");
    expect(at(10, 20, 1)).toBe("│┃┃┃┃┃││││");
    expect(at(4, 40, 1)).toBe("│┃││");
    expect(at(4, 40, 35)).toBe("││┃│");
    expect(at(4, 40, 36)).toBe("│││┃");
  });

    it("reads the offset its render resolves, not the one before it", () => {
    const scroll = new Viewport({ scrollbar: SCROLLBAR });
    const viewport = scroll.showing(numbered(20));
    scroll.scrollTo(99);
    expect(scroll.offset).toBe(0);
    expect(bar(viewport, region(10))).toBe("│││││┃┃┃┃┃");
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
        const scroll = new Viewport({ scrollbar: SCROLLBAR });
        const viewport = scroll.showing(numbered(20));
        scroll.scrollTo(10);
        const drawn = rows(viewport, height);
        const offset = scroll.offset;
        expect(bar(viewport, height, 1)).toBe(drawn.map((row) => row.slice(-1)).join(""));
        expect(scroll.offset).toBe(offset);
        expect(rows(viewport, height)).toEqual(drawn);
      }
    });

    it("keeps a followed range where the last drawn render left it", () => {
      const scroll = new Viewport({ scrollbar: SCROLLBAR });
      const viewport = scroll.showing(numbered(20));
      scroll.scrollTo(10);
      shown(viewport, ceiling(5));
      shown(scroll.showing(numbered(20), { start: 12, end: 13 }), ceiling(5));
      shown(viewport, ceiling(5), 1);
      expect(scroll.offset).toBe(10);
      expect(shown(viewport, ceiling(5))[0]).toMatch(/^10 /);
    });

    it("reports no move past the last full view the last drawn render found", () => {
      const scroll = new Viewport({ scrollbar: SCROLLBAR });
      const viewport = scroll.showing(numbered(20));
      scroll.scrollTo(15);
      shown(viewport, ceiling(5));
      shown(viewport, ceiling(5), 1);
      expect(scroll.canScrollBy(1)).toBe(false);
    });

    it("leaves a move queued meanwhile for the next render that draws the content", () => {
      const scroll = new Viewport({ scrollbar: SCROLLBAR });
      const viewport = scroll.showing(numbered(20));
      scroll.scrollTo(10);
      const drawn = bar(viewport, region(5));
      scroll.scrollTo(0);
      expect(bar(viewport, region(5), 1)).toBe(drawn);
      expect(scroll.offset).toBe(10);
      expect(shown(viewport, region(5))[0]).toMatch(/^0 /);
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
    const scroll = new Viewport();
    const viewport = scroll.showing(new RichText("hello"));
    expect(viewport.measure({ maxWidth: 20 })).toEqual({ minimum: 5, maximum: 5 });
  });

  it("is its content's width and its gutter's, within the offer", () => {
    const scroll = new Viewport({ scrollbar: SCROLLBAR });
    const viewport = scroll.showing(new RichText("hello"));
    expect(viewport.measure({ maxWidth: 20 })).toEqual({ minimum: 6, maximum: 6 });
    expect(viewport.measure({ maxWidth: 4 })).toEqual({ minimum: 4, maximum: 4 });
  });
});

describe("showing, with a range followed", () => {
  /** Ten numbered lines shown through `scroll`, following lines `start` up to `end`. */
  const following = (scroll: Viewport, start: number, end: number) => scroll.showing(numbered(10), { start, end });

  it("brings a range into view only when it differs from the last one followed", () => {
    const scroll = new Viewport({ rows: 2 });
    expect(shown(following(scroll, 5, 6))).toEqual(["4", "5"]);
    scroll.scrollTo(0);
    expect(shown(following(scroll, 5, 6))).toEqual(["0", "1"]);
    expect(shown(following(scroll, 6, 7))).toEqual(["5", "6"]);
  });

  it("brings the followed range in again when the viewport gets shorter", () => {
    const scroll = new Viewport();
    expect(shown(following(scroll, 4, 5), { rows: 5, exact: true })).toEqual(["0", "1", "2", "3", "4"]);
    expect(shown(following(scroll, 4, 5), { rows: 3, exact: true })).toEqual(["2", "3", "4"]);
  });

  it("leaves a range the wheel scrolled away from where the wheel left it, at any row count", () => {
    const scroll = new Viewport();
    const viewport = scroll.showing(numbered(10));
    shown(following(scroll, 0, 1), { rows: 3, exact: true });
    scroll.scrollBy(5);
    expect(shown(viewport, { rows: 3, exact: true })).toEqual(["5", "6", "7"]);
    expect(shown(viewport, { rows: 4, exact: true })).toEqual(["5", "6", "7", "8"]);
    expect(shown(viewport, { rows: 2, exact: true })).toEqual(["5", "6"]);
  });

  it("leaves a wheel scroll alone while the rows stay the same", () => {
    const scroll = new Viewport();
    shown(following(scroll, 4, 5), { rows: 3, exact: true });
    scroll.scrollTo(0);
    expect(shown(following(scroll, 4, 5), { rows: 3, exact: true })).toEqual(["0", "1", "2"]);
  });

  it("keeps nothing from a range followed in a frame that held it or measured it", () => {
    const scroll = new Viewport({ rows: 2 });
    const viewport = scroll.showing(numbered(10));
    [...render(following(scroll, 5, 6), { maxWidth: 0 })];
    measure(following(scroll, 5, 6), { maxWidth: 10 });
    expect(shown(viewport)).toEqual(["0", "1"]);
  });
});

describe("a viewport keeps its scroll once the frame is drawn, never while", () => {
  // [LAW:effects-at-boundaries] What a render resolved becomes the viewport's
  // between passes, so a render draws it without writing anything.
  it("reports the offset a frame resolved only after the frame is drawn whole", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(4);
    const steps = render(viewport, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    expect(scroll.offset).toBe(0);
    while (steps.next().done !== true);
    expect(scroll.offset).toBe(4);
  });

  it("keeps nothing from a frame its caller stopped drawing, and the next frame resolves the move", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(4);
    const steps = render(viewport, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    steps.return?.();
    expect(scroll.offset).toBe(0);
    expect(shown(viewport)).toEqual(["4", "5", "6"]);
    expect(scroll.offset).toBe(4);
  });

  it("keeps nothing from a measurement that renders it", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(4);
    const measuring = {
      render: (): Segment[] => [],
      measure: (options: RenderOptions) => {
        Segment.splitLines(render(viewport, options));
        return { minimum: 1, maximum: 1 };
      },
    };
    measure(measuring, { maxWidth: 10 });
    expect(scroll.offset).toBe(0);
    expect(scroll.canScrollBy(-1)).toBe(false);
  });

  it("drops the moves its frame resolved and keeps one queued since", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(2);
    const steps = render(viewport, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    scroll.scrollBy(3);
    while (steps.next().done !== true);
    expect(scroll.offset).toBe(2);
    expect(shown(viewport)).toEqual(["5", "6", "7"]);
  });

  it("keeps what a drawn frame resolved when the same pass also holds it", () => {
    const scroll = new Viewport({ rows: 3, scrollbar: SCROLLBAR });
    const viewport = scroll.showing(numbered(20));
    scroll.scrollTo(10);
    const frame: Renderable = {
      *render(options) {
        yield* render(viewport, options);
        // One column is all the gutter: the content is held.
        yield* render(viewport, { ...options, maxWidth: 1 });
      },
    };
    [...render(frame, { maxWidth: 10 })];
    expect(scroll.offset).toBe(10);
  });

  it("keeps a move queued after two draws of it in one pass resolved the same queue", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(2);
    const frame: Renderable = {
      *render(options) {
        yield* render(viewport, options);
        yield* render(viewport, options);
      },
    };
    const steps = render(frame, { maxWidth: 10 })[Symbol.iterator]();
    // Both draws have resolved the queue once each has drawn its last line, "4".
    for (let fours = 0; fours < 2; ) if ((steps.next().value as Segment).text === "4") fours++;
    scroll.scrollBy(3);
    while (steps.next().done !== true);
    expect(scroll.offset).toBe(2);
    expect(shown(viewport)).toEqual(["5", "6", "7"]);
  });

  it("keeps its scroll when a frame drawn ahead is iterated inside another render", () => {
    const scroll = new Viewport({ rows: 3 });
    const viewport = scroll.showing(numbered(10));
    scroll.scrollTo(4);
    const ahead = render(viewport, { maxWidth: 10 });
    const host: Renderable = {
      *render() {
        yield* ahead;
      },
    };
    [...render(host, { maxWidth: 10 })];
    expect(scroll.offset).toBe(4);
  });

});
