/**
 * The simulated process, run in Node: an example's own `new Console()` writes
 * to the terminal we supply, and the build's own `process` is never touched.
 * The same contract in a browser page is e2e/simulated-process.spec.ts.
 *
 * The host environment is deliberately hostile while these run — `NO_COLOR`,
 * `FORCE_COLOR=0`, `COLUMNS=40` — so output that is truecolor and 75 cells
 * wide can only have come from the supplied terminal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import stripAnsi from "strip-ansi";
import { cellLen } from "../../src/index.js";
import { runInTerminal, type SimulatedTerminal } from "../../docs/.vitepress/simulated-process.js";
import { bundleProgram, repoPath } from "./bundle-program.js";

const LIBRARY = JSON.stringify(repoPath("src/index.ts"));

function terminal(columns: number): SimulatedTerminal & { readonly output: string[] } {
  const output: string[] = [];
  return {
    columns,
    rows: 24,
    isTTY: true,
    env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
    write: (chunk) => output.push(String(chunk)),
    output,
  };
}

const TABLE_PROGRAM = `
import { Console, Table } from ${LIBRARY};
const console = new Console();
const table = new Table({ title: "Planets", expand: true });
table.addColumn("Planet");
table.addColumn("Moons");
table.addRow("[bold #ff8800]Earth[/]", "1");
table.addRow("Mars", "2");
console.print(table);
`;

const PROGRESS_PROGRAM = `
import { Progress } from ${LIBRARY};
const progress = new Progress({ refreshPerSecond: 50 });
const task = progress.addTask("Copying", { total: 10 });
progress.start();
for (let i = 0; i < 10; i++) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  progress.updateTask(task, { advance: 1 });
}
progress.stop();
`;

describe("runInTerminal", () => {
  beforeEach(() => {
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("FORCE_COLOR", "0");
    vi.stubEnv("COLUMNS", "40");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, "sawStandIn");
  });

  it("sends a new Console()'s styled Table to the terminal, truecolor, at its width", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleProgram(TABLE_PROGRAM), term);

    const written = term.output.join("");
    expect(written).toContain("\x1b[38;2;255;136;0;1mEarth");
    const lines = stripAnsi(written).split("\n").filter((line) => line !== "");
    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines) expect(cellLen(line)).toBe(75);
    expect(stripAnsi(written)).toContain("Mars");
  });

  it("follows the supplied width, not a width of its own", async () => {
    const term = terminal(52);
    await runInTerminal(await bundleProgram(TABLE_PROGRAM), term);
    const lines = stripAnsi(term.output.join("")).split("\n").filter((line) => line !== "");
    for (const line of lines) expect(cellLen(line)).toBe(52);
  });

  it("animates a Progress built with no console into the same terminal", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleProgram(PROGRESS_PROGRAM), term);

    // Animating is several frames, each redrawn over the last.
    const frames = term.output.filter((chunk) => chunk.includes("Copying"));
    expect(frames.length).toBeGreaterThan(2);
    expect(term.output.join("")).toMatch(/\x1b\[\d*A/);
    expect(stripAnsi(frames.at(-1) ?? "")).toContain("100%");
  });

  it("leaves the build's own process as it was", async () => {
    const own = globalThis.process;
    const env = { ...process.env };
    const program = await bundleProgram(`
      process.env.LEAKED = "yes";
      globalThis.sawStandIn = process !== globalThis.process;
      ${TABLE_PROGRAM}
    `);
    await runInTerminal(program, terminal(75));

    expect(globalThis.process).toBe(own);
    expect(process.env).toEqual(env);
    expect(Reflect.get(globalThis, "sawStandIn")).toBe(true);
  });

  it("gives each run its own copy of the terminal's env", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleProgram(`process.env.TERM = "dumb";`), term);
    expect(term.env).toEqual({ TERM: "xterm-256color", COLORTERM: "truecolor" });
  });

  it("rejects with the program's own error", async () => {
    await expect(runInTerminal(`throw new RangeError("from the example");`, terminal(75)))
      .rejects.toThrow(new RangeError("from the example"));
  });

  it("rejects a program that was not bundled", async () => {
    await expect(runInTerminal(`import { Console } from ${LIBRARY};`, terminal(75)))
      .rejects.toThrow(SyntaxError);
  });
});
