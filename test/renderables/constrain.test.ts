import { describe, it, expect } from "vitest";
import { Constrain } from "../../src/renderables/constrain.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, Measurable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(renderable: Renderable, options: RenderOptions): string {
  return [...renderable.render(options)].map((s) => s.text).join("");
}

const makeRenderable = (text: string): Renderable & Measurable => ({
  *render(options: RenderOptions) {
    yield new Segment(text.slice(0, options.maxWidth));
  },
  measure(options: RenderOptions) {
    return { minimum: 1, maximum: Math.min(text.length, options.maxWidth) };
  },
});

describe("Constrain", () => {
  // Spec: Rendering — With width: Content rendered within the constrained width
  it("constrains maxWidth when width is set", () => {
    const inner = makeRenderable("Hello World");
    const constrained = new Constrain(inner, 5);
    const text = collectText(constrained, { maxWidth: 40 });
    expect(text).toBe("Hello");
  });

  // Spec: Rendering — width: undefined: Content passes through unconstrained
  it("passes through when no width set", () => {
    const inner = makeRenderable("Hello World");
    const constrained = new Constrain(inner);
    const text = collectText(constrained, { maxWidth: 40 });
    expect(text).toBe("Hello World");
  });

  // Spec (implicit): rendering uses min(width, options.maxWidth)
  it("uses the smaller of width and maxWidth for rendering", () => {
    const inner = makeRenderable("Hello World");
    const constrained = new Constrain(inner, 20);
    const text = collectText(constrained, { maxWidth: 8 });
    expect(text).toBe("Hello Wo");
  });

  // Spec: Measurement — With width: maximum <= width
  it("measurement with width constrains maximum", () => {
    const inner = makeRenderable("Hello World");
    const constrained = new Constrain(inner, 5);
    const m = constrained.measure({ maxWidth: 40 });
    expect(m.maximum).toBeLessThanOrEqual(5);
  });

  // Spec: Measurement — width: undefined: Passes through inner measurable's measurement
  it("measurement without width passes through", () => {
    const inner = makeRenderable("Hello World");
    const constrained = new Constrain(inner);
    const m = constrained.measure({ maxWidth: 40 });
    expect(m.maximum).toBe(11);
  });

  // Spec: Measurement — Width exceeds parent maxWidth: maximum <= options.maxWidth (never exceeds parent)
  it("measurement when width exceeds parent maxWidth never exceeds parent", () => {
    const inner = makeRenderable("Hello World");
    const constrained = new Constrain(inner, 100);
    const m = constrained.measure({ maxWidth: 8 });
    expect(m.maximum).toBeLessThanOrEqual(8);
  });
});
