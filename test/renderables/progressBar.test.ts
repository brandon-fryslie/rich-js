import { describe, it, expect } from "vitest";
import { ProgressBar } from "../../src/renderables/progressBar.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

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

  describe("measurement", () => {
    it("minimum >= 0", () => {
      // [SPEC] Implements Measurable. minimum >= 0.
      const bar = new ProgressBar();
      const m = bar.measure({ maxWidth: 80 });
      expect(m.minimum).toBeGreaterThanOrEqual(0);
    });
  });
});
