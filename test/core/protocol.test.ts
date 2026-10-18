import { describe, it, expect } from "vitest";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";

// A renderable that draws regardless of its width, so what `render` lets
// through is all that decides what comes out.
const drawsAnyway: Renderable = { render: () => [new Segment("x"), Segment.line()] };

describe("render", () => {
  // Rich's `Console.render`: `if _options.max_width < 1: return`.
  it("draws nothing under one column, a width that parses to none included", () => {
    for (const maxWidth of [0, 0.5, -3, Number.NaN]) {
      expect([...render(drawsAnyway, { maxWidth })], `maxWidth ${maxWidth}`).toEqual([]);
    }
  });

  it("still tells the owners a renderable handed no column holds, nested and lazy ones included", () => {
    const inner = { *render(options: RenderOptions) { options.onDraw?.(this); yield new Segment("y"); } };
    const outer: Renderable = {
      render(options) {
        options.onDraw?.(this);
        return [...render(inner, options), new Segment("x")];
      },
    };
    for (const maxWidth of [0, -3, Number.NaN]) {
      const told: object[] = [];
      const drawn = [...render(outer, { maxWidth, onDraw: (owner) => told.push(owner) })];
      expect(drawn, `maxWidth ${maxWidth}`).toEqual([]);
      expect(told, `maxWidth ${maxWidth}`).toEqual([outer, inner]);
    }
  });

  it("runs nothing under one column when no one is told of owners", () => {
    const ran: number[] = [];
    const counts: Renderable = { render: (options) => (ran.push(options.maxWidth), []) };
    expect([...render(counts, { maxWidth: 0 })]).toEqual([]);
    expect(ran).toEqual([]);
  });

  it("draws the renderable from one column up", () => {
    for (const maxWidth of [1, 1.5, 80, Number.POSITIVE_INFINITY]) {
      expect([...render(drawsAnyway, { maxWidth })].map((s) => s.text), `maxWidth ${maxWidth}`).toEqual(["x", "\n"]);
    }
  });
});
