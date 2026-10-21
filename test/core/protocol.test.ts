import { describe, it, expect } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { beat } from "../../src/core/easing.js";
import { activePass, afterPass, measure, render, type Presence, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
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

  /** Every report `render` makes for `renderable` under `options`. */
  const reports = (renderable: Renderable, options: RenderOptions): [Renderable, Presence][] => {
    const heard: [Renderable, Presence][] = [];
    [...render(renderable, { ...options, onPresent: (reported, presence) => heard.push([reported, presence]) })];
    return heard;
  };

  // The shape a `Progress` printed with no frame takes: it draws its table in
  // a frame of its host's time. Held, the child is what that frame shows, not
  // what the frame the container was handed shows.
  it("reports what a held container holds under the options it hands each child", () => {
    const a: Renderable = { render: () => [] };
    const b: Renderable = { render: () => [] };
    const child = Animation.map(beat([1, 1]), (i) => (i === 0 ? a : b));
    const framed: Renderable = {
      render: (options) => render(child, { ...options, frame: { time: 1.5, host: { frameTime: 1.5 } } }),
    };
    const shown = (maxWidth: number): Renderable[] =>
      reports(framed, { maxWidth }).flatMap(([reported]) => (reported === a || reported === b ? [reported] : []));
    expect(shown(40)).toEqual([b]);
    expect(shown(0)).toEqual([b]);
  });

  it("reports held everything a held container draws, whatever width it hands it", () => {
    const widens: Renderable = { render: (options) => render(drawsAnyway, { ...options, maxWidth: 10 }) };
    expect(reports(widens, { maxWidth: 0 })).toEqual([
      [widens, "held"],
      [drawsAnyway, "held"],
    ]);
  });

  it("draws a held renderable at no column, whatever width under one it was handed", () => {
    const handed: number[] = [];
    const records: Renderable = { render: (options) => (handed.push(options.maxWidth), []) };
    for (const maxWidth of [0, 0.5, -3, Number.NEGATIVE_INFINITY, Number.NaN]) [...render(records, { maxWidth })];
    expect(handed).toEqual([0, 0, 0, 0, 0]);
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

  it("runs nothing for a pass that throws, one whose caller stops early, a measurement, or a renderable held", () => {
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
    // Nor does a renderable held: nothing it drew is on the frame.
    const holds: Renderable = { render: (options) => render(handing("held", ran), { ...options, maxWidth: 10 }) };
    [...render(holds, { maxWidth: 0 })];
    expect(ran).toEqual(["drawn"]);
  });

  it("runs an effect now outside a pass", () => {
    const ran: string[] = [];
    afterPass(() => ran.push("now"));
    expect(ran).toEqual(["now"]);
  });
});
