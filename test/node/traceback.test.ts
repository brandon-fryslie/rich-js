/**
 * Contract of `installTraceback` — the node-seam crash renderer.
 *
 * [LAW:behavior-not-structure] The assertions are what an operator observes: a
 * crash produces `Traceback`-shaped output on stderr rather than node's raw
 * stack dump, and the process exits 1. Dispatch is node's own — the tests
 * register through `process.on` and let the real `EventEmitter` deliver — so
 * what is stubbed is only the two edges (`stderr.write`, `exit`) that would
 * otherwise take the test runner down with them.
 *
 * The tell that output went through `Traceback` and not the raw `error.stack`
 * is the frame shape: `Traceback` renders `"  fn file:line"`, where a raw
 * stack renders `"    at fn (file:line:col)"`. Every test asserts on
 * ANSI-stripped text so colour depth cannot make them flap.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import stripAnsi from "strip-ansi";

import { installTraceback } from "../../src/node/traceback.js";

type WriteCall = { text: string; flush: () => void };

/** Captured stderr writes, each holding the drain callback unfired so tests
 *  can observe what happens before and after the bytes land. */
let writes: WriteCall[];
let exitCode: number | undefined;
let savedListeners: {
  uncaughtException: NodeJS.UncaughtExceptionListener[];
  unhandledRejection: NodeJS.UnhandledRejectionListener[];
};
let savedColumns: string | undefined;

beforeEach(() => {
  writes = [];
  exitCode = undefined;

  // Pin the width the installer's Console reads, so a narrow terminal cannot
  // wrap a frame path mid-token and break the assertions.
  savedColumns = process.env["COLUMNS"];
  process.env["COLUMNS"] = "200";

  savedListeners = {
    uncaughtException: process.listeners("uncaughtException"),
    unhandledRejection: process.listeners("unhandledRejection"),
  };
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");

  vi.spyOn(process.stderr, "write").mockImplementation(
    ((text: string, flush: () => void) => {
      writes.push({ text, flush });
      return true;
    }) as unknown as typeof process.stderr.write,
  );
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCode = code;
  }) as unknown as typeof process.exit);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");
  for (const listener of savedListeners.uncaughtException) {
    process.on("uncaughtException", listener);
  }
  for (const listener of savedListeners.unhandledRejection) {
    process.on("unhandledRejection", listener);
  }
  if (savedColumns === undefined) {
    delete process.env["COLUMNS"];
  } else {
    process.env["COLUMNS"] = savedColumns;
  }
});

/** The single stderr payload the installer produced, ANSI stripped. */
function reported(): string {
  expect(writes).toHaveLength(1);
  return stripAnsi(writes[0]!.text);
}

describe("installTraceback", () => {
  it("renders an uncaught exception through Traceback", () => {
    installTraceback();
    const error = new Error("sync boom");

    process.emit("uncaughtException", error, "uncaughtException");

    const output = reported();
    expect(output).toContain("Error: sync boom");
    // Frames present, in Traceback's shape rather than the raw stack's.
    expect(output).toContain("traceback.test.ts");
    expect(output).not.toContain("    at ");
  });

  it("renders an unhandled rejection through Traceback", () => {
    installTraceback();
    const error = new Error("async boom");

    process.emit("unhandledRejection", error, Promise.resolve());

    const output = reported();
    expect(output).toContain("Error: async boom");
    expect(output).toContain("traceback.test.ts");
    expect(output).not.toContain("    at ");
  });

  it("names a non-Error rejection reason and shows no borrowed frames", () => {
    installTraceback();

    process.emit("unhandledRejection", { code: 42 }, Promise.resolve());

    const output = reported();
    expect(output).toContain("NonError");
    expect(output).toContain("code: 42");
    // A rejected plain object has no call site; rich-js's own frames would be
    // a lie about where the fault is.
    expect(output).not.toContain("src/node/traceback");
  });

  // `throw "boom"` is legal JS and node delivers the raw value, even though
  // `@types/node` annotates the payload as `Error`. Without a conversion the
  // renderable reads `.name`/`.message` off a string and reports an empty
  // "Error: ", discarding the one detail a crash report exists to carry.
  it("renders a non-Error uncaught payload rather than discarding it", () => {
    installTraceback();

    process.emit(
      "uncaughtException",
      "raw string boom" as unknown as Error,
      "uncaughtException",
    );

    const output = reported();
    expect(output).toContain("NonError");
    expect(output).toContain("raw string boom");
  });

  it("replaces the previous handler instead of accumulating listeners", () => {
    installTraceback();
    installTraceback();
    installTraceback({ maxFrames: 2 });

    expect(process.listenerCount("uncaughtException")).toBe(1);
    expect(process.listenerCount("unhandledRejection")).toBe(1);

    // Last call wins, options included — a re-install is not silently ignored.
    process.emit("uncaughtException", deepError(6), "uncaughtException");
    expect(reported()).toContain("frames omitted");
  });

  it("passes TracebackOptions through to the renderable", () => {
    installTraceback({ maxFrames: 2 });

    process.emit("uncaughtException", deepError(6), "uncaughtException");

    expect(reported()).toContain("frames omitted");
  });

  it("exits 1 only once stderr has drained", () => {
    installTraceback();

    process.emit("uncaughtException", new Error("boom"), "uncaughtException");

    // The write is outstanding: exiting here truncates a piped stderr at the
    // pipe buffer, losing the tail of exactly the report the operator needs.
    expect(exitCode).toBeUndefined();

    writes[0]!.flush();
    expect(exitCode).toBe(1);
  });
});

/** An error with at least `depth` stack frames, for the maxFrames check. */
function deepError(depth: number): Error {
  if (depth === 0) return new Error("deep");
  return deepError(depth - 1);
}
