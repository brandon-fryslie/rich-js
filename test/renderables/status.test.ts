import { describe, it, expect } from "vitest";
import { Console, type ConsoleOptions } from "../../src/core/console.js";
import { Status } from "../../src/renderables/status.js";
import { SPINNERS } from "../../src/core/spinnerData.js";
import { fakeClock } from "../core/fake-clock.js";

// [LAW:behavior-not-structure] What a running Status writes to its console.

/** A Status started with "start", its message then updated to `message`, which paints it. */
function run(message: string, options: ConsoleOptions = {}): string {
  const chunks: string[] = [];
  const file = { write: (data: string) => (chunks.push(data), true) } as NodeJS.WritableStream;
  const console = new Console({ file, width: 80, colorSystem: "ansi", forceTerminal: true, ...options });
  const status = new Status("start", { console });
  status.start();
  status.update(message);
  status.stop();
  return chunks.join("");
}

describe("Status", () => {
  it("draws its message's markup as styles, as Rich's does", () => {
    const out = run("[bold]Working[/]");
    expect(out).toContain("\x1b[1mWorking\x1b[0m");
    expect(out).not.toContain("[bold]");
  });

  it("draws the brackets under a console with markup off", () => {
    expect(run("[bold]Working[/]", { markup: false })).toContain("[bold]Working[/]");
  });

  it("colours its spinner with status.spinner and leaves the message to its markup", () => {
    const out = run("plain");
    expect(out).toMatch(/\x1b\[32m\S+\x1b\[0m plain/);
  });

  // rich-animation-xi28.6k9: the spinner turns on the clock the Status is
  // handed, each tick of its 12.5 Hz refresh one 80 ms dots frame on.
  it("draws each frame for the time on its clock, in order", () => {
    const dots = SPINNERS["dots"]!.frames;
    const chunks: string[] = [];
    const file = { write: (data: string) => (chunks.push(data), true) } as NodeJS.WritableStream;
    const console = new Console({ file, width: 80, colorSystem: "ansi", forceTerminal: true });
    const clock = fakeClock();
    const status = new Status("working", { console, clock });
    status.start();
    clock.advance(0.08 * 4 + 0.01);
    status.stop();
    const drawn = chunks.join("").match(/\x1b\[32m(\S)\x1b\[0m working/g)!.map((m) => m.replace(/\x1b\[\d+m/g, "")[0]);
    expect(drawn).toEqual(dots.slice(1, 5));
  });

  it("draws a message assigned while it runs", () => {
    const chunks: string[] = [];
    const file = { write: (data: string) => (chunks.push(data), true) } as NodeJS.WritableStream;
    const console = new Console({ file, width: 80, colorSystem: "ansi", forceTerminal: true });
    const clock = fakeClock();
    const status = new Status("before", { console, clock });
    status.start();
    status.message = "after";
    expect(status.message).toBe("after");
    clock.advance(0.1);
    status.stop();
    expect(chunks.join("")).toContain(" after");
    expect(chunks.join("")).not.toContain(" before");
  });
});
