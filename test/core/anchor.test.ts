import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { asCellCol } from "../../src/core/cells.js";
import type { Anchor } from "../../src/core/anchor.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { Align } from "../../src/renderables/align.js";
import { Columns } from "../../src/renderables/columns.js";
import { Group } from "../../src/renderables/group.js";
import { Layout } from "../../src/renderables/layout.js";
import { Padding } from "../../src/renderables/padding.js";
import { Panel } from "../../src/renderables/panel.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";
import { SCROLLBAR, Viewport } from "../../src/renderables/viewport.js";

// [LAW:behavior-not-structure] The contract in src/core/anchor.ts, asserted
// as what a holder of the composed frame can read off it: every cell an
// owner drew names the row and column it holds in that owner's own output,
// whatever the owner was nested in. No container is told about anchors, so
// each case here is a container keeping a promise it never made.

/** Draws fixed lines of distinct letters and stamps them as its own. */
class Owner implements Renderable {
  constructor(readonly lines: string[]) {}

  render(options: RenderOptions): Iterable<Segment> {
    options.onDraw?.(this);
    const stamped = Segment.anchorLines(this.lines.map((l) => [new Segment(l)]), this);
    return stamped.flatMap((line) => [...line, Segment.line()]);
  }

  measure(): { minimum: number; maximum: number } {
    const widest = Math.max(...this.lines.map((l) => l.length));
    return { minimum: widest, maximum: widest };
  }
}

const frameOf = (renderable: Renderable, options: RenderOptions): Segment[][] =>
  Segment.splitLines(renderable.render(options));

/** The character in the cell at `x` of a frame row. */
function charAt(line: Segment[], x: number): string {
  let start = 0;
  for (const segment of line) {
    const end = start + segment.cellLength;
    if (x < end) return segment.splitCells(asCellCol(x - start))[1].text[0]!;
    start = end;
  }
  throw new Error(`no cell at ${x}`);
}

const innermost = (anchor: Anchor): Anchor => (anchor.inner ? innermost(anchor.inner) : anchor);

interface Placement { x: number; y: number; row: number; col: number }

/**
 * Every cell of the frame that `owner` drew, checked against what the owner
 * itself holds at the row and column the cell names.
 */
function placements(frame: Segment[][], owner: Owner): Placement[] {
  const found: Placement[] = [];
  frame.forEach((line, y) => {
    const width = Segment.getLineLength(line);
    for (let x = 0; x < width; x++) {
      const anchor = Segment.anchorAt(frame, x, y);
      if (!anchor || innermost(anchor).owner !== owner) continue;
      const { row, col } = innermost(anchor);
      expect(charAt(line, x), `cell (${x}, ${y}) names (${row}, ${col})`).toBe(owner.lines[row]![col]);
      found.push({ x, y, row, col });
    }
  });
  return found;
}

const allCells = (owner: Owner): string[] =>
  owner.lines.flatMap((l, row) => [...l].map((_, col) => `${row},${col}`));

const cellsOf = (found: Placement[]): string[] => found.map((p) => `${p.row},${p.col}`).sort();

const OPTIONS: RenderOptions = { maxWidth: 40, height: { rows: 12, exact: true } };

const cases: [string, (owner: Owner) => Renderable][] = [
  ["Panel", (o) => new Panel(o)],
  ["Padding", (o) => new Padding(o, [1, 2, 1, 3])],
  ["Group", (o) => new Group(new Owner(["zz"]), o)],
  ["Align, which places the block after rendering it", (o) => new Align(o, "center")],
  ["a Layout row split", (o) => {
    const layout = new Layout();
    layout.splitRow(new Layout("left pane"), new Layout(o));
    return layout;
  }],
  ["a Layout column split", (o) => {
    const layout = new Layout();
    layout.splitColumn(new Layout("top", { size: 3 }), new Layout(o));
    return layout;
  }],
  ["a Table cell", (o) => new Table().addColumn("head").addColumn("tail").addRow("x", o)],
  ["Columns", (o) => new Columns(["first", o])],
  ["a Tree", (o) => {
    const tree = new Tree("root");
    tree.add("sibling");
    tree.add(o);
    return tree;
  }],
  ["panels in panes in a panel", (o) => {
    const layout = new Layout();
    layout.splitRow(
      new Layout(new Panel("beside")),
      new Layout(new Panel(new Padding(new Align(o, "right"), 1))),
    );
    return new Panel(layout);
  }],
];

describe("a cell's anchor names what its owner drew there, through every container", () => {

  for (const [name, wrap] of cases) {
    it(name, () => {
      const owner = new Owner(["abcdef", "ghi", "jklmnop"]);
      const found = placements(frameOf(wrap(owner), OPTIONS), owner);
      expect(cellsOf(found)).toEqual(allCells(owner).sort());
    });
  }

  it("Align moves one owner's rows as a block, and each still names its own", () => {
    const owner = new Owner(["abcdef", "ghi"]);
    const found = placements(frameOf(new Align(owner, "center"), { maxWidth: 20 }), owner);
    const startOf = (row: number) => found.find((p) => p.row === row && p.col === 0)!.x;
    // The block is 6 wide, so 14 spare cells put its left edge at 7 — for the
    // short row too, which is padded out inside the block rather than centred.
    expect([startOf(0), startOf(1)]).toEqual([7, 7]);
  });

  it("a Viewport shows the rows its offset selects, named by their rows in the content", () => {
    const owner = new Owner(["abc", "def", "ghi", "jkl"]);
    const viewport = new Viewport(owner, { rows: 2 });
    viewport.scrollTo(1);
    const found = placements(frameOf(viewport, { maxWidth: 10 }), owner);
    expect(new Set(found.map((p) => p.row))).toEqual(new Set([1, 2]));
    expect(found.find((p) => p.row === 1 && p.col === 0)!.y).toBe(0);
  });

  it("a Viewport names itself under every cell it shows, gutter included, around its content", () => {
    const owner = new Owner(["abc", "def", "ghi", "jkl"]);
    const viewport = new Viewport(owner, { rows: 2, scrollbar: SCROLLBAR });
    viewport.scrollTo(1);
    const frame = frameOf(new Panel(viewport), { maxWidth: 8 });

    // Inside the panel's border and padding: three cells of content and one
    // of gutter, from (2, 1) to (5, 2).
    for (const y of [1, 2]) {
      for (let x = 2; x <= 5; x++) {
        const anchor = Segment.anchorAt(frame, x, y)!;
        expect(anchor.owner).toBe(viewport);
        expect([anchor.row, anchor.col]).toEqual([y - 1, x - 2]);
      }
    }
    // The content's own anchor rides inside: "def" is its row 1.
    expect(Segment.anchorAt(frame, 2, 1)!.inner).toMatchObject({ owner, row: 1, col: 0 });
    expect(Segment.anchorAt(frame, 5, 1)!.inner).toBeUndefined();
  });

  it("a crop keeps the cells it keeps, each still true", () => {
    const owner = new Owner(["abcdefghij"]);
    const found = placements(frameOf(new Layout(owner), { maxWidth: 4 }), owner);
    expect(cellsOf(found)).toEqual(["0,0", "0,1", "0,2", "0,3"]);
  });

  it("an owner inside an owner: each level names the same cell in its own output", () => {
    const inner = new Owner(["abc"]);
    const outerLines = [[new Segment(">> "), ...Segment.anchorLines(frameOf(inner, { maxWidth: 10 }), inner)[0]!]];
    const outer = {};
    const frame = Segment.anchorLines(outerLines, outer);

    const anchor = Segment.anchorAt(frame, 4, 0)!;
    expect(anchor.owner).toBe(outer);
    expect([anchor.row, anchor.col]).toEqual([0, 4]);
    expect(anchor.inner!.owner).toBe(inner);
    expect([anchor.inner!.row, anchor.inner!.col]).toEqual([0, 1]);
    expect(Segment.anchorAt(frame, 1, 0)!.inner).toBeUndefined();
  });
});

// `RenderOptions.onDraw` is how a runtime learns document order — the order
// focus moves in — and no container is told about it either.
describe("an owner is told of as it draws, through every container", () => {
  for (const [name, wrap] of cases) {
    it(name, () => {
      const owner = new Owner(["abcdef", "ghi", "jklmnop"]);
      const heard: object[] = [];
      [...wrap(owner).render({ ...OPTIONS, onDraw: (drawn) => heard.push(drawn) })];
      expect(heard).toContain(owner);
    });
  }
});

describe("cutting an anchored segment", () => {
  const owner = {};
  const [line] = Segment.anchorLines([[new Segment("ab漢cd")]], owner);
  const segment = line![0]!;

  it("shifts the right half by the cells left of the cut, wide glyphs counted as two", () => {
    const [left, right] = segment.splitCells(asCellCol(4));
    expect([left.text, left.style!.anchor!.col]).toEqual(["ab漢", 0]);
    expect([right.text, right.style!.anchor!.col]).toEqual(["cd", 4]);
  });

  it("starts a right half the cut went through at the glyph's second cell", () => {
    const [left, right] = segment.splitCells(asCellCol(3));
    expect([left.text, left.style!.anchor!.col]).toEqual(["ab ", 0]);
    expect([right.text, right.style!.anchor!.col]).toEqual([" cd", 3]);
  });

  it("shifts every level of a nested anchor", () => {
    const outer = {};
    const [nested] = Segment.anchorLines([[new Segment(">"), segment]], outer);
    const [, right] = nested![1]!.splitCells(asCellCol(2));
    const anchor = right.style!.anchor!;
    expect([anchor.col, anchor.inner!.col]).toEqual([3, 2]);
  });

  it("leaves an unanchored segment's style as it was", () => {
    const style = Style.parse("bold");
    const [, right] = new Segment("abcd", style).splitCells(asCellCol(2));
    expect(right.style).toBe(style);
  });
});

describe("reading a cell off a frame", () => {
  const [line] = Segment.anchorLines([[new Segment("ab")]], {});

  it("names no cell left of, right of, or between the frame's cells", () => {
    expect([-1, 2, 0.5].map((x) => Segment.anchorAt([line!], x, 0))).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("a RichText lays its text out anew", () => {
  it("admits no anchor, so a wrapped line names no cell it no longer holds", () => {
    const [stamped] = Segment.anchorLines([[new Segment("ab cd", Style.parse("red"))]], {});
    const text = new RichText("", { end: "" });
    for (const seg of stamped!) text.append(seg.text, seg.style);
    const frame = Segment.splitLines(text.render({ maxWidth: 2 }));
    expect(frame.flat().map((s) => s.style?.anchor)).toEqual(frame.flat().map(() => undefined));
  });

  it("keeps the rest of the look", () => {
    const [stamped] = Segment.anchorLines([[new Segment("ab", Style.parse("red"))]], {});
    const text = new RichText("ab", { style: stamped![0]!.style! });
    expect(String(text.style)).toBe("red");
  });
});

describe("an anchor is part of a style's identity", () => {
  it("keeps anchored cells from merging into the unanchored ones beside them", () => {
    const [stamped] = Segment.anchorLines([[new Segment("ab")]], {});
    const merged = [...Segment.simplify([new Segment("xy"), ...stamped!])];
    expect(merged.map((s) => s.text)).toEqual(["xy", "ab"]);
  });

  it("survives a container's style laid over it", () => {
    const [stamped] = Segment.anchorLines([[new Segment("ab", Style.parse("red"))]], {});
    const [styled] = [...Segment.applyStyle(stamped!, Style.parse("on blue"), Style.parse("bold"))];
    expect(styled!.style!.anchor).toBe(stamped![0]!.style!.anchor);
  });

  it("draws nothing", () => {
    const [stamped] = Segment.anchorLines([[new Segment("ab", Style.parse("red"))]], {});
    expect(stamped![0]!.style!.toString()).toBe("red");
  });
});
