import { describe, it, expect } from "vitest";
import { Console, type ConsoleOptions } from "../../src/core/console.js";
import { Status } from "../../src/renderables/status.js";

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
});
