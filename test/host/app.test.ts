/**
 * Contract of `App` — the runtime that takes the terminal, paints a frame of
 * its view, and hands the terminal back on every path out.
 *
 * [LAW:behavior-not-structure] What is asserted is what the terminal sees —
 * the bytes written to it and whether it is in raw mode — and what `run`
 * settles with. The host is a script of the `TerminalHost` contract whose
 * resize, exit and resume the test fires by hand. The real node process —
 * signals, a crash, job control — is test/node/crash-order.test.ts.
 */

import { describe, it, expect } from "vitest";
import stripAnsi from "strip-ansi";

import { App, type AppOptions } from "../../src/host/app.js";
import type {
  ResizeHandler,
  TerminalHost,
  TerminalSize,
} from "../../src/host/terminal-host.js";
import { RichText } from "../../src/core/text.js";
import { Layout } from "../../src/renderables/layout.js";
import type { Renderable } from "../../src/core/protocol.js";

const ALT_ON = "\x1b[?1049h";
const ALT_OFF = "\x1b[?1049l";
const CURSOR_OFF = "\x1b[?25l";
const CURSOR_ON = "\x1b[?25h";

interface ScriptedHost extends TerminalHost {
  /** Everything written, joined. */
  readonly output: () => string;
  readonly raw: () => boolean;
  readonly started: () => boolean;
  resize(size: TerminalSize): void;
  exit(): void;
  /** The pending `suspend()`, resolved by the test as a shell's `fg` would. */
  resume(): void;
  readonly suspends: () => number;
}

function scriptedHost(initial: TerminalSize = { cols: 20, rows: 4 }): ScriptedHost {
  let size = initial;
  let raw = false;
  let started = false;
  let suspends = 0;
  let resume: () => void = () => {
    throw new Error("resume() with no suspend pending");
  };
  const writes: string[] = [];
  const resizeHandlers = new Set<ResizeHandler>();
  const exitHandlers = new Set<() => void>();
  return {
    output: () => writes.join(""),
    raw: () => raw,
    started: () => started,
    suspends: () => suspends,
    resize(next) {
      size = next;
      for (const h of resizeHandlers) h(next);
    },
    exit() {
      for (const h of [...exitHandlers]) h();
    },
    resume: () => resume(),
    write(data) {
      writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
    },
    onData: () => () => {},
    onResize(handler) {
      resizeHandlers.add(handler);
      return () => resizeHandlers.delete(handler);
    },
    onExit(handler) {
      exitHandlers.add(handler);
      return () => exitHandlers.delete(handler);
    },
    suspend() {
      suspends += 1;
      return new Promise<void>((resolve) => {
        resume = resolve;
      });
    },
    size: () => size,
    setRawMode(next) {
      raw = next;
    },
    isTTY: true,
    writesToTerminal: true,
    env: { TERM: "xterm-256color" },
    start() {
      started = true;
    },
    stop() {
      started = false;
      resizeHandlers.clear();
      exitHandlers.clear();
    },
  };
}

function text(value: string): Renderable {
  return new RichText(value, { end: "" });
}

function app(host: ScriptedHost, view: () => Renderable, surface: AppOptions["surface"] = "alternate"): App {
  return new App({ host, surface, view });
}

/** The frame's rows as the user reads them. */
function rows(target: App): string[] {
  return target.frame.map((line) => line.map((s) => s.text).join(""));
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("App on the alternate screen", () => {
  it("takes the terminal and paints the view as a region the size of the screen", () => {
    const host = scriptedHost({ cols: 12, rows: 3 });
    const target = app(host, () => text("hello"));

    void target.run();

    expect(target.phase).toBe("running");
    expect(host.started()).toBe(true);
    expect(host.raw()).toBe(true);
    expect(host.output().startsWith(ALT_ON + CURSOR_OFF)).toBe(true);
    // A region: padded to every row of the screen.
    expect(rows(target)).toEqual(["hello", "", ""]);
    expect(stripAnsi(host.output())).toContain("hello");
  });

  it("gives a Layout the whole screen", () => {
    const host = scriptedHost({ cols: 10, rows: 4 });
    const layout = new Layout();
    layout.splitColumn(new Layout(text("top"), { name: "top" }), new Layout(text("bottom"), { name: "bottom" }));
    const target = app(host, () => layout);

    void target.run();

    // Each half of the split is half the screen's rows.
    expect(rows(target)).toEqual(["top", "", "bottom", ""]);
  });

  it("paints every change made before a frame into that one frame", async () => {
    let label = "a";
    let views = 0;
    const host = scriptedHost();
    const target = app(host, () => {
      views += 1;
      return text(label);
    });
    void target.run();

    label = "b";
    target.refresh();
    label = "c";
    target.refresh();
    await tick();

    expect(views).toBe(2);
    expect(rows(target)[0]).toBe("c");
  });

  it("keeps the frame on screen until the resized one replaces it", async () => {
    const host = scriptedHost({ cols: 10, rows: 2 });
    const target = app(host, () => text("x".repeat(30)));
    void target.run();
    const before = target.frame;

    host.resize({ cols: 6, rows: 3 });

    // An event arriving now lands on what the user sees.
    expect(target.frame).toBe(before);
    await tick();
    expect(target.frame).not.toBe(before);
    expect(target.frame).toHaveLength(3);
    expect(rows(target).every((row) => row.length <= 6)).toBe(true);
  });

  it("hands the terminal back when stopped, and run resolves", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("hi"));
    const running = target.run();

    target.stop();

    await expect(running).resolves.toBeUndefined();
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.started()).toBe(false);
    expect(host.output().endsWith(CURSOR_ON + ALT_OFF)).toBe(true);
  });

  // The rest of the program's end — a crash report, then the exit — is
  // still running; code after `await run()` must not run inside it.
  it("hands the terminal back when the program ends under it, and run does not settle", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("hi"));
    let settled = false;
    void target.run().then(
      () => (settled = true),
      () => (settled = true),
    );

    host.exit();
    await tick();

    expect(settled).toBe(false);
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.output().endsWith(CURSOR_ON + ALT_OFF)).toBe(true);
  });

  it("hands the terminal back before rejecting with the error a frame threw", async () => {
    const host = scriptedHost();
    const fault = new Error("view broke");
    let broken = false;
    const target = app(host, () => {
      if (broken) throw fault;
      return text("fine");
    });
    const running = target.run();

    broken = true;
    target.refresh();

    await expect(running).rejects.toBe(fault);
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.output().endsWith(CURSOR_ON + ALT_OFF)).toBe(true);
  });

  it("rejects when the first frame throws, with the terminal handed back", async () => {
    const host = scriptedHost();
    const fault = new Error("never drew");
    const target = app(host, () => {
      throw fault;
    });

    await expect(target.run()).rejects.toBe(fault);
    expect(host.raw()).toBe(false);
    expect(host.output()).toContain(ALT_OFF);
  });

  it("suspends by handing the terminal back first, and repaints on resume", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("frame"));
    void target.run();

    const suspended = target.suspend();

    expect(target.phase).toBe("suspended");
    expect(host.suspends()).toBe(1);
    expect(host.raw()).toBe(false);
    expect(host.output().endsWith(CURSOR_ON + ALT_OFF)).toBe(true);

    const handedBack = host.output().length;
    host.resume();
    await suspended;

    expect(target.phase).toBe("running");
    expect(host.raw()).toBe(true);
    const resumed = host.output().slice(handedBack);
    expect(resumed.startsWith(ALT_ON + CURSOR_OFF)).toBe(true);
    expect(stripAnsi(resumed)).toContain("frame");
  });

  it("does not repaint while suspended, nor take the terminal back once stopped", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("frame"));
    const running = target.run();
    const suspended = target.suspend();
    const handedBack = host.output().length;

    target.refresh();
    await tick();
    expect(host.output().length).toBe(handedBack);

    target.stop();
    host.resume();
    await suspended;
    await running;

    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.output().length).toBe(handedBack);
  });

  it("runs once", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("x"));
    const first = target.run();
    target.stop();
    await first;

    await expect(target.run()).rejects.toThrow(/runs once/);
  });
});

describe("App inline", () => {
  it("keeps the frame's own height under the terminal as a ceiling", () => {
    const host = scriptedHost({ cols: 10, rows: 5 });
    const target = app(host, () => text("one\ntwo"), "inline");

    void target.run();

    expect(rows(target)).toEqual(["one", "two"]);
    expect(host.output()).not.toContain(ALT_ON);
  });

  it("crops a frame taller than the terminal to the terminal", () => {
    const host = scriptedHost({ cols: 10, rows: 2 });
    const target = app(host, () => text("a\nb\nc\nd"), "inline");

    void target.run();

    expect(rows(target)).toEqual(["a", "b"]);
  });

  it("paints over its own last frame, blanking the rows a shorter one leaves", async () => {
    const host = scriptedHost({ cols: 10, rows: 10 });
    let body = "a\nb\nc";
    const target = app(host, () => text(body), "inline");
    void target.run();
    const first = host.output().length;

    body = "z";
    target.refresh();
    await tick();

    const second = host.output().slice(first);
    // Back to the first frame's top row, then three rows: the new one and
    // two blanked.
    const home = "\x1b[2A\r";
    expect(second.startsWith(home)).toBe(true);
    expect(stripAnsi(second.slice(home.length)).split("\n")).toEqual(["z", "", ""]);
  });

  it("after blanking, starts the next frame and the program's next line from its own height", async () => {
    const host = scriptedHost({ cols: 10, rows: 10 });
    let body = "a\nb\nc";
    const target = app(host, () => text(body), "inline");
    const running = target.run();

    body = "y\nz";
    target.refresh();
    await tick();
    const second = host.output().length;
    body = "x";
    target.refresh();
    await tick();
    const third = host.output().slice(second);
    target.stop();
    await running;
    const last = host.output().slice(second + third.length);

    // One row up from the second frame's last row to its first, not two.
    expect(third.startsWith("\x1b[1A\r")).toBe(true);
    // The row it blanked is left behind, and the program's line follows the
    // frame's one row.
    expect(third.endsWith("\x1b[1A")).toBe(true);
    expect(last.endsWith(CURSOR_ON + "\n")).toBe(true);
  });

  it("leaves the frame on the terminal with the cursor below it", async () => {
    const host = scriptedHost({ cols: 10, rows: 10 });
    const target = app(host, () => text("a\nb"), "inline");
    const running = target.run();

    target.stop();
    await running;

    expect(host.output().endsWith(CURSOR_ON + "\n")).toBe(true);
    expect(host.output()).not.toContain(ALT_OFF);
  });
});
