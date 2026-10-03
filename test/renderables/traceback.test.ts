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

  it("wraps a frame wider than the report under itself, folding a location whole", () => {
    const error = new Error("x");
    error.stack = [
      "Error: x",
      `    at run (/${"deep/".repeat(20)}app.ts:7:1)`,
      "    at Object.reject (/a/b.ts:3:1)",
    ].join("\n");
    expect(collectText(new Traceback(error), { maxWidth: 40 })).toBe([
      "Error: x",
      "",
      "  run ",
      "  /deep/deep/deep/deep/deep/deep/deep/de",
      "  ep/deep/deep/deep/deep/deep/deep/deep/",
      "  deep/deep/deep/deep/deep/app.ts:7",
      "  Object.reject /a/b.ts:3",
      "",
    ].join("\n"));
  });

  // --- V8 frame shapes ---

  it.each([
    { frame: "at walk (/a.ts:5:10)", shown: "walk /a.ts:5" },
    { frame: "at /a.ts:9:1", shown: "/a.ts:9" },
    { frame: "at async outer (/a.ts:6:26)", shown: "outer /a.ts:6" },
    { frame: "at async node:internal/modules/esm/loader:650:26", shown: "node:internal/modules/esm/loader:650" },
    { frame: "at async file:///app/main.mjs:9:7", shown: "file:///app/main.mjs:9" },
    { frame: "at async (/a.ts:5:29)", shown: "async /a.ts:5" },
    { frame: "at async async (/a.ts:5:29)", shown: "async /a.ts:5" },
    { frame: "at new Foo (/a.ts:3:1)", shown: "new Foo /a.ts:3" },
    { frame: "at async Promise.all (index 0)", shown: "Promise.all index 0" },
    { frame: "at async Promise.allSettled (index 2)", shown: "Promise.allSettled index 2" },
    { frame: "at Array.map (<anonymous>)", shown: "Array.map <anonymous>" },
    { frame: "at new Promise (<anonymous>)", shown: "new Promise <anonymous>" },
    { frame: "at fn (native)", shown: "fn native" },
    { frame: "at <anonymous>", shown: "<anonymous>" },
    { frame: "at eval (eval at f (file:///app/s.mjs:8:22), <anonymous>:1:1)", shown: "eval file:///app/s.mjs:8" },
    {
      frame: "at eval (eval at g (eval at f (file:///app/s.mjs:8:22), <anonymous>:3:4), <anonymous>:1:1)",
      shown: "eval file:///app/s.mjs:8",
    },
    { frame: "at /dir (copy)/a.js:4:2", shown: "/dir (copy)/a.js:4" },
  ])("renders `$frame` as `$shown`", ({ frame, shown }) => {
    const error = new Error("x");
    error.stack = `Error: x\n    ${frame}`;
    expect(collectText(new Traceback(error), { maxWidth: 80 })).toBe(`Error: x\n\n  ${shown}\n`);
  });

  it("places a real eval frame at the file that ran it, where suppress finds it", () => {
    let caught: unknown;
    try {
      eval("throw new Error('from eval')");
    } catch (error) {
      caught = error;
    }
    const text = collectText(new Traceback(caught), { maxWidth: 200 });
    expect(text).toMatch(/^ {2}eval \S*traceback\.test\.ts:\d+$/m);
    const suppressed = collectText(new Traceback(caught, { suppress: ["traceback.test.ts"] }), { maxWidth: 200 });
    expect(suppressed).not.toMatch(/^ {2}eval /m);
  });

  it("keeps the frames V8 writes with no line: Promise.all, new Promise, Array.map", async () => {
    const report = async (run: () => Promise<unknown>): Promise<string> => {
      try {
        await run();
      } catch (error) {
        return collectText(new Traceback(error), { maxWidth: 200 });
      }
      throw new Error("run did not throw");
    };
    const rejectLater = async (): Promise<never> => {
      await null;
      throw new Error("inside");
    };
    expect(await report(() => Promise.all([rejectLater()]))).toMatch(/^ {2}Promise\.all index 0$/m);
    expect(await report(() => new Promise(() => { throw new Error("executor"); }))).toMatch(/^ {2}new Promise <anonymous>$/m);
    expect(await report(async () => [1].map(() => { throw new Error("mapper"); }))).toMatch(/^ {2}Array\.map <anonymous>$/m);
  });

  it("never reads a line of the message as a frame", () => {
    const error = new Error("compile failed\nat /src/a.ts:3:1");
    const text = collectText(new Traceback(error), { maxWidth: 200 });
    expect(text).toContain("Error: compile failed\nat /src/a.ts:3:1\n\n");
    expect(text).not.toMatch(/^ {2}\/src\/a\.ts:3$/m);
    expect(text).toMatch(/^ {2}\S*traceback\.test\.ts:\d+$/m);
  });

  it("drops a stale header when the message changed after the throw", () => {
    const error = new Error("first\nsecond line");
    error.message = "replaced";
    const text = collectText(new Traceback(error), { maxWidth: 200 });
    expect(text.startsWith("Error: replaced\n\n")).toBe(true);
    expect(text).not.toContain("first");
    expect(text).not.toContain("second line");
  });

  it("reads a SpiderMonkey or JavaScriptCore stack, which has no header", () => {
    const error = new Error("x");
    error.stack = [
      "inner@file:///app/a.js:3:5",
      "async*outer@file:///app/a.js:9:1",
      "@file:///app/a.js:12:1",
      "run@file:///app/a.js line 8 > eval:1:1",
    ].join("\n");
    expect(collectText(new Traceback(error), { maxWidth: 80 })).toBe([
      "Error: x",
      "",
      "  inner file:///app/a.js:3",
      "  outer file:///app/a.js:9",
      "  file:///app/a.js:12",
      "  run file:///app/a.js:8",
      "",
    ].join("\n"));
  });

  it("shows a stack line it cannot read as written, not as no frame at all", () => {
    const error = new Error("x");
    error.stack = "Error: x\n    some engine's frame #1\n    another";
    expect(collectText(new Traceback(error), { maxWidth: 80 })).toBe(
      "Error: x\n\n  some engine's frame #1\n  another\n",
    );
  });

  // --- Caught values of any shape ---

  it.each([
    { value: "boom", shown: 'NonError: "boom"' },
    { value: 42, shown: "NonError: 42" },
    { value: null, shown: "NonError: null" },
    { value: undefined, shown: "NonError: undefined" },
    { value: { code: 42 }, shown: "NonError: { code: 42 }" },
  ])("renders a thrown $value as the value it is", ({ value, shown }) => {
    expect(collectText(new Traceback(value), { maxWidth: 80 })).toBe(`${shown}\n\n`);
  });

  it("reports a thrower shaped like an error as the error it presents", () => {
    const thrown = { name: "HttpError", message: "404", stack: "HttpError: 404\n    at get (/app/http.ts:7:3)" };
    expect(collectText(new Traceback(thrown), { maxWidth: 80 })).toBe("HttpError: 404\n\n  get /app/http.ts:7\n");
  });

  it("salvages the frames of a value that carries a stack but is not an error", () => {
    const thrown = { name: "Odd", stack: "    at doWork (/app/w.ts:99:1)" };
    const text = collectText(new Traceback(thrown), { maxWidth: 200 });
    expect(text.startsWith("NonError: ")).toBe(true);
    expect(text).toMatch(/^ {2}doWork \/app\/w\.ts:99$/m);
  });

  it("renders an error whose message was replaced with a non-string, frames and all", () => {
    const error = new Error("replaced");
    (error as { message: unknown }).message = 42;
    const text = collectText(new Traceback(error), { maxWidth: 200 });
    expect(text.startsWith("NonError: ")).toBe(true);
    expect(text).toMatch(/^ {2}\S*traceback\.test\.ts:\d+$/m);
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
