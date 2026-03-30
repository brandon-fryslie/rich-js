import { describe, it, expect } from "vitest";
import { Rule } from "../../src/renderables/rule.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(renderable: Renderable, options: RenderOptions): string[] {
  const segments = [...renderable.render(options)];
  const lines = Segment.splitLines(segments);
  return lines.map((line) => line.map((s) => s.text).join(""));
}

describe("Rule", () => {
  it("renders a line of repeated characters filling maxWidth (no title)", () => {
    const rule = new Rule();
    const lines = collectLines(rule, { maxWidth: 10 });
    expect(lines[0]).toBe("──────────");
    expect(lines[0]!.length).toBe(10);
  });

  it("renders with title centered by default", () => {
    const rule = new Rule("Title");
    const lines = collectLines(rule, { maxWidth: 20 });
    const line = lines[0]!;
    expect(line).toContain(" Title ");
    expect(line.length).toBe(20);
    // Centered: title should have rule chars on both sides
    const titleIdx = line.indexOf(" Title ");
    expect(titleIdx).toBeGreaterThan(0);
    expect(titleIdx + " Title ".length).toBeLessThan(20);
  });

  it("renders with title left-aligned", () => {
    const rule = new Rule("Title", { align: "left" });
    const lines = collectLines(rule, { maxWidth: 20 });
    const line = lines[0]!;
    expect(line).toContain(" Title ");
    expect(line.length).toBe(20);
    // Left-aligned: title appears at the left
    expect(line.indexOf(" Title ")).toBe(0);
  });

  it("renders with title right-aligned", () => {
    const rule = new Rule("Title", { align: "right" });
    const lines = collectLines(rule, { maxWidth: 20 });
    const line = lines[0]!;
    expect(line).toContain(" Title ");
    expect(line.length).toBe(20);
    // Right-aligned: title appears at the right
    expect(line.endsWith(" Title ")).toBe(true);
  });

  it("uses custom characters", () => {
    const rule = new Rule(undefined, { characters: "*" });
    const lines = collectLines(rule, { maxWidth: 5 });
    expect(lines[0]).toBe("*****");
  });

  it("throws for empty characters", () => {
    expect(() => new Rule(undefined, { characters: "" })).toThrow();
  });

  it("throws for invalid align value", () => {
    // Spec: Invalid align values (e.g., "top") throw an error
    expect(() => new Rule(undefined, { align: "top" as any })).toThrow();
  });

  it("uses ASCII characters when asciiOnly", () => {
    const rule = new Rule();
    const lines = collectLines(rule, { maxWidth: 5, asciiOnly: true });
    expect(lines[0]).toBe("-----");
  });

  it("measurement minimum > 0", () => {
    const rule = new Rule("Title");
    const m = rule.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
  });
});
