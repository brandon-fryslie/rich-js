import { describe, it, expect } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import { ColorRgba } from "../../src/core/color.js";
import { Measurement } from "../../src/core/measure.js";
import { renderToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Effected, type Effect } from "../../src/renderables/effect.js";
import { Frames, type Frame } from "../../src/renderables/frames.js";
import { Table } from "../../src/renderables/table.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";

// [LAW:behavior-not-structure] What is asserted is what a host sees: which
// glyphs are drawn at which handed time, at what width, in what bytes.

/** The motivating frames: nf-md chevron_up, chevron_double_up, chevron_triple_up, one second each. */
const CHEVRONS = ["\u{F0143}", "\u{F013F}", "\u{F0DBC}"];
const chevrons: Frame[] = CHEVRONS.map((glyph, i) => ({
  text: new RichText(glyph, { style: Style.fromColor(undefined, undefined).add(new Style({ color: ["red", "green", "blue"][i]! })) }),
  seconds: 1,
}));

const text = (frames: readonly Frame[], t: number): string => new Frames(frames, { t }).text().plain;
const drawn = (frames: readonly Frame[], t: number, width = 10): string => renderToString(new Frames(frames, { t }), { width });

describe("Frames — the frame in progress at a handed time", () => {
  it("each chevron is one cell wide in a Nerd Font, as cellLen measures it", () => {
    for (const glyph of CHEVRONS) expect(cellLen(glyph)).toBe(1);
  });

  it("draws the chevron for the time it is handed, looping, with no clock", () => {
    expect(text(chevrons, 0)).toBe(CHEVRONS[0]);
    expect(text(chevrons, 1.5)).toBe(CHEVRONS[1]);
    expect(text(chevrons, 2.2)).toBe(CHEVRONS[2]);
    expect(text(chevrons, 3.0)).toBe(CHEVRONS[0]);
  });

  it("each frame keeps its own colours", () => {
    expect(drawn(chevrons, 0, 1)).toContain("\x1b[31m");
    expect(drawn(chevrons, 1, 1)).toContain("\x1b[32m");
    expect(drawn(chevrons, 2, 1)).toContain("\x1b[34m");
  });

  it("draws every frame at one width, the widest frame's, so neighbours never move", () => {
    const uneven: Frame[] = [
      { text: new RichText("a"), seconds: 1 },
      { text: new RichText("abc"), seconds: 1 },
      { text: new RichText("ab"), seconds: 1 },
    ];
    const frames = (t: number): Frames => new Frames(uneven, { t });
    expect(frames(0).width).toBe(3);
    expect(frames(0).text().plain).toBe("a  ");
    expect(frames(1).text().plain).toBe("abc");
    expect(frames(2).text().plain).toBe("ab ");
    for (const t of [0, 1, 2]) {
      expect(frames(t).text().cellLength).toBe(3);
      expect(Measurement.get({ maxWidth: 80 }, frames(t))).toEqual(new Measurement(3, 3));
    }
  });

  it("a wide glyph counts its cells toward the width", () => {
    const frames = new Frames([{ text: new RichText("漢"), seconds: 1 }, { text: new RichText("a"), seconds: 1 }], { t: 1 });
    expect(frames.width).toBe(2);
    expect(frames.text().plain).toBe("a ");
  });

  it("ends no line of its own, so it sits inside a line among other cells", () => {
    const segments = [...new Frames(chevrons, { t: 0 }).render({ maxWidth: 10 })];
    expect(segments.map((s) => s.text).join("")).toBe(CHEVRONS[0]);
    expect(segments.some((s) => s.text.includes("\n"))).toBe(false);
    const line = new RichText("effort ", { end: "" }).append(new Frames(chevrons, { t: 1 }).text()).append(" max");
    expect(line.plain).toBe(`effort ${CHEVRONS[1]} max`);
  });

  it("a frame of several lines is set into one", () => {
    const frames = new Frames([{ text: new RichText("a\nb"), seconds: 1 }], { t: 0 });
    expect(frames.text().plain).toBe("a b");
    expect(frames.text().end).toBe("");
  });

  it("the text handed back is a copy: changing it changes no later frame", () => {
    const frames = new Frames(chevrons, { t: 0 });
    frames.text().plain = "x";
    expect(frames.text().plain).toBe(CHEVRONS[0]);
  });

  it("the frames handed in are the caller's: changing one later changes no draw", () => {
    const own = new RichText("a");
    const frames = new Frames([{ text: own, seconds: 1 }], { t: 0 });
    own.plain = "b";
    expect(frames.text().plain).toBe("a");
  });

  it("fits a table column at its width whichever frame is up", () => {
    const width = (t: number): number => {
      const table = Table.grid({ padding: 0 });
      table.addColumn("a");
      table.addColumn("b");
      table.addRow(new Frames([{ text: new RichText("•"), seconds: 1 }, { text: new RichText("•••"), seconds: 1 }], { t }), "tail");
      const [row] = Segment.splitLines([...table.render({ maxWidth: 40 })]);
      return row!.map((s) => s.text).join("").indexOf("tail");
    };
    expect(width(0)).toBe(3);
    expect(width(1)).toBe(3);
  });

  it("an effect lights whichever frame is up, by nesting, and still changes no glyph", () => {
    const lit: Effect = () => (colors) => ({ fg: new ColorRgba(255, 255, 0), bg: colors.bg });
    const under = (t: number): string => renderToString(new Effected(new Frames(chevrons, { t }), lit, { t, key: "k", theme: DEFAULT_TERMINAL_THEME }), { width: 1 });
    expect(under(0)).toContain(CHEVRONS[0]);
    expect(under(1)).toContain(CHEVRONS[1]);
    expect(under(0)).toContain("255;255;0");
  });
});

describe("Frames — at the host's rate, whatever it is", () => {
  it("sampled every 1/60 s over 3 s, each chevron is drawn for exactly 60 consecutive samples", () => {
    const samples = Array.from({ length: 180 }, (_, i) => text(chevrons, i / 60));
    const runs = samples.reduce<{ glyph: string; count: number }[]>((runs, glyph) => {
      const last = runs[runs.length - 1];
      if (last?.glyph === glyph) last.count++;
      else runs.push({ glyph, count: 1 });
      return runs;
    }, []);
    expect(runs).toEqual(CHEVRONS.map((glyph) => ({ glyph, count: 60 })));
  });

  it("sampled once a second, one-second frames turn once a second", () => {
    expect([0, 1, 2, 3, 4].map((t) => text(chevrons, t))).toEqual([...CHEVRONS, CHEVRONS[0], CHEVRONS[1]]);
  });

  it("sampled once a second, a frame shorter than a second is skipped, and a period of whole seconds freezes", () => {
    const quarters: Frame[] = ["a", "b", "c", "d"].map((glyph) => ({ text: new RichText(glyph), seconds: 0.25 }));
    expect([0, 1, 2, 3].map((t) => text(quarters, t))).toEqual(["a", "a", "a", "a"]);
    // The same frames at sixty a second show all four.
    expect(new Set(Array.from({ length: 60 }, (_, i) => text(quarters, i / 60)))).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("refuses a t that is not finite, and a hold that is not a positive number of seconds", () => {
    expect(() => new Frames(chevrons, { t: Number.NaN })).toThrow(/finite t/);
    expect(() => new Frames([{ text: new RichText("a"), seconds: 0 }], { t: 0 })).toThrow(/positive number of seconds/);
    expect(() => new Frames([], { t: 0 })).toThrow(/at least one hold/);
  });
});

describe("Frames — a draw costs the same at t = 0 and t = 10⁶ s", () => {
  // The effects' measured range on a 120-column row through `renderToString`
  // (epic rich-animation-xi28): 0.17–0.21 ms p50, ≤ 0.36 ms p99, at 60 fps.
  // The bound here is loose enough for a loaded CI machine and tight enough
  // that a draw walking time from zero would miss it at 10⁶ by orders.
  const P50_MS = 0.5;
  const row = (t: number): RichText =>
    new RichText("effort ", { end: "" })
      .append(new Frames(chevrons, { t }).text())
      .append(" " + "x".repeat(111));

  const p50 = (at: number): number => {
    const costs: number[] = [];
    for (let i = 0; i < 600; i++) {
      const t = at + i / 60;
      const started = performance.now();
      renderToString(row(t), { width: 120 });
      costs.push(performance.now() - started);
    }
    costs.sort((a, b) => a - b);
    return costs[300]!;
  };

  it("a 120-column row holding the frames draws within the effects' range at both times", () => {
    expect(row(0).cellLength).toBe(120);
    p50(0); // warm
    const near = p50(0);
    const far = p50(1e6);
    expect(near).toBeLessThan(P50_MS);
    expect(far).toBeLessThan(P50_MS);
  });
});
