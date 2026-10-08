import { describe, it, expect } from "vitest";
import { ProgressBar } from "../../src/renderables/progressBar.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { getStyle } from "../../src/core/protocol.js";
import { ColorDepth } from "../../src/core/color.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectSegments(r: Renderable, opts: RenderOptions): Segment[] {
  return [...r.render(opts)];
}

describe("ProgressBar", () => {
  describe("construction", () => {
    it("defaults total to 100", () => {
      // [SPEC] total default: 100
      const bar = new ProgressBar();
      expect(bar.total).toBe(100);
    });

    it("defaults completed to 0", () => {
      // [SPEC] completed default: 0
      const bar = new ProgressBar();
      expect(bar.completed).toBe(0);
    });

    it("accepts custom total and completed", () => {
      const bar = new ProgressBar({ total: 200, completed: 50 });
      expect(bar.total).toBe(200);
      expect(bar.completed).toBe(50);
    });
  });

  describe("properties", () => {
    it(".total is readable and writable", () => {
      // [SPEC] .total — Total value (denominator)
      const bar = new ProgressBar({ total: 100 });
      expect(bar.total).toBe(100);
      bar.total = 200;
      expect(bar.total).toBe(200);
    });

    it(".completed is readable and writable", () => {
      // [SPEC] .completed — Current progress value
      const bar = new ProgressBar({ completed: 25 });
      expect(bar.completed).toBe(25);
      bar.completed = 75;
      expect(bar.completed).toBe(75);
    });
  });

  describe("rendering", () => {
    it("renders at 0% (empty bar)", () => {
      // [SPEC] 0% — empty bar
      const bar = new ProgressBar({ total: 100, completed: 0, width: 10 });
      const text = collectText(bar, { maxWidth: 80 });
      expect(text.length).toBe(10);
    });

    it("renders at 50% (half-filled)", () => {
      // [SPEC] 50% — half-filled
      const bar = new ProgressBar({ total: 100, completed: 50, width: 10 });
      const text = collectText(bar, { maxWidth: 80 });
      expect(text.length).toBe(10);
    });

    it("renders at 100% (fully filled)", () => {
      // [SPEC] 100% — fully filled
      const bar = new ProgressBar({ total: 100, completed: 100, width: 10 });
      const text = collectText(bar, { maxWidth: 80 });
      expect(text.length).toBe(10);
    });

    it("custom width overrides default rendering width", () => {
      // [SPEC] Custom width overrides the default rendering width.
      const bar20 = new ProgressBar({ total: 100, completed: 50, width: 20 });
      const bar30 = new ProgressBar({ total: 100, completed: 50, width: 30 });
      const text20 = collectText(bar20, { maxWidth: 80 });
      const text30 = collectText(bar30, { maxWidth: 80 });
      expect(text20.length).toBe(20);
      expect(text30.length).toBe(30);
    });

    it("renders differently at different completion levels", () => {
      // [SPEC] Bar renders correctly at all progress levels (0%, 50%, 100%)
      // The bar at different levels should produce different styled segments
      const bar0 = new ProgressBar({ total: 100, completed: 0, width: 10 });
      const bar100 = new ProgressBar({ total: 100, completed: 100, width: 10 });
      const segs0 = collectSegments(bar0, { maxWidth: 80 });
      const segs100 = collectSegments(bar100, { maxWidth: 80 });
      // At 0% and 100% the segment counts or styles should differ
      const styles0 = segs0.map((s) => s.style);
      const styles100 = segs100.map((s) => s.style);
      expect(styles0).not.toEqual(styles100);
    });
  });

  // Python Rich 9d8f9a3 `ProgressBar.__rich_console__`, each case its output there.
  describe("as Rich draws it", () => {
    const texts = (r: Renderable, opts: RenderOptions): string[] => collectSegments(r, opts).map((s) => s.text);

    it("leaves the empty part blank on a colourless console", () => {
      const bar = new ProgressBar({ total: 10, completed: 5, width: 10 });
      expect(texts(bar, { maxWidth: 80, colorSystem: null })).toEqual(["━━━━━"]);
      expect(texts(new ProgressBar({ total: 10, width: 10 }), { maxWidth: 80, colorSystem: null })).toEqual([]);
      expect(texts(new ProgressBar({ total: 10, completed: 10, width: 10 }), { maxWidth: 80, colorSystem: null })).toEqual(["━━━━━━━━━━"]);
      expect(texts(new ProgressBar({ total: 100, completed: 50, width: 21 }), { maxWidth: 80, colorSystem: null, asciiOnly: true })).toEqual(["----------", " "]);
    });

    it("draws the empty part on a colour console, opened by a left half cell", () => {
      const half = new ProgressBar({ total: 10, completed: 5, width: 10 });
      expect(texts(half, { maxWidth: 80, colorSystem: ColorDepth.TRUECOLOR })).toEqual(["━━━━━", "╺", "━━━━"]);
      const none = new ProgressBar({ total: 10, completed: 0, width: 10 });
      expect(texts(none, { maxWidth: 80 })).toEqual(["━━━━━━━━━━"]);
    });

    it("draws the empty part in `bar.back`, Rich's default `style`", () => {
      const opts: RenderOptions = { maxWidth: 80, colorSystem: ColorDepth.TRUECOLOR };
      const [, , back] = collectSegments(new ProgressBar({ total: 10, completed: 5, width: 10 }), opts);
      expect(back?.style).toEqual(getStyle(opts, "bar.back"));
    });

    it("draws half a cell when the fill lands on a half", () => {
      // `BarColumn(40)` at 50% offered 21 cells.
      const bar = new ProgressBar({ total: 100, completed: 50, width: 40 });
      expect(texts(bar, { maxWidth: 21, colorSystem: null })).toEqual(["━━━━━━━━━━", "╸"]);
      expect(texts(bar, { maxWidth: 21 })).toEqual(["━━━━━━━━━━", "╸", "━━━━━━━━━━"]);
    });

    it("draws the half cells as spaces on an ASCII-only console", () => {
      const bar = new ProgressBar({ total: 100, completed: 50, width: 21 });
      expect(texts(bar, { maxWidth: 80, asciiOnly: true })).toEqual(["----------", " ", "----------"]);
    });

    it("treats a width of zero as none given, as Rich's `self.width or max_width` does", () => {
      const bar = new ProgressBar({ total: 10, completed: 10, width: 0 });
      expect(texts(bar, { maxWidth: 6 })).toEqual(["━━━━━━"]);
    });

    it("draws nothing at a negative width, as Rich's `\"━\" * -2` is empty", () => {
      expect(texts(new ProgressBar({ total: 10, completed: 5, width: -4 }), { maxWidth: 80 })).toEqual([]);
      expect(texts(new ProgressBar({ total: 10, completed: 5 }), { maxWidth: -4 })).toEqual([]);
    });

    it("draws a total of zero as a finished bar", () => {
      const bar = new ProgressBar({ total: 0, width: 10 });
      const segments = collectSegments(bar, { maxWidth: 80 });
      expect(segments.map((s) => s.text)).toEqual(["━━━━━━━━━━"]);
      expect(segments[0]?.style).toEqual(getStyle({ maxWidth: 80 }, bar.finishedStyle));
    });
  });

  describe("pulse", () => {
    const TRUECOLOR: RenderOptions = { maxWidth: 80, colorSystem: ColorDepth.TRUECOLOR };
    /** The columns drawn in a colour other than the empty bar's. */
    const lit = (bar: ProgressBar, opts: RenderOptions): number[] => {
      const back = getStyle(opts, bar.style).color?.name;
      const cols: number[] = [];
      let col = 0;
      for (const s of collectSegments(bar, opts)) {
        for (let i = 0; i < s.text.length; i++, col++) if (s.style?.color?.name !== back) cols.push(col);
      }
      return cols;
    };
    const centre = (cols: number[]): number => cols.reduce((a, b) => a + b, 0) / cols.length;

    it("carries its band along the bar as t moves on", () => {
      const at = (t: number) => lit(new ProgressBar({ width: 40, pulse: { t } }), TRUECOLOR);
      const early = at(2.5);
      const later = at(4.5);
      expect(early.length).toBeGreaterThan(0);
      expect(later.length).toBeGreaterThan(0);
      expect(centre(later)).toBeGreaterThan(centre(early) + 5);
    });

    it("draws the same bytes for the same t", () => {
      const draw = () => collectSegments(new ProgressBar({ width: 40, pulse: { t: 3 } }), TRUECOLOR);
      expect(draw()).toEqual(draw());
    });

    it("lights the line and never the ground, even a back the colour of the terminal's", () => {
      const black = (t: number) => new ProgressBar({ width: 40, style: "#000000", pulse: { t } });
      const frames = Array.from({ length: 40 }, (_, i) => i * 0.5);
      expect(frames.some((t) => lit(black(t), TRUECOLOR).length > 0)).toBe(true);
      for (const t of frames) for (const s of collectSegments(black(t), TRUECOLOR)) expect(s.style?.bgcolor).toBeUndefined();
    });

    it("draws nothing on an output with no colour, where the back and its light cannot be drawn", () => {
      const NO_COLOR: RenderOptions = { maxWidth: 80, colorSystem: null };
      for (const t of [0, 3, 30]) expect(collectSegments(new ProgressBar({ width: 40, completed: 70, pulse: { t } }), NO_COLOR)).toEqual([]);
    });

    it("is the empty bar, whatever it has completed, before the first pass enters", () => {
      const pulsing = new ProgressBar({ width: 40, completed: 70, pulse: { t: 0 } });
      expect(collectSegments(pulsing, TRUECOLOR)).toEqual(collectSegments(new ProgressBar({ width: 40 }), TRUECOLOR));
    });
  });

  describe("measurement", () => {
    it("minimum >= 0", () => {
      // [SPEC] Implements Measurable. minimum >= 0.
      const bar = new ProgressBar();
      const m = bar.measure({ maxWidth: 80 });
      expect(m.minimum).toBeGreaterThanOrEqual(0);
    });

    // Python Rich 9d8f9a3's `__rich_measure__` and `min(self.width or max_width, max_width)`.
    it("measures a given width exactly, and draws no wider than it is offered", () => {
      const bar = new ProgressBar({ total: 10, completed: 10, width: 40 });
      expect(bar.measure({ maxWidth: 80 })).toEqual({ minimum: 40, maximum: 40 });
      expect(collectText(bar, { maxWidth: 10 })).toBe("━".repeat(10));
    });

    // Python Rich 9d8f9a3: `ProgressBar(total=10, completed=10)` at width 50 draws 50 cells.
    it("fills the width it is offered when it is given none", () => {
      const bar = new ProgressBar({ total: 10, completed: 10 });
      expect(bar.measure({ maxWidth: 50 })).toEqual({ minimum: 4, maximum: 50 });
      expect(collectText(bar, { maxWidth: 50 })).toBe("━".repeat(50));
    });
  });
});
