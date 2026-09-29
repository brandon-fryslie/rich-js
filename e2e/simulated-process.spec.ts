/**
 * The simulated process, run in a real browser page: an example's own
 * `new Console()` writes to the terminal we supply, and the page, which has no
 * `process`, still has none during the run and after it. The same contract in
 * Node is test/docs/simulated-process.test.ts.
 *
 * The page is blank rather than a docs page: this proves the module alone.
 * The docs pages' live terminals, which run it in a worker, have their own
 * proof in e2e/live-examples.spec.ts.
 */
import { test, expect, type Page } from "@playwright/test";
import stripAnsi from "strip-ansi";
import { bundleExample } from "../docs/.vitepress/example-runner.js";
import { REPO_ROOT } from "../test/coverage/extract.js";
import { resolve } from "node:path";

const LIBRARY = JSON.stringify(resolve(REPO_ROOT, "src/index.ts"));

interface Run {
  readonly output: readonly string[];
  readonly before: string;
  readonly during: string;
  readonly after: string;
}

// Exposes one function on the page that runs a program in a 75x24 truecolor
// terminal and reports what it wrote and what `process` looked like to the
// page around it.
const HARNESS = `
import { runInTerminal } from ${JSON.stringify(resolve(REPO_ROOT, "docs/.vitepress/simulated-process.ts"))};
globalThis.runExample = async (program) => {
  const output = [];
  const before = typeof process;
  await runInTerminal(program, {
    columns: 75,
    rows: 24,
    isTTY: true,
    env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
    write: (chunk) => output.push(String(chunk)),
    onInput: () => {},
    exit: () => {},
  });
  return { output, before, during: globalThis.during, after: typeof process };
};
`;

async function runExample(page: Page, entry: string): Promise<Run> {
  const [harness, program] = await Promise.all([
    bundleExample(HARNESS),
    bundleExample(`globalThis.during = typeof globalThis.process;\n${entry}`),
  ]);
  await page.addScriptTag({ content: harness, type: "module" });
  await page.waitForFunction(() => "runExample" in globalThis);
  return page.evaluate(
    (source) => (globalThis as unknown as { runExample(p: string): Promise<Run> }).runExample(source),
    program,
  );
}

test("a new Console() prints a styled Table into the page's terminal", async ({ page }) => {
  const run = await runExample(
    page,
    `
    import { Console, Table } from ${LIBRARY};
    const console = new Console();
    const table = new Table({ title: "Planets", expand: true });
    table.addColumn("Planet");
    table.addRow("[bold #ff8800]Earth[/]");
    console.print(table);
    `,
  );

  const written = run.output.join("");
  expect(written).toContain("\x1b[1;38;2;255;136;0mEarth");
  const lines = stripAnsi(written).split("\n").filter((line) => line !== "");
  expect(lines.length).toBeGreaterThan(3);
  for (const line of lines) expect(line).toHaveLength(75);
  expect([run.before, run.during, run.after]).toEqual(["undefined", "undefined", "undefined"]);
});

test("a Progress with no console animates into the page's terminal", async ({ page }) => {
  const run = await runExample(
    page,
    `
    import { Progress } from ${LIBRARY};
    const progress = new Progress({ refreshPerSecond: 50 });
    const task = progress.addTask("Copying", { total: 10 });
    progress.start();
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      progress.updateTask(task, { advance: 1 });
    }
    progress.stop();
    `,
  );

  const frames = run.output.filter((chunk) => chunk.includes("Copying"));
  expect(frames.length).toBeGreaterThan(2);
  expect(run.output.join("")).toMatch(/\x1b\[\d*A/);
  expect(stripAnsi(frames.at(-1) ?? "")).toContain("100%");
  expect(run.after).toBe("undefined");
});
