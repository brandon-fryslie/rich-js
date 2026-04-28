import { describe, it, expect } from "vitest";
import {
  Strip,
  StripCell,
  PowerlineJoiner,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
} from "../../src/core/strip.js";
import { Style } from "../../src/core/style.js";
import type { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert what consumers observe — segment
// text, fg/bg pairs, ordering — not the internal walk.

const OPTIONS: RenderOptions = { maxWidth: 80 };

function render(strip: Strip): Segment[] {
  return [...strip.render(OPTIONS)];
}

const RED = new StripCell(" red ", Style.parse("white on red"));
const BLUE = new StripCell(" blue ", Style.parse("white on blue"));
const GREEN = new StripCell(" green ", Style.parse("white on green"));

describe("Strip render walk", () => {
  it("emits nothing for an empty strip", () => {
    const strip = new Strip([], new PowerlineJoiner());
    expect(render(strip)).toEqual([]);
  });

  it("emits start-cap, item, end-cap for one item", () => {
    const strip = new Strip([RED], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([">", " red ", ">"]);
  });

  it("emits start-cap, item, mid-join, item, end-cap for two items", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([">", " red ", ">", " blue ", ">"]);
  });

  it("scales linearly: 2N+1 segments for N items", () => {
    const strip = new Strip(
      [RED, BLUE, GREEN],
      new PowerlineJoiner({ glyph: ">" }),
    );
    const segs = render(strip);
    expect(segs).toHaveLength(7);
    expect(segs.map((s) => s.text)).toEqual([
      ">", " red ", ">", " blue ", ">", " green ", ">",
    ]);
  });
});

describe("PowerlineJoiner color inheritance", () => {
  it("start cap fg = first item's bg, no bg", () => {
    const strip = new Strip([RED], new PowerlineJoiner({ glyph: ">" }));
    const [start] = render(strip);
    expect(start!.style?.color?.name).toBe(RED.style.bgcolor?.name);
    expect(start!.style?.bgcolor).toBeUndefined();
  });

  it("end cap fg = last item's bg, no bg", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    const end = segs[segs.length - 1]!;
    expect(end.style?.color?.name).toBe(BLUE.style.bgcolor?.name);
    expect(end.style?.bgcolor).toBeUndefined();
  });

  it("middle join fg = left.bg, bg = right.bg", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    const mid = segs[2]!;
    expect(mid.style?.color?.name).toBe(RED.style.bgcolor?.name);
    expect(mid.style?.bgcolor?.name).toBe(BLUE.style.bgcolor?.name);
  });
});

describe("CapsuleJoiner", () => {
  it("start cap uses left glyph with right.bg as fg", () => {
    const strip = new Strip(
      [RED],
      new CapsuleJoiner({ left: "(", right: ")" }),
    );
    const [start] = render(strip);
    expect(start!.text).toBe("(");
    expect(start!.style?.color?.name).toBe(RED.style.bgcolor?.name);
    expect(start!.style?.bgcolor).toBeUndefined();
  });

  it("end cap uses right glyph with left.bg as fg", () => {
    const strip = new Strip(
      [RED],
      new CapsuleJoiner({ left: "(", right: ")" }),
    );
    const segs = render(strip);
    const end = segs[segs.length - 1]!;
    expect(end.text).toBe(")");
    expect(end.style?.color?.name).toBe(RED.style.bgcolor?.name);
  });

  it("middle emits close-cap, separator, open-cap", () => {
    const strip = new Strip(
      [RED, BLUE],
      new CapsuleJoiner({ left: "(", right: ")", separator: "·" }),
    );
    const segs = render(strip);
    // ( red ) · ( blue )
    expect(segs.map((s) => s.text)).toEqual([
      "(", " red ", ")", "·", "(", " blue ", ")",
    ]);
    expect(segs[2]!.style?.color?.name).toBe(RED.style.bgcolor?.name);
    expect(segs[4]!.style?.color?.name).toBe(BLUE.style.bgcolor?.name);
  });
});

describe("PlainJoiner", () => {
  it("emits empty caps and a styled separator between items", () => {
    const strip = new Strip(
      [RED, BLUE],
      new PlainJoiner({ separator: " | ", style: Style.parse("dim") }),
    );
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" red ", " | ", " blue "]);
  });

  it("emits no separator for a single item", () => {
    const strip = new Strip(
      [RED],
      new PlainJoiner({ separator: " | " }),
    );
    expect(render(strip).map((s) => s.text)).toEqual([" red "]);
  });
});

describe("GradientJoiner", () => {
  const FF0000 = new StripCell(" a ", Style.parse("on #ff0000"));
  const BLUE00FF = new StripCell(" b ", Style.parse("on #0000ff"));

  it("interpolates 3 distinct cells progressing monotonically along R/B", () => {
    const strip = new Strip([FF0000, BLUE00FF], new GradientJoiner({ steps: 3, glyph: "#" }));
    const segs = render(strip);
    // walk: start-cap (empty), item, gradient*3, item, end-cap (empty)
    expect(segs.map((s) => s.text)).toEqual([" a ", "#", "#", "#", " b "]);
    const grad = segs.slice(1, 4);
    const trips = grad.map((s) => s.style!.color!.getTruecolor());
    // Strictly monotonic: R decreases, B increases.
    expect(trips[0]!.red).toBeGreaterThan(trips[1]!.red);
    expect(trips[1]!.red).toBeGreaterThan(trips[2]!.red);
    expect(trips[0]!.blue).toBeLessThan(trips[1]!.blue);
    expect(trips[1]!.blue).toBeLessThan(trips[2]!.blue);
    // No anchor duplication (midpoint sampling).
    expect(trips[0]!.red).toBeLessThan(255);
    expect(trips[2]!.blue).toBeLessThan(255);
  });

  it("renders empty at endpoints", () => {
    const strip = new Strip([FF0000], new GradientJoiner({ steps: 4, glyph: "#" }));
    expect(render(strip).map((s) => s.text)).toEqual([" a "]);
  });

  it("renders empty when an item lacks a bgcolor", () => {
    const noBg = new StripCell(" x ", Style.parse("white"));
    const strip = new Strip([FF0000, noBg], new GradientJoiner({ steps: 2, glyph: "#" }));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " x "]);
  });

  it("defaults to steps=4 and glyph U+258E", () => {
    const strip = new Strip([FF0000, BLUE00FF], new GradientJoiner());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" a ", "\u258e", "\u258e", "\u258e", "\u258e", " b "]);
  });
});

describe("StripCell", () => {
  it("yields one segment with the configured style", () => {
    const cell = new StripCell("hi", Style.parse("white on red"));
    const segs = [...cell.render(OPTIONS)];
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text).toBe("hi");
    expect(segs[0]!.style?.bgcolor?.name).toBe("red");
  });
});
