import { describe, it, expect } from "vitest";
import {
  Strip,
  PowerlineJoiner,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
} from "../../src/core/strip.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import type { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { ColorDepth } from "../../src/core/color.js";

// [LAW:behavior-not-structure] Tests assert what consumers observe — segment
// text, fg/bg pairs, ordering — not the internal walk.

const OPTIONS: RenderOptions = { maxWidth: 80 };

function render(strip: Strip): Segment[] {
  return [...strip.render(OPTIONS)];
}

function cell(text: string, style: string | Style): RichText {
  return new RichText(text, { style, end: "" });
}

const RED = cell(" red ", "white on red");
const BLUE = cell(" blue ", "white on blue");
const GREEN = cell(" green ", "white on green");

describe("Strip render walk", () => {
  it("emits nothing for an empty strip", () => {
    const strip = new Strip([], new PowerlineJoiner());
    expect(render(strip)).toEqual([]);
  });

  it("emits item, end-cap for one item (no leading arrow)", () => {
    const strip = new Strip([RED], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" red ", ">"]);
  });

  it("emits item, mid-join, item, end-cap for two items (no leading arrow)", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" red ", ">", " blue ", ">"]);
  });

  it("scales linearly: 2N segments for N items", () => {
    const strip = new Strip(
      [RED, BLUE, GREEN],
      new PowerlineJoiner({ glyph: ">" }),
    );
    const segs = render(strip);
    expect(segs).toHaveLength(6);
    expect(segs.map((s) => s.text)).toEqual([
      " red ", ">", " blue ", ">", " green ", ">",
    ]);
  });
});

describe("PowerlineJoiner color inheritance", () => {
  it("emits no leading arrow at the start", () => {
    const strip = new Strip([RED], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    expect(segs[0]!.text).toBe(" red ");
  });

  it("end cap fg = last item's right-edge bg, no bg", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    const end = segs[segs.length - 1]!;
    expect(end.style?.color?.name).toBe(BLUE.edgeStyle("right").bgcolor?.name);
    expect(end.style?.bgcolor).toBeUndefined();
  });

  it("middle join fg = left.right-edge.bg, bg = right.left-edge.bg", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    const mid = segs[1]!;
    expect(mid.style?.color?.name).toBe(RED.edgeStyle("right").bgcolor?.name);
    expect(mid.style?.bgcolor?.name).toBe(BLUE.edgeStyle("left").bgcolor?.name);
  });
});

// [LAW:dataflow-not-control-flow] The PowerlineJoiner's middle transition is a
// function of the input edge colors: when both neighbors share an edge bg, the
// arrow is visually invisible (fg === bg) and should not emit a segment at all.
describe("PowerlineJoiner same-bg coalescing", () => {
  const RED_A = cell(" a ", "white on red");
  const RED_B = cell(" b ", "white on red");
  const RED_C = cell(" c ", "white on red");

  it("emits no mid-join segment when both neighbors share a bg", () => {
    const strip = new Strip([RED_A, RED_B], new PowerlineJoiner({ glyph: ">" }));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " b ", ">"]);
  });

  it("emits one shared SGR pair around three same-bg cells (not three)", () => {
    const strip = new Strip(
      [RED_A, RED_B, RED_C],
      new PowerlineJoiner({ glyph: ">" }),
    );
    const out = segmentsToString(strip.render(OPTIONS), ColorDepth.TRUECOLOR);
    const opens = (out.match(/\x1b\[(?!0m)[0-9;]+m/g) ?? []).length;
    const resets = (out.match(/\x1b\[0m/g) ?? []).length;
    expect(opens).toBe(2);
    expect(resets).toBe(2);
  });

  it("still emits a visible arrow when neighbor bgs differ (no over-coalescing)", () => {
    const strip = new Strip([RED, BLUE], new PowerlineJoiner({ glyph: ">" }));
    const mid = render(strip)[1]!;
    expect(mid.text).toBe(">");
    expect(mid.style?.color?.name).toBe(RED.edgeStyle("right").bgcolor?.name);
    expect(mid.style?.bgcolor?.name).toBe(BLUE.edgeStyle("left").bgcolor?.name);
  });
});

describe("CapsuleJoiner", () => {
  it("start cap uses left glyph with right.left-edge.bg as fg", () => {
    const strip = new Strip(
      [RED],
      new CapsuleJoiner({ left: "(", right: ")" }),
    );
    const [start] = render(strip);
    expect(start!.text).toBe("(");
    expect(start!.style?.color?.name).toBe(RED.edgeStyle("left").bgcolor?.name);
    expect(start!.style?.bgcolor).toBeUndefined();
  });

  it("end cap uses right glyph with left.right-edge.bg as fg", () => {
    const strip = new Strip(
      [RED],
      new CapsuleJoiner({ left: "(", right: ")" }),
    );
    const segs = render(strip);
    const end = segs[segs.length - 1]!;
    expect(end.text).toBe(")");
    expect(end.style?.color?.name).toBe(RED.edgeStyle("right").bgcolor?.name);
  });

  it("middle emits close-cap, separator, open-cap", () => {
    const strip = new Strip(
      [RED, BLUE],
      new CapsuleJoiner({ left: "(", right: ")", separator: "·" }),
    );
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([
      "(", " red ", ")", "·", "(", " blue ", ")",
    ]);
    expect(segs[2]!.style?.color?.name).toBe(RED.edgeStyle("right").bgcolor?.name);
    expect(segs[4]!.style?.color?.name).toBe(BLUE.edgeStyle("left").bgcolor?.name);
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
  const FF0000 = cell(" a ", "on #ff0000");
  const BLUE00FF = cell(" b ", "on #0000ff");

  it("emits half-block cells carrying two colour samples each", () => {
    const strip = new Strip([FF0000, BLUE00FF], new GradientJoiner({ steps: 3 }));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" a ", "▌", "▌", "▌", " b "]);
    const grad = segs.slice(1, 4);
    for (const s of grad) {
      expect(s.style!.color).toBeDefined();
      expect(s.style!.bgcolor).toBeDefined();
    }
    const samples = grad.flatMap((s) => [
      s.style!.color!.getTruecolor(),
      s.style!.bgcolor!.getTruecolor(),
    ]);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.red).toBeLessThan(samples[i - 1]!.red);
      expect(samples[i]!.blue).toBeGreaterThan(samples[i - 1]!.blue);
    }
    expect(samples[0]!.red).toBeLessThan(255);
    expect(samples[samples.length - 1]!.blue).toBeLessThan(255);
  });

  it("renders empty at endpoints", () => {
    const strip = new Strip([FF0000], new GradientJoiner({ steps: 4 }));
    expect(render(strip).map((s) => s.text)).toEqual([" a "]);
  });

  it("renders empty when an item lacks an edge bgcolor", () => {
    const noBg = cell(" x ", "white");
    const strip = new Strip([FF0000, noBg], new GradientJoiner({ steps: 2 }));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " x "]);
  });

  it("defaults to steps=4", () => {
    const strip = new Strip([FF0000, BLUE00FF], new GradientJoiner());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" a ", "▌", "▌", "▌", "▌", " b "]);
  });
});

// [LAW:locality-or-seam] The bg constraint that the joiner needs lives at the
// edge of the item, not as a uniform-bg constraint on the interior. These
// tests pin that contract: a RichText with varying-bg spans reports its
// edge styles accurately, and joiners paint transitions using those edges.
describe("edge-aware joiner protocol with varying interior styling", () => {
  it("RichText.edgeStyle returns base style for unspanned text", () => {
    const r = cell("hello", "white on red");
    expect(r.edgeStyle("left").bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right").bgcolor?.name).toBe("red");
  });

  it("RichText.edgeStyle reports span-overridden bg at the matching edge", () => {
    const r = new RichText("hello", { style: "white on red", end: "" });
    // Spans override bg on the right edge.
    r.stylize("on green", 4, 5);
    expect(r.edgeStyle("left").bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right").bgcolor?.name).toBe("green");
  });

  it("PowerlineJoiner paints the transition using the actual edge bgs", () => {
    const left = new RichText("ab", { style: "white on red", end: "" });
    left.stylize("on yellow", 1, 2); // right edge becomes yellow
    const right = new RichText("cd", { style: "white on blue", end: "" });
    right.stylize("on green", 0, 1); // left edge is green
    const strip = new Strip([left, right], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    const mid = segs.find((s) => s.text === ">")!;
    expect(mid.style?.color?.name).toBe("yellow");
    expect(mid.style?.bgcolor?.name).toBe("green");
  });

  it("empty RichText falls back to base style at both edges", () => {
    const r = cell("", "white on red");
    expect(r.edgeStyle("left").bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right").bgcolor?.name).toBe("red");
  });
});
