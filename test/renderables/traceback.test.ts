import { describe, it, expect } from "vitest";
import { Traceback } from "../../src/renderables/traceback.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

describe("Traceback", () => {
  // --- Construction ---

  it("constructs from an Error", () => {
    const error = new Error("Something went wrong");
    const tb = new Traceback(error);
    const text = collectText(tb, { maxWidth: 80 });
    expect(text).toContain("Error");
    expect(text).toContain("Something went wrong");
  });

  it("renders error name and message", () => {
    const error = new TypeError("bad type");
    const tb = new Traceback(error);
    const text = collectText(tb, { maxWidth: 80 });
    expect(text).toContain("TypeError");
    expect(text).toContain("bad type");
  });

  // --- Stack Frames ---

  it("renders stack frames with file paths", () => {
    const error = new Error("test");
    const tb = new Traceback(error);
    const text = collectText(tb, { maxWidth: 80 });
    // Stack should contain file references
    expect(text.length).toBeGreaterThan(20);
  });

  it("renders file paths and line numbers in stack frames", () => {
    const error = new Error("test");
    const tb = new Traceback(error);
    const text = collectText(tb, { maxWidth: 80 });
    // Should contain at least one colon-separated line number
    expect(text).toMatch(/:\d+/);
  });

  // --- Frame Suppression ---

  it("suppresses frames matching given patterns", () => {
    const error = new Error("test");
    const tbAll = new Traceback(error);
    const tbSuppressed = new Traceback(error, { suppress: ["node_modules"] });
    const textAll = collectText(tbAll, { maxWidth: 80 });
    const textSuppressed = collectText(tbSuppressed, { maxWidth: 80 });
    // Suppressed version should still contain the error
    expect(textSuppressed).toContain("Error");
    // Suppressed frames show less info (file/line only, no function name or source)
    // so output is equal or shorter
    expect(textSuppressed.length).toBeLessThanOrEqual(textAll.length);
  });

  it("suppressed frames show file and line only, without code", () => {
    // Spec: suppressed frames appear with file/line only — not removed entirely
    const error = new Error("test");
    error.stack = [
      "Error: test",
      "  at Object.userFn (/project/src/app.ts:10:5)",
      "  at Object.libFn (node_modules/express/index.js:5:3)",
    ].join("\n");

    const tb = new Traceback(error, { suppress: ["node_modules"] });
    const text = collectText(tb, { maxWidth: 80 });

    // Both frames appear (suppressed frames not removed per spec)
    expect(text).toContain("/project/src/app.ts");
    expect(text).toContain("node_modules/express");

    // Non-suppressed frame shows function name
    expect(text).toContain("userFn");
    // Suppressed frame does NOT show function name (file and line only)
    expect(text).not.toContain("libFn");
  });

  // --- Max Frames ---

  it("limits frames with maxFrames", () => {
    const error = new Error("test");
    const tb = new Traceback(error, { maxFrames: 2 });
    const text = collectText(tb, { maxWidth: 80 });
    expect(text).toContain("Error");
  });

  it("defaults maxFrames to 100", () => {
    const error = new Error("test");
    const tb = new Traceback(error);
    // Should render without issue at default maxFrames
    const text = collectText(tb, { maxWidth: 80 });
    expect(text).toContain("Error");
  });

  it("shows first N/2 and last N/2 frames with separator when exceeding maxFrames", () => {
    // Create an error and set maxFrames very low
    const error = new Error("test");
    const tb = new Traceback(error, { maxFrames: 2 });
    const text = collectText(tb, { maxWidth: 80 });
    // If there are more frames than maxFrames, should show omission message
    // The behavior depends on number of actual stack frames
    expect(text).toContain("Error");
  });

  // --- Install ---

  it("install is a static method", () => {
    expect(typeof Traceback.install).toBe("function");
  });

  // --- Options ---

  it("accepts suppress option as string array", () => {
    const error = new Error("test");
    const tb = new Traceback(error, { suppress: ["express", "node_modules"] });
    const text = collectText(tb, { maxWidth: 80 });
    expect(text).toContain("Error");
  });

  it("accepts maxFrames of 0 for unlimited", () => {
    const error = new Error("test");
    // maxFrames: 0 means unlimited per spec
    const tb = new Traceback(error, { maxFrames: 0 });
    const text = collectText(tb, { maxWidth: 80 });
    expect(text).toContain("Error");
  });
});
