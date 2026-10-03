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
import { mkdtempSync, openSync, closeSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it, expect, onTestFinished } from "vitest";
import { decodeAnsi } from "../../src/core/ansi.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");
const ALT_ON = "\x1b[?1049h";
const ALT_OFF = "\x1b[?1049l";

interface Ended {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly output: string;
}

/** A running fixture: its group, its directory, how it ended, and how to end it. */
interface Running {
  readonly pid: number;
  readonly dir: string;
  readonly ended: Promise<Ended>;
  /** Kill the fixture's whole group, wait for its end, and remove its directory. */
  readonly stop: () => Promise<void>;
}

/** Kill every process in the group `pid` leads. An empty group is already the goal. */
function killGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/**
 * Start the fixture. `drive` is called with the output so far every few
 * milliseconds and may signal the child; it returns once it has nothing left
 * to do.
 */
function launch(args: string[], drive: (output: string, child: { pid: number }) => boolean = () => true): Running {
  const dir = mkdtempSync(join(tmpdir(), "rich-app-"));
  const file = join(dir, "terminal");
  const fd = openSync(file, "w");
  const child = spawn(
    process.execPath,
    ["--import", join(FIXTURES, "ts-hooks.mjs"), join(FIXTURES, "app-ending.ts"), ...args],
    // Its own process group: `suspend` stops the whole group, which would
    // otherwise be the test runner's. Being outside the runner's group is also
    // why nothing but `stop` ends it when a test fails before it exits.
    { stdio: ["ignore", fd, fd], detached: true },
  );
  closeSync(fd);
  const pid = child.pid!;
  const read = (): string => readFileSync(file, "utf8");
  let driving = true;
  const timer = setInterval(() => {
    if (driving) driving = !drive(read(), { pid });
  }, 10);
  const ended = new Promise<Ended>((done, fail) => {
    child.on("error", fail);
    child.on("exit", (code, signal) => done({ code, signal, output: read() }));
  });
  return {
    pid,
    dir,
    ended,
    stop: async () => {
      clearInterval(timer);
      killGroup(pid);
      // The end is the test's to report; this waits for it, so the directory
      // goes only once nothing in the group can write to it.
      await Promise.allSettled([ended]);
      rmSync(dir, { recursive: true });
    },
  };
}

/**
 * Run the fixture to its end. However the test ends — passed, failed, or past
 * its timeout — the fixture's group is killed and its directory removed.
 */
function runApp(args: string[], drive?: (output: string, child: { pid: number }) => boolean): Promise<Ended> {
  const app = launch(args, drive);
  onTestFinished(app.stop);
  return app.ended;
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

  it("a fixture still running when its test ends leaves no process and no directory", async () => {
    let framed!: () => void;
    const painted = new Promise<void>((resolve) => (framed = resolve));
    const app = launch(["signal"], (sofar) => {
      if (!sofar.includes("FRAME")) return false;
      framed();
      return true;
    });
    await painted;

    await app.stop();

    expect((await app.ended).signal).toBe("SIGKILL");
    expect(() => process.kill(-app.pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    expect(existsSync(app.dir)).toBe(false);
  });
});
