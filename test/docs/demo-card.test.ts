/**
 * A demo directory as its page's card: its files, the entry first, as the
 * card runs them, held at build to imports the live library answers; and
 * rich-strip's card program printing, run as the card runs it, the tour
 * `npm run strip` prints. The card in a browser is e2e/demos.spec.ts.
 */
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { CARD_OPTIONS, demoCard, demoProgram, demoTerminal } from "../../docs/.vitepress/demo-card.js";
import { programFiles } from "../../docs/.vitepress/example-card.js";
import { EXAMPLE_TERMINAL } from "../../docs/.vitepress/example-terminal.js";
import { liveLibraryOnce } from "../../docs/.vitepress/example-runner.js";
import { DEMO_ENTRY } from "../../docs/.vitepress/demo-entry.js";
import { decodeProgram } from "../../docs/.vitepress/playground-hash.js";
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { playgroundScript } from "../../docs/.vitepress/theme/playground-program.js";

const library = liveLibraryOnce();

/** A demo directory holding `files`, by their names from it, and a card.json unless they have one. */
function demo(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "demo-card-"));
  const directory = path.join(root, "demo");
  for (const [name, code] of Object.entries({ [CARD_OPTIONS]: '{ "terminal": { "columns": 75, "rows": 24 } }', ...files })) {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    writeFileSync(path.join(directory, name), code);
  }
  return directory;
}

/** `demo`'s program, held to running on the live library. */
const programOf = async (directory: string) => demoProgram(directory, (await library()).script);

describe("a demo's program", { timeout: 60_000 }, () => {
  it("is its entry, then every file it reaches by a relative import, once each, a file beside its directory included", async () => {
    const directory = demo({
      [DEMO_ENTRY]: 'import { run } from "./app.js";\nimport type { Shape } from "./shape.js";\nrun();',
      "app.ts": 'import { fs } from "../_capabilities/fs.js";\nimport "./main.js";\nexport const run = () => fs;',
      "shape.ts": "export interface Shape {}",
      "../_capabilities/fs.ts": 'export * from "./more.js";\nexport const fs = 1;',
      "../_capabilities/more.ts": "export const more = 2;",
      "unused.ts": "export {};",
    });
    expect((await programOf(directory)).files.map((file) => file.name)).toEqual([
      "main.ts",
      "app.ts",
      "../_capabilities/fs.ts",
      "../_capabilities/more.ts",
      "shape.ts",
    ]);
  });

  it("imports a package only from the live library, but for types, which running drops", async () => {
    const ok = demo({ [DEMO_ENTRY]: 'import { Console } from "@promptctl/rich-js";\nimport type { save } from "@promptctl/rich-js/node/save";\nnew Console();' });
    expect((await programOf(ok)).files).toHaveLength(1);
    await expect(programOf(demo({ [DEMO_ENTRY]: 'import { saveText } from "@promptctl/rich-js/node/save";\nsaveText;' }))).rejects.toThrow(
      /demo\/main\.ts: a live example cannot import @promptctl\/rich-js\/node\/save/,
    );
  });

  it("imports by `import()` only a file it also imports by name", async () => {
    await expect(programOf(demo({ [DEMO_ENTRY]: 'const app = await import("./app.js");', "app.ts": "export {};" }))).rejects.toThrow(
      /demo\/main\.ts: a live example cannot import \.\/app\.js; it may import its own files, main\.ts$/,
    );
  });

  it("is refused where the card's compile refuses it, at the file it refuses", async () => {
    const directory = demo({ [DEMO_ENTRY]: 'import "./app.js";', "app.ts": "console.log(import.meta.url);" });
    await expect(programOf(directory)).rejects.toThrow(/demo\/app\.ts: its demo's card runs it, which the browser cannot run: SyntaxError: .*\n {4}at app\.ts/);
  });

  it("refuses a relative import that leaves examples/, naming the file that makes it", async () => {
    await expect(programOf(demo({ [DEMO_ENTRY]: 'import "../../src/index.js";' }))).rejects.toThrow(/main\.ts: \.\.\/\.\.\/src\/index\.js is outside examples\//);
  });
});

describe("a demo's terminal", () => {
  it("is the size its card.json gives", () => {
    expect(demoTerminal(demo({ [CARD_OPTIONS]: '{ "terminal": { "columns": 90, "rows": 28 } }' }))).toEqual({ columns: 90, rows: 28 });
  });

  it.each([
    ["no rows", '{ "terminal": { "columns": 90 } }'],
    ["a fraction", '{ "terminal": { "columns": 90.5, "rows": 28 } }'],
    ["zero", '{ "terminal": { "columns": 0, "rows": 28 } }'],
    ["a string", '{ "terminal": { "columns": "90", "rows": 28 } }'],
    ["no terminal", "{}"],
    ["null", "null"],
    ["malformed JSON", '{ "terminal": { "columns": 90, "rows": 28, } }'],
  ])("is refused naming its card.json when it has %s", (_, json) => {
    expect(() => demoTerminal(demo({ [CARD_OPTIONS]: json }))).toThrow(/demo\/card\.json: must be/);
  });
});

describe("rich-strip's card", { timeout: 60_000 }, () => {
  it("holds main.ts and app.ts as they are on disk, and opens them all in the playground", async () => {
    const card = await demoCard("rich-strip");
    const directory = path.join(REPO_ROOT, "examples", "rich-strip");
    expect(card.program.files.map(({ name, code }) => [name, code])).toEqual(
      ["main.ts", "app.ts"].map((name) => [name, readFileSync(path.join(directory, name), "utf-8")]),
    );
    expect(card.tryIt.playground).toBe("../playground");
    expect(await decodeProgram(card.tryIt.program)).toEqual(card.program);
  });

  it("prints the whole tour on one screen of the card's terminal, as the card runs it", async () => {
    const { program } = await demoCard("rich-strip");
    const written: string[] = [];
    await runInTerminal(playgroundScript(programFiles(program), (await library()).script), {
      ...EXAMPLE_TERMINAL,
      ...program.terminal,
      write: (chunk) => written.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)),
      onInput: () => {},
      exit: () => {},
    });
    const rows = stripAnsi(written.join("")).split(/\r?\n/);
    expect(rows[0]).toBe("PowerlineJoiner");
    expect(rows).toContain("FlexStrip + gap (tag cloud)");
    // Its last line ends with a line break, so the cursor stands on a row of its own: that row too must fit.
    expect(rows.length).toBeLessThanOrEqual(program.terminal.rows);
  });
});

describe("dropdown-demo's card", { timeout: 60_000 }, () => {
  it("holds main.ts and app.ts as they are on disk, in a terminal of its own size", async () => {
    const card = await demoCard("dropdown-demo");
    const directory = path.join(REPO_ROOT, "examples", "dropdown-demo");
    expect(card.program.files.map(({ name, code }) => [name, code])).toEqual(
      ["main.ts", "app.ts"].map((name) => [name, readFileSync(path.join(directory, name), "utf-8")]),
    );
    expect(card.program.terminal).toEqual(demoTerminal(directory));
    // "Open in playground" opens it at that size, not the example terminal's.
    expect(await decodeProgram(card.tryIt.program)).toEqual(card.program);
  });
});
