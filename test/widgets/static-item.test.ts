import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import { StaticItem } from "../../src/widgets/static-item.js";

const RENDER = { maxWidth: 80, isTerminal: true, encoding: "utf-8" as const };

describe("StaticItem", () => {
  describe("measure", () => {
    it("measures the widest line when rendered segments are one-per-line", () => {
      const item = new StaticItem({
        id: "lines",
        render: () => [
          new Segment("short"),       // 5 cells
          new Segment("\n"),
          new Segment("a much longer"), // 13 cells
          new Segment("\n"),
          new Segment("mid"),         // 3 cells
        ],
      });
      const { minimum, maximum } = item.measure(RENDER);
      expect(minimum).toBe(13);
      expect(maximum).toBe(13);
    });

    it("measures correctly when a single segment contains embedded newlines", () => {
      // Segment.splitLines splits on \n inside text, so a renderable that
      // emits "a\nlonger\nb" as one Segment must still be measured by the
      // widest LINE, not the total character count.
      const item = new StaticItem({
        id: "embedded",
        render: () => [new Segment("a\nlonger\nb")],
      });
      const { minimum, maximum } = item.measure(RENDER);
      expect(minimum).toBe(6); // "longer"
      expect(maximum).toBe(6);
    });

    it("delegates to options.measure when supplied", () => {
      const item = new StaticItem({
        id: "delegating",
        render: () => [new Segment("ignored")],
        measure: () => ({ minimum: 42, maximum: 42 }),
      });
      expect(item.measure(RENDER)).toEqual({ minimum: 42, maximum: 42 });
    });
  });
});
