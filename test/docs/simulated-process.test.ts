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
import { cellLen, Console } from "../../src/index.js";
import { runInTerminal, type SimulatedTerminal } from "../../docs/.vitepress/simulated-process.js";
import { bundleExample } from "../../docs/.vitepress/example-runner.js";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { resolve } from "node:path";
import { formatWithOptions } from "node:util";

const LIBRARY = JSON.stringify(resolve(REPO_ROOT, "src/index.ts"));

interface TestTerminal extends SimulatedTerminal {
  readonly output: string[];
  readonly exits: number[];
  /** Type at the terminal, once the program has subscribed. */
  type(chunk: string): void;
}

function terminal(columns: number): TestTerminal {
  const output: string[] = [];
  const exits: number[] = [];
  let deliver: ((chunk: string) => void) | undefined;
  return {
    columns,
    rows: 24,
    isTTY: true,
    env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
    write: (chunk) => output.push(String(chunk)),
    onInput: (to) => {
      deliver = to;
    },
    exit: (code) => exits.push(code),
    output,
    exits,
    type: (chunk) => deliver!(chunk),
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
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "sawStandIn");
  });

  it("sends a new Console()'s styled Table to the terminal, truecolor, at its width", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleExample(TABLE_PROGRAM), term);

    const written = term.output.join("");
    expect(written).toContain("\x1b[1;38;2;255;136;0mEarth");
    const lines = stripAnsi(written).split("\n").filter((line) => line !== "");
    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines) expect(cellLen(line)).toBe(75);
    expect(stripAnsi(written)).toContain("Mars");
  });

  it("follows the supplied width, not a width of its own", async () => {
    const term = terminal(52);
    await runInTerminal(await bundleExample(TABLE_PROGRAM), term);
    const lines = stripAnsi(term.output.join("")).split("\n").filter((line) => line !== "");
    for (const line of lines) expect(cellLen(line)).toBe(52);
  });

  it("animates a Progress built with no console into the same terminal", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleExample(PROGRESS_PROGRAM), term);

    // Animating is several frames, each redrawn over the last: back to the
    // frame's first cell, then its rows erased and drawn again.
    const frames = term.output.filter((chunk) => chunk.includes("Copying"));
    expect(frames.length).toBeGreaterThan(2);
    // Each repaint: synchronized output begun, back up over the last frame, each row erased as it is reached.
    expect(frames.slice(1).every((chunk) => /^\x1b\[\?2026h(\x1b\[\d+A)?\r\x1b\[2K/.test(chunk))).toBe(true);
    expect(stripAnsi(frames.at(-1) ?? "")).toContain("100%");
  });

  it("keeps two overlapping runs in their own terminals", async () => {
    const [table, progress] = await Promise.all([bundleExample(TABLE_PROGRAM), bundleExample(PROGRESS_PROGRAM)]);
    const wide = terminal(75);
    const narrow = terminal(52);
    await Promise.all([runInTerminal(progress, wide), runInTerminal(table, narrow), runInTerminal(table, wide)]);

    const narrowText = stripAnsi(narrow.output.join(""));
    expect(narrowText).not.toContain("Copying");
    for (const line of narrowText.split("\n").filter((l) => l !== "")) expect(cellLen(line)).toBe(52);
    const wideText = stripAnsi(wide.output.join(""));
    expect(wideText).toContain("Copying");
    expect(wideText).toContain("Mars");
  });

  it("leaves the build's own process as it was", async () => {
    const own = globalThis.process;
    const env = { ...process.env };
    const program = await bundleExample(`
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
    await runInTerminal(await bundleExample(`process.env.TERM = "dumb";`), term);
    expect(term.env).toEqual({ TERM: "xterm-256color", COLORTERM: "truecolor" });
  });

  it("writes the program's console calls to the terminal, formatted as Node formats them", async () => {
    const term = terminal(75);
    const host = (["log", "info", "debug", "warn", "error"] as const).map((method) => vi.spyOn(globalThis.console, method));
    await runInTerminal(
      await bundleExample(`
        console.log("%s scored", "Alice", { scores: [98, 87], at: new Date(0) }, 42n);
        console.info("info");
        console.debug("debug");
        console.warn("warn");
        console.error(new Map([["k", null]]));
      `),
      term,
    );
    const node = (...args: unknown[]) => `${formatWithOptions({ colors: true }, ...args)}\n`;
    expect(term.output).toEqual([
      node("%s scored", "Alice", { scores: [98, 87], at: new Date(0) }, 42n),
      node("info"),
      node("debug"),
      node("warn"),
      node(new Map([["k", null]])),
    ]);
    host.forEach((method) => expect(method).not.toHaveBeenCalled());
  });

  // Each row is what Node 26's own console printed, run on a pty and on a pipe in that env.
  it.each<{ env: Record<string, string>; isTTY: boolean; colours: boolean }>([
    { env: { TERM: "dumb" }, isTTY: true, colours: false },
    { env: { TERM: "xterm-256color", NO_COLOR: "1" }, isTTY: true, colours: false },
    { env: { TERM: "xterm-256color", NO_COLOR: "" }, isTTY: true, colours: true },
    { env: { TERM: "xterm-256color", NODE_DISABLE_COLORS: "1" }, isTTY: true, colours: false },
    { env: { TERM: "xterm-256color", FORCE_COLOR: "0" }, isTTY: true, colours: false },
    { env: { TERM: "xterm-256color", FORCE_COLOR: "yes" }, isTTY: true, colours: false },
    { env: { FORCE_COLOR: "1", NO_COLOR: "1" }, isTTY: false, colours: true },
    { env: {}, isTTY: false, colours: false },
  ])("colours the program's console as Node's in $env on a TTY: $isTTY", async ({ env, isTTY, colours }) => {
    const term = { ...terminal(75), env, isTTY };
    await runInTerminal(await bundleExample(`console.log({ n: 1 });`), term);
    expect(term.output).toEqual([`${formatWithOptions({ colors: colours }, { n: 1 })}\n`]);
  });

  it("reads the colour env at each console call, as Node does", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleExample(`console.log({ n: 1 });\nprocess.env.NO_COLOR = "1";\nconsole.log({ n: 1 });`), term);
    expect(term.output).toEqual([true, false].map((colors) => `${formatWithOptions({ colors }, { n: 1 })}\n`));
  });

  it("rejects with the program's own error", async () => {
    await expect(runInTerminal(`throw new RangeError("from the example");`, terminal(75)))
      .rejects.toThrow(new RangeError("from the example"));
  });

  it("hands the terminal its input once, when the program first listens on stdin, and not for one that never does", async () => {
    const listened: number[] = [];
    const counting = (term: TestTerminal): TestTerminal => ({ ...term, onInput: (to) => (listened.push(1), term.onInput(to)) });
    await runInTerminal('process.stdout.write("no keys");', counting(terminal(75)));
    expect(listened).toEqual([]);
    await runInTerminal('process.stdin.on("data", () => {});\nprocess.stdin.prependListener("data", () => {});', counting(terminal(75)));
    expect(listened).toEqual([1]);
  });

  it("runs a NodeTerminalHost program on the terminal, typed keys arriving as stdin data", async () => {
    const term = terminal(75);
    const host = JSON.stringify(resolve(REPO_ROOT, "src/node/terminal-host.ts"));
    await runInTerminal(
      await bundleExample(`
        import { NodeTerminalHost } from ${host};
        const host = new NodeTerminalHost();
        host.setRawMode(true);
        host.onData((chunk) => host.write(\`got \${String(chunk)} at \${host.size().cols}x\${host.size().rows}\`));
      `),
      term,
    );
    term.type("q");
    expect(term.output).toEqual(["got q at 75x24"]);
  });

  it("answers a nodeAsk prompt with the line typed at the terminal, echoed as it is typed", async () => {
    const term = terminal(75);
    const prompt = JSON.stringify(resolve(REPO_ROOT, "src/node/prompt.ts"));
    const run = runInTerminal(
      await bundleExample(`
        import { Console, Prompt } from ${LIBRARY};
        import { nodeAsk } from ${prompt};
        const name = await Prompt.ask("Name?", nodeAsk);
        new Console().print(\`Hello, \${name}!\`);
      `),
      term,
    );
    // Keys typed before the program asks have no listener to reach.
    await vi.waitFor(() => expect(term.output.join("")).toContain("Name?"));
    term.type("Al");
    term.type("\x7f");
    term.type("lice\r");
    await run;
    expect(stripAnsi(term.output.join(""))).toBe("Name?: Al\b \blice\r\nHello, Alice!\n");
  });

  it("hands readline a nodeAsk prompt wider than the terminal as one unbroken line", async () => {
    const term = terminal(10);
    const prompt = JSON.stringify(resolve(REPO_ROOT, "src/node/prompt.ts"));
    const run = runInTerminal(
      await bundleExample(`
        import { Prompt } from ${LIBRARY};
        import { nodeAsk } from ${prompt};
        await Prompt.ask("Pick one please", nodeAsk, { choices: ["a", "b"] });
      `),
      term,
    );
    await vi.waitFor(() => expect(stripAnsi(term.output.join(""))).toContain(": "));
    term.type("a\r");
    await run;
    expect(stripAnsi(term.output.join(""))).toBe("Pick one please [a/b]: a\r\n");
  });

  it("draws a nodeAsk prompt in the terminal's colours, its markup, choices and y/n included", async () => {
    const term = terminal(75);
    const prompt = JSON.stringify(resolve(REPO_ROOT, "src/node/prompt.ts"));
    const run = runInTerminal(
      await bundleExample(`
        import { Confirm, Prompt } from ${LIBRARY};
        import { nodeAsk } from ${prompt};
        await Prompt.ask("[bold cyan]Env[/]", nodeAsk, { choices: ["dev", "prod"] });
        await Confirm.ask("Ship?", nodeAsk);
      `),
      term,
    );
    await vi.waitFor(() => expect(stripAnsi(term.output.join(""))).toContain("Env [dev/prod]: "));
    term.type("dev\r");
    await vi.waitFor(() => expect(stripAnsi(term.output.join(""))).toContain("Ship? [y/n]: "));
    term.type("y\r");
    await run;
    // Each prompt draws as the same prompt written out in markup and printed on a truecolor terminal.
    const draw = (markup: string): string => {
      const chunks: string[] = [];
      const file = { write: (data: string) => (chunks.push(data), true) } as NodeJS.WritableStream;
      new Console({ file, colorSystem: "truecolor", forceTerminal: true, highlight: false }).print(markup, { end: "" });
      return chunks.join("");
    };
    expect(term.output.join("")).toBe(
      `${draw("[bold cyan]Env[/] [bold magenta]\\[dev/prod][/]: ")}dev\r\n${draw("Ship? [bold magenta]\\[y/n][/]: ")}y\r\n`,
    );
  });

  it("draws a nodeAsk prompt with the app's Console, and prints a refused answer's message beside it", async () => {
    const term = terminal(75);
    const prompt = JSON.stringify(resolve(REPO_ROOT, "src/node/prompt.ts"));
    const run = runInTerminal(
      await bundleExample(`
        import { Console, Prompt, Theme } from ${LIBRARY};
        import { nodeAsk } from ${prompt};
        const console = new Console({ colorSystem: "256", theme: new Theme({ "prompt.choices": "green" }) });
        await Prompt.ask("Env", nodeAsk, { choices: ["dev", "prod"], console });
      `),
      term,
    );
    await vi.waitFor(() => expect(stripAnsi(term.output.join(""))).toContain("Env [dev/prod]: "));
    term.type("test\r");
    await vi.waitFor(() => expect(stripAnsi(term.output.join(""))).toMatch(/options\n.*Env \[dev\/prod\]: $/s));
    term.type("dev\r");
    await run;
    const draw = (markup: string): string => {
      const chunks: string[] = [];
      const file = { write: (data: string) => (chunks.push(data), true) };
      new Console({ file, width: 75, colorSystem: "256", forceTerminal: true, highlight: false }).print(markup, { end: "" });
      return chunks.join("");
    };
    const asked = draw("Env [green]\\[dev/prod][/]: ");
    expect(term.output.join("")).toBe(
      `${asked}test\r\n${draw("[red]Please select one of the available options[/]")}\n${asked}dev\r\n`,
    );
  });

  it("hands process.exit to the terminal", async () => {
    const term = terminal(75);
    await runInTerminal(await bundleExample("process.exit(3);"), term);
    expect(term.exits).toEqual([3]);
  });

  it("rejects a program that was not bundled", async () => {
    await expect(runInTerminal(`import { Console } from ${LIBRARY};`, terminal(75)))
      .rejects.toThrow(SyntaxError);
  });
});
