/// <reference lib="dom" />
/**
 * A visitor's TypeScript, run in a real browser the way the playground runs
 * it: turned into a script (playground-program.ts) and run by a live terminal
 * (live-terminal.ts) in a worker inside a sandboxed frame. What the terminal
 * shows is read from xterm's rows.
 *
 * The page is blank rather than a docs page: this proves the runner alone,
 * with the library and the worker's script built from this checkout. The same
 * programs in Node are test/docs/playground-program.test.ts.
 */
import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { bundleExample, bundleLiveRuntime, liveLibraryOnce } from "../docs/.vitepress/example-runner.js";
import { REPO_ROOT } from "../scripts/repo-facts.js";

const from = (file: string) => JSON.stringify(resolve(REPO_ROOT, file));

// Exposes `play(source)` and `stop()` on the page, over one live terminal in
// the docs examples' terminal and dark theme. The terminal's state is on its
// element as `data-state`.
const HARNESS = `
import { LiveTerminal } from ${from("docs/.vitepress/theme/live-terminal.ts")};
import { playgroundScript } from ${from("docs/.vitepress/theme/playground-program.ts")};
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from ${from("docs/.vitepress/example-terminal.ts")};
globalThis.start = async (runtime, library) => {
  const element = Object.assign(document.createElement("div"), { id: "terminal" });
  document.body.append(element);
  const live = await LiveTerminal.create(element, {
    runtime,
    terminal: EXAMPLE_TERMINAL,
    theme: EXAMPLE_THEMES.dark,
    font: { family: "monospace", size: 14, lineHeight: 1.2 },
  });
  live.onState((state) => (element.dataset.state = state.kind));
  globalThis.play = (source) => live.run(playgroundScript(source, library), "live");
  globalThis.stop = () => live.stop();
};
`;

interface Harness {
  start(runtime: string, library: string): Promise<void>;
  play(source: string): void;
  stop(): void;
}

let built: Promise<{ readonly harness: string; readonly runtime: string; readonly library: string }> | undefined;
const build = () =>
  (built ??= Promise.all([bundleExample(HARNESS), bundleLiveRuntime(), liveLibraryOnce()()]).then(([harness, runtime, library]) => ({
    harness,
    runtime: runtime.code,
    library: library.script,
  })));

/** A blank page, wearing `head` if given, with a terminal on it, and every error the page itself raised. */
async function open(page: Page, head = ""): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(`<!doctype html><head>${head}</head><body></body>`);
  const { harness, runtime, library } = await build();
  await page.addScriptTag({ content: harness, type: "module" });
  await page.waitForFunction(() => "start" in globalThis);
  await page.evaluate(([r, l]) => (globalThis as unknown as Harness).start(r, l), [runtime, library] as const);
  return errors;
}

const play = (page: Page, source: string) => page.evaluate((s) => (globalThis as unknown as Harness).play(s), source);
// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
const rows = async (page: Page) => (await page.locator("#terminal .xterm-rows").innerText()).replaceAll(" ", " ");
const state = (page: Page) => page.locator("#terminal");

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await build();
});

test("a Table prints in colour", async ({ page }) => {
  const errors = await open(page);
  await play(
    page,
    [
      'import { Console, Table } from "@promptctl/rich-js";',
      'const table = new Table({ title: "Planets" });',
      'table.addColumn("Name", { style: "bold magenta" });',
      'table.addRow("Mercury");',
      "new Console().print(table);",
    ].join("\n"),
  );
  await expect.poll(() => rows(page)).toContain("Mercury");
  expect(await rows(page)).toContain("Planets");
  // A cell drawn in a colour of its own, not the terminal's foreground.
  await expect(page.locator("#terminal .xterm-rows span", { hasText: "Mercury" })).toHaveAttribute("class", /\bxterm-fg-\d+/);
  expect(errors).toEqual([]);
});

test("a Progress animates", async ({ page }) => {
  const errors = await open(page);
  await play(
    page,
    [
      'import { Progress } from "@promptctl/rich-js";',
      "const progress = new Progress();",
      "progress.start();",
      'const task = progress.addTask("Working", { total: 100 });',
      "for (let i = 0; i < 100; i++) {",
      "  progress.updateTask(task, { advance: 1 });",
      "  await new Promise((resolve) => setTimeout(resolve, 50));",
      "}",
      "progress.stop();",
    ].join("\n"),
  );
  const percent = async () => Number(/(\d+)%/.exec(await rows(page))?.[1] ?? NaN);
  let early = NaN;
  await expect.poll(async () => (early = await percent())).toBeLessThan(100);
  await expect.poll(percent).toBeGreaterThan(early);
  expect(errors).toEqual([]);
});

test("a Button responds to keys", async ({ page }) => {
  const errors = await open(page);
  await play(
    page,
    [
      'import { Button, WidgetApp } from "@promptctl/rich-js/widgets";',
      'import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";',
      'const button = new Button({ label: "Launch" });',
      "const app = new WidgetApp({ host: new NodeTerminalHost(), surface: \"inline\", view: () => button });",
      "button.onSubmit(() => app.stop());",
      "await app.run();",
      'process.stdout.write("launched\\n");',
    ].join("\n"),
  );
  await expect.poll(() => rows(page)).toContain("Launch");
  await page.locator("#terminal textarea").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => rows(page)).toContain("launched");
  expect(errors).toEqual([]);
});

test("a syntax error reports its line", async ({ page }) => {
  await open(page);
  await play(page, 'const planet = "Mercury";\nconst orbit: number = ;\n');
  await expect.poll(() => rows(page)).toContain("Uncaught SyntaxError");
  expect(await rows(page)).toContain("at playground.ts:2:");
  await expect(state(page)).toHaveAttribute("data-state", "exited");
});

test("a thrown error reports its line, the one it was thrown on first", async ({ page }) => {
  await open(page);
  await play(page, 'const planet = "Mercury";\n\nfunction orbit(): never {\n  throw new Error("lost in space");\n}\norbit();\n');
  await expect.poll(() => rows(page)).toContain("Uncaught Error: lost in space");
  expect([...(await rows(page)).matchAll(/playground\.ts:(\d+):/g)].map((m) => m[1])).toEqual(["4", "6"]);
});

test("an error thrown from a timer, after the body is done, reports its line", async ({ page }) => {
  await open(page);
  await play(page, 'setTimeout(() => {\n  throw new RangeError("too far");\n}, 10);\n');
  await expect.poll(() => rows(page)).toContain("Uncaught RangeError: too far");
  expect(await rows(page)).toContain("playground.ts:2:");
});

test("a program that never finishes can be stopped, and the page stays responsive while it runs", async ({ page }) => {
  const errors = await open(page);
  const cdp = await page.context().newCDPSession(page);
  const workers = async () => (await cdp.send("Target.getTargets")).targetInfos.filter((t) => t.type === "worker").length;
  await play(page, 'process.stdout.write("spinning");\nwhile (true) {}\n');
  await expect.poll(() => rows(page)).toContain("spinning");
  await expect.poll(workers).toBe(1);
  // The page still runs a timer on time, and still takes keys.
  const late = await page.evaluate(() => {
    const at = performance.now();
    return new Promise<number>((done) => setTimeout(() => done(performance.now() - at - 50), 50));
  });
  expect(late).toBeLessThan(100);
  await page.locator("#terminal textarea").focus();
  await page.keyboard.type("q");
  await page.evaluate(() => (globalThis as unknown as Harness).stop());
  await expect(state(page)).toHaveAttribute("data-state", "stopped");
  await expect.poll(workers).toBe(0);
  expect(errors).toEqual([]);
});

test("the program can neither read nor reach the page: it has no document and no origin", async ({ page }) => {
  await open(page);
  await play(page, "process.stdout.write(`document=${typeof document} storage=${typeof localStorage} origin=${self.origin}`);");
  await expect.poll(() => rows(page)).toContain("document=undefined storage=undefined origin=null");
});

test("a worker the frame cannot start ends the run with a report, rather than leaving it running", async ({ page }) => {
  // The frame inherits the page's policy, so this refuses it a worker as an
  // engine that denies an opaque origin one would.
  const errors = await open(page, `<meta http-equiv="Content-Security-Policy" content="worker-src 'none'">`);
  await play(page, 'process.stdout.write("never");');
  await expect(state(page)).toHaveAttribute("data-state", "exited");
  // The state changes as the report is written; xterm draws the write a moment later.
  await expect.poll(() => rows(page)).toMatch(/The live terminal's worker did not (load|start)/);
  expect(errors).toEqual([]);
});
