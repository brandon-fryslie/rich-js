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
    const mid = segs[1]!;
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

  it("emits half-block cells carrying two colour samples each", () => {
    const strip = new Strip([FF0000, BLUE00FF], new GradientJoiner({ steps: 3 }));
    const segs = render(strip);
    // walk: item, gradient*3, item.
    expect(segs.map((s) => s.text)).toEqual([" a ", "\u258c", "\u258c", "\u258c", " b "]);
    const grad = segs.slice(1, 4);
    // Each cell carries fg (left half) and bg (right half) — both real colours.
    for (const s of grad) {
      expect(s.style!.color).toBeDefined();
      expect(s.style!.bgcolor).toBeDefined();
    }
    // Flatten to the 6 sub-cell samples in visual order.
    const samples = grad.flatMap((s) => [
      s.style!.color!.getTruecolor(),
      s.style!.bgcolor!.getTruecolor(),
    ]);
    // Strictly monotonic across all 6 samples: R decreases, B increases.
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.red).toBeLessThan(samples[i - 1]!.red);
      expect(samples[i]!.blue).toBeGreaterThan(samples[i - 1]!.blue);
    }
    // No sample equals either anchor (midpoint sampling).
    expect(samples[0]!.red).toBeLessThan(255);
    expect(samples[samples.length - 1]!.blue).toBeLessThan(255);
  });

  it("renders empty at endpoints", () => {
    const strip = new Strip([FF0000], new GradientJoiner({ steps: 4 }));
    expect(render(strip).map((s) => s.text)).toEqual([" a "]);
  });

  it("renders empty when an item lacks a bgcolor", () => {
    const noBg = new StripCell(" x ", Style.parse("white"));
    const strip = new Strip([FF0000, noBg], new GradientJoiner({ steps: 2 }));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " x "]);
  });

  it("defaults to steps=4", () => {
    const strip = new Strip([FF0000, BLUE00FF], new GradientJoiner());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" a ", "\u258c", "\u258c", "\u258c", "\u258c", " b "]);
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

  it("parts form: yields one segment per part, all sharing cell bg", () => {
    const cell = new StripCell(
      [
        { text: " main " },
        { text: "S", style: Style.parse("green") },
        { text: " " },
        { text: "+3", style: Style.parse("green") },
        { text: " " },
        { text: "-2", style: Style.parse("red") },
        { text: " " },
      ],
      Style.parse("white on blue"),
    );
    const segs = [...cell.render(OPTIONS)];
    expect(segs.map((s) => s.text)).toEqual([" main ", "S", " ", "+3", " ", "-2", " "]);
    // Every segment carries the cell-level bg — the single-style invariant.
    for (const s of segs) {
      expect(s.style?.bgcolor?.name).toBe("blue");
    }
    // Per-part fg overlays land on the right runs.
    expect(segs[0]!.style?.color?.name).toBe("white"); // cell fg, no overlay
    expect(segs[1]!.style?.color?.name).toBe("green"); // S
    expect(segs[3]!.style?.color?.name).toBe("green"); // +3
    expect(segs[5]!.style?.color?.name).toBe("red");   // -2
  });

  it("parts form: text property is the concatenation of parts", () => {
    const cell = new StripCell(
      [{ text: " a " }, { text: "b", style: Style.parse("green") }, { text: " c " }],
      Style.parse("on blue"),
    );
    expect(cell.text).toBe(" a b c ");
  });

  it("parts form: cell.style is what joiners read (joiner-visible bg)", () => {
    // [LAW:single-enforcer] joiners must see the cell-level bg, not any per-part bg.
    const cellA = new StripCell(
      [{ text: "a" }, { text: "!", style: Style.parse("yellow bold") }],
      Style.parse("white on blue"),
    );
    const cellB = new StripCell(" b ", Style.parse("white on green"));
    const strip = new Strip([cellA, cellB], new PowerlineJoiner({ glyph: ">" }));
    const segs = render(strip);
    // Mid-join: fg = cellA.bg = blue, bg = cellB.bg = green.
    const mid = segs.find((s) => s.text === ">")!;
    expect(mid.style?.color?.name).toBe("blue");
    expect(mid.style?.bgcolor?.name).toBe("green");
  });

  it("parts form: rejects part styles that set bgcolor", () => {
    expect(
      () =>
        new StripCell(
          [{ text: "x", style: Style.parse("white on red") }],
          Style.parse("white on blue"),
        ),
    ).toThrow(/bgcolor/);
  });

  it("parts form: empty parts array yields no segments", () => {
    const cell = new StripCell([] as const, Style.parse("on blue"));
    expect([...cell.render(OPTIONS)]).toEqual([]);
    expect(cell.text).toBe("");
  });

  it("parts form: parts without overlay inherit cell fg + bg", () => {
    const cell = new StripCell(
      [{ text: "x" }, { text: "y", style: Style.parse("bold") }],
      Style.parse("white on blue"),
    );
    const segs = [...cell.render(OPTIONS)];
    expect(segs[0]!.style?.color?.name).toBe("white");
    expect(segs[0]!.style?.bgcolor?.name).toBe("blue");
    expect(segs[0]!.style?.bold).toBeUndefined();
    expect(segs[1]!.style?.color?.name).toBe("white"); // cell fg preserved
    expect(segs[1]!.style?.bgcolor?.name).toBe("blue");
    expect(segs[1]!.style?.bold).toBe(true); // attr overlay applied
  });
});
