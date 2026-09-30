/**
 * An `App` in a real node process hands the terminal back on every path the
 * program can end by, and before any crash report prints.
 *
 * [LAW:verifiable-goals] The order that matters — the alternate screen left
 * before a report is written — is decided by node's crash sequence, which
 * `process.emit` in a unit test does not run. So each case runs
 * `fixtures/app-ending.ts` in a child `node` with stdout and stderr on one
 * file: file writes are synchronous, so the file holds the two streams in the
 * order they were written, and a report drawn inside the alternate screen
 * shows up ahead of the byte that leaves it.
 *
 * The child's stdout is a file, not a terminal, so raw mode is a no-op there
 * and only the bytes are checked; raw mode's restoration is the unit suite's
 * (test/host/app.test.ts).
 */

import { spawn } from "node:child_process";
import { mkdtempSync, openSync, closeSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it, expect } from "vitest";
import { decodeAnsi } from "../../src/core/ansi.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");
const ALT_ON = "\x1b[?1049h";
const ALT_OFF = "\x1b[?1049l";

interface Ended {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly output: string;
}

/**
 * Run the fixture to its end. `drive` is called with the output so far every
 * few milliseconds and may signal the child; it returns once it has nothing
 * left to do.
 */
function runApp(args: string[], drive: (output: string, child: { pid: number }) => boolean = () => true): Promise<Ended> {
  const dir = mkdtempSync(join(tmpdir(), "rich-app-"));
  const file = join(dir, "terminal");
  const fd = openSync(file, "w");
  const child = spawn(
    process.execPath,
    ["--import", join(FIXTURES, "ts-hooks.mjs"), join(FIXTURES, "app-ending.ts"), ...args],
    // Its own process group: `suspend` stops the whole group, which would
    // otherwise be the test runner's.
    { stdio: ["ignore", fd, fd], detached: true },
  );
  closeSync(fd);
  const read = (): string => readFileSync(file, "utf8");
  let driving = true;
  const timer = setInterval(() => {
    if (driving) driving = !drive(read(), { pid: child.pid! });
  }, 10);
  return new Promise((done, fail) => {
    child.on("error", fail);
    child.on("exit", (code, signal) => {
      clearInterval(timer);
      const output = read();
      rmSync(dir, { recursive: true });
      done({ code, signal, output });
    });
  });
}

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/** Output from the first frame on, with the frame on the alternate screen. */
function expectFrameThenRestore(output: string): void {
  expect(output.indexOf(ALT_ON)).toBeGreaterThanOrEqual(0);
  expect(output.indexOf("FRAME")).toBeGreaterThan(output.indexOf(ALT_ON));
  expect(output.indexOf(ALT_OFF)).toBeGreaterThan(output.indexOf("FRAME"));
  expect(count(output, ALT_OFF)).toBe(1);
}

describe("App in a real node process", () => {
  it.each([
    ["throw", "", "thrown after the first frame"],
    ["throw", "traceback", "thrown after the first frame"],
    ["reject", "", "rejected after the first frame"],
    ["reject", "traceback", "rejected after the first frame"],
  ])("a crash (%s, reporter %j) leaves the alternate screen before the report prints", async (ending, reporter, message) => {
    const { code, output } = await runApp([ending, reporter]);

    expect(code).toBe(1);
    expectFrameThenRestore(output);
    const report = output.indexOf(message);
    expect(report).toBeGreaterThan(output.indexOf(ALT_OFF));
  });

  it("the rich reporter reports a rejection in Traceback's shape", async () => {
    const { output } = await runApp(["reject", "traceback"]);
    const report = output.slice(output.indexOf(ALT_OFF));

    // The location is as long as the checkout's path, so it may fold across
    // lines, each continuing under its frame's indent, and it is coloured when
    // the child's environment asks for colour. All of it is there either way.
    const plain = decodeAnsi(report).plain;
    expect(plain.replaceAll("\n  ", "")).toContain(pathToFileURL(join(FIXTURES, "app-ending.ts")).href);
    expect(plain).not.toContain("    at ");
  });

  it("a terminating signal hands the terminal back and still terminates", async () => {
    const { code, signal, output } = await runApp(["signal"], (sofar, child) => {
      if (!sofar.includes("FRAME")) return false;
      process.kill(child.pid, "SIGTERM");
      return true;
    });

    expect(signal).toBe("SIGTERM");
    expect(code).toBeNull();
    expectFrameThenRestore(output);
  });

  it("process.exit hands the terminal back and keeps its code", async () => {
    const { code, output } = await runApp(["exit"]);

    expect(code).toBe(3);
    expectFrameThenRestore(output);
  });

  it("stopping hands the terminal back and lets the program end", async () => {
    const { code, output } = await runApp(["stop"]);

    expect(code).toBe(0);
    expectFrameThenRestore(output);
  });

  // The child's group has no shell above it, so the kernel discards the
  // SIGTSTP, as it discards Ctrl+Z's in a job no shell controls: the program
  // goes on at once. Being stopped and continued is the same return from
  // `kill`, later, and is checked by hand under a pty.
  it("suspending hands the terminal back, then takes it back and repaints", async () => {
    const { code, output } = await runApp(["suspend"]);

    expect(code).toBe(0);
    const phases = output.split(ALT_OFF);
    expect(phases).toHaveLength(3);
    expect(phases[0]).toContain(ALT_ON);
    expect(phases[0]).toContain("FRAME");
    expect(phases[1]).toContain(ALT_ON);
    expect(phases[1]).toContain("FRAME");
  });
});
