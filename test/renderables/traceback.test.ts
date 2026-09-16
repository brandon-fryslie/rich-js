import { describe, it, expect } from "vitest";
import { Traceback } from "../../src/renderables/traceback.js";
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

  function stackOf(frameCount: number): Error {
    const error = new Error("deep");
    error.stack = [
      "Error: deep",
      ...Array.from({ length: frameCount }, (_, i) => `    at f${i} (/a.ts:${i + 1}:1)`),
    ].join("\n");
    return error;
  }

  function frameNames(text: string): string[] {
    return [...text.matchAll(/^ {2}(f\d+) /gm)].map((m) => m[1]!);
  }

  it.each([
    { maxFrames: 1, shown: ["f4"], omitted: 4 },
    { maxFrames: 2, shown: ["f0", "f4"], omitted: 3 },
    { maxFrames: 3, shown: ["f0", "f3", "f4"], omitted: 2 },
  ])("shows exactly maxFrames=$maxFrames frames and counts the rest", ({ maxFrames, shown, omitted }) => {
    const text = collectText(new Traceback(stackOf(5), { maxFrames }), { maxWidth: 80 });
    expect(frameNames(text)).toEqual(shown);
    expect(text).toContain(`... ${omitted} frames omitted ...`);
  });

  it("caps at 100 frames by default", () => {
    const text = collectText(new Traceback(stackOf(101)), { maxWidth: 80 });
    expect(frameNames(text)).toHaveLength(100);
    expect(text).toContain("... 1 frames omitted ...");
  });

  it("renders the name, message and one line per frame", () => {
    // Pins the sample output docs/traceback.md shows for a caught exception.
    const error = new TypeError("Invalid field: role");
    error.stack = [
      "TypeError: Invalid field: role",
      "    at processUser (/app/src/users.ts:42:11)",
      "    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)",
      "    at main (/app/src/index.ts:12:3)",
    ].join("\n");
    expect(collectText(new Traceback(error), { maxWidth: 80 })).toBe([
      "TypeError: Invalid field: role",
      "",
      "  processUser /app/src/users.ts:42",
      "  Layer.handle /app/node_modules/express/lib/router/layer.js:95",
      "  main /app/src/index.ts:12",
      "",
    ].join("\n"));
  });

  // Installing Traceback as the process-wide crash handler is a node
  // capability and lives behind `node/traceback`; its contract is asserted in
  // test/node/traceback.test.ts.

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
