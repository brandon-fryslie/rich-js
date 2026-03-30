import { describe, it, expect } from "vitest";
import { Padding } from "../../src/renderables/padding.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { Renderable, Measurable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(renderable: Renderable, options: RenderOptions): string[] {
  const segments = [...renderable.render(options)];
  const lines = Segment.splitLines(segments);
  return lines.map((line) => line.map((s) => s.text).join(""));
}

function collectSegments(renderable: Renderable, options: RenderOptions): Segment[] {
  return [...renderable.render(options)];
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

describe("Padding", () => {
  // --- Construction: Padding Formats ---
  // Spec: single number = same value on all sides

  it("single number padding sets all four sides equally", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, 2);
    expect(padded.top).toBe(2);
    expect(padded.right).toBe(2);
    expect(padded.bottom).toBe(2);
    expect(padded.left).toBe(2);
  });

  // Spec: [vert, horiz] = vert for top/bottom, horiz for left/right

  it("[vert, horiz] padding maps to top/bottom and left/right", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [1, 2]);
    expect(padded.top).toBe(1);
    expect(padded.right).toBe(2);
    expect(padded.bottom).toBe(1);
    expect(padded.left).toBe(2);
  });

  // Spec: [top, right, bottom, left] CSS-style

  it("[top, right, bottom, left] padding (CSS-style)", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [1, 2, 3, 4]);
    expect(padded.top).toBe(1);
    expect(padded.right).toBe(2);
    expect(padded.bottom).toBe(3);
    expect(padded.left).toBe(4);
  });

  // --- Rendering ---
  // Spec: Content is surrounded by whitespace according to the padding values.

  it("top padding creates blank lines above content", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [2, 0, 0, 0]);
    const lines = collectLines(padded, { maxWidth: 20 });
    // 2 top blank lines + 1 content line
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it("bottom padding creates blank lines below content", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [0, 0, 2, 0]);
    const lines = collectLines(padded, { maxWidth: 20 });
    // 1 content line + 2 bottom blank lines
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it("left padding indents content", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [0, 0, 0, 3]);
    const lines = collectLines(padded, { maxWidth: 20 });
    // Content line should start with 3 spaces of left padding
    expect(lines[0]!.startsWith("   ")).toBe(true);
  });

  it("renders top + content + bottom for single number padding", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, 1);
    const lines = collectLines(padded, { maxWidth: 20 });
    // Should have top padding, content line, bottom padding
    expect(lines.length).toBe(3);
    // Content line should have left padding
    expect(lines[1]!.startsWith(" ")).toBe(true);
  });

  // --- Options ---
  // Spec: style applied to padding and content

  it("style option applies style to padding segments", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [1, 1, 1, 1], { style: "bold" });
    const segments = collectSegments(padded, { maxWidth: 20 });
    // Padding segments (non-newline) should have the style applied
    const styledSegments = segments.filter(
      (s) => !s.isControl && s.text.trim() === "" && s.style !== undefined,
    );
    expect(styledSegments.length).toBeGreaterThan(0);
  });

  // Spec: expand (default true) — expand to full terminal width

  it("expand defaults to true, filling maxWidth", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [0, 0, 0, 0]);
    const lines = collectLines(padded, { maxWidth: 20 });
    // With expand=true (default), content line should be padded to maxWidth
    expect(lines[0]!.length).toBe(20);
  });

  it("expand:false does not fill maxWidth", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [0, 0, 0, 0], { expand: false });
    const lines = collectLines(padded, { maxWidth: 40 });
    // With expand=false, line should not be padded to fill maxWidth
    expect(lines[0]!.length).toBeLessThanOrEqual(2); // "Hi" is 2 chars, no expansion
  });

  // --- Measurement ---
  // Spec: Minimum includes left + right padding (at least 4 for [0, 2, 0, 2])

  it("measurement minimum includes horizontal padding", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [0, 2, 0, 2]);
    const m = padded.measure({ maxWidth: 40 });
    // inner min is 2, horizontal pad is 4, total min >= 6
    expect(m.minimum).toBeGreaterThanOrEqual(6);
  });

  it("measurement maximum includes horizontal padding", () => {
    const inner = simpleRenderable("Hi");
    const padded = new Padding(inner, [0, 2, 0, 2]);
    const m = padded.measure({ maxWidth: 40 });
    // inner max is 2, horizontal pad is 4, total max = 6
    expect(m.maximum).toBe(6);
  });
});
