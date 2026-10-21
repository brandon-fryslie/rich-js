import { describe, it, expect } from "vitest";
import { activePass, afterPass, measure, render, type Renderable } from "../../src/core/protocol.js";
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

  it("draws the renderable from one column up", () => {
    for (const maxWidth of [1, 1.5, 80, Number.POSITIVE_INFINITY]) {
      expect([...render(drawsAnyway, { maxWidth })].map((s) => s.text), `maxWidth ${maxWidth}`).toEqual(["x", "\n"]);
    }
  });
});

describe("afterPass", () => {
  /** Hands `name` to the pass after drawing one segment, and records when it runs. */
  const handing = (name: string, ran: string[]): Renderable => ({
    *render() {
      yield new Segment(name);
      afterPass(() => ran.push(`${name}${activePass() === undefined ? "" : " in a pass"}`));
    },
  });

  it("runs each effect between passes once the outermost render is drawn whole, in document order", () => {
    const ran: string[] = [];
    const frame: Renderable = {
      *render(options) {
        yield* render(handing("a", ran), options);
        yield* render(handing("b", ran), options);
      },
    };
    const steps = render(frame, { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    steps.next();
    expect(ran).toEqual([]);
    expect(steps.next().done).toBe(true);
    expect(ran).toEqual(["a", "b"]);
  });

  it("runs an effect handed over by a render that returns an array when the render returns", () => {
    const ran: string[] = [];
    const eager: Renderable = {
      render() {
        afterPass(() => ran.push("eager"));
        return [];
      },
    };
    render(eager, { maxWidth: 10 });
    expect(ran).toEqual(["eager"]);
  });

  it("runs nothing for a pass that throws, one whose caller stops early, or a measurement", () => {
    const ran: string[] = [];
    const throws: Renderable = {
      *render(options) {
        yield* render(handing("thrown", ran), options);
        throw new Error("boom");
      },
    };
    expect(() => [...render(throws, { maxWidth: 10 })]).toThrow("boom");

    const steps = render(handing("stopped", ran), { maxWidth: 10 })[Symbol.iterator]();
    steps.next();
    steps.return?.();

    const measured = {
      render: (): Segment[] => [],
      measure: () => {
        [...render(handing("measured", ran), { maxWidth: 10 })];
        return { minimum: 0, maximum: 0 };
      },
    };
    measure(measured, { maxWidth: 10 });
    // A measurement inside a drawing pass drops its effects, and the pass keeps its own.
    const frame: Renderable = {
      *render(options) {
        measure(measured, options);
        yield* render(handing("drawn", ran), options);
      },
    };
    [...render(frame, { maxWidth: 10 })];
    expect(ran).toEqual(["drawn"]);
  });

  it("runs an effect now outside a pass", () => {
    const ran: string[] = [];
    afterPass(() => ran.push("now"));
    expect(ran).toEqual(["now"]);
  });
});
