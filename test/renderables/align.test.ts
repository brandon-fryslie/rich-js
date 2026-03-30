import { describe, it, expect } from "vitest";
import { Align } from "../../src/renderables/align.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, Measurable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(renderable: Renderable, options: RenderOptions): string[] {
  const segments = [...renderable.render(options)];
  const lines = Segment.splitLines(segments);
  return lines.map((line) => line.map((s) => s.text).join(""));
}

const simpleRenderable = (text: string): Renderable & Measurable => ({
  *render(_options: RenderOptions) {
    yield new Segment(text);
    yield Segment.line();
  },
  measure() {
    return { minimum: text.length, maximum: text.length };
  },
});

describe("Align", () => {
  // Spec: align — "left", "center", or "right"

  it("left alignment: content at left edge, padded on right", () => {
    const inner = simpleRenderable("Hi");
    const aligned = new Align(inner, "left");
    const lines = collectLines(aligned, { maxWidth: 10 });
    expect(lines[0]).toBe("Hi        ");
  });

  it("center alignment: content centered with leading spaces", () => {
    const inner = simpleRenderable("Hi");
    const aligned = new Align(inner, "center");
    const lines = collectLines(aligned, { maxWidth: 10 });
    // "Hi" (2 chars) in width 10 → 4 left pad, content, 4 right pad
    expect(lines[0]).toBe("    Hi    ");
  });

  it("right alignment: content pushed to right edge", () => {
    const inner = simpleRenderable("Hi");
    const aligned = new Align(inner, "right");
    const lines = collectLines(aligned, { maxWidth: 10 });
    expect(lines[0]).toBe("        Hi");
  });

  // Spec: Implements Renderable. .render(options) yields Segments.
  it("render yields Segment instances", () => {
    const inner = simpleRenderable("Hi");
    const aligned = new Align(inner, "left");
    const segments = [...aligned.render({ maxWidth: 10 })];
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg).toBeInstanceOf(Segment);
    }
  });

  // Spec: Implements Measurable. minimum > 0.
  it("measurement minimum > 0", () => {
    const inner = simpleRenderable("Hi");
    const aligned = new Align(inner, "center");
    const m = aligned.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
  });

  // Spec: constructor is new Align(renderable, align?) — align is optional
  it("align parameter is optional", () => {
    const inner = simpleRenderable("Hi");
    const aligned = new Align(inner);
    // Should render without error — the optional param has a valid default
    const lines = collectLines(aligned, { maxWidth: 10 });
    expect(lines.length).toBeGreaterThan(0);
  });
});
