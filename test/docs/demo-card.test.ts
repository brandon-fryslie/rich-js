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
import { DEMO_ENTRY, demoCard, demoProgram } from "../../docs/.vitepress/demo-card.js";
import { programFiles } from "../../docs/.vitepress/example-card.js";
import { EXAMPLE_TERMINAL } from "../../docs/.vitepress/example-terminal.js";
import { liveLibraryOnce } from "../../docs/.vitepress/example-runner.js";
import { decodeProgram } from "../../docs/.vitepress/playground-hash.js";
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { playgroundScript } from "../../docs/.vitepress/theme/playground-program.js";

/** A demo directory holding `files`, by their names from it. */
function demo(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "demo-card-"));
  const directory = path.join(root, "demo");
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    writeFileSync(path.join(directory, name), code);
  }
  return directory;
}

describe("a demo's program", () => {
  it("is its entry, then every file it reaches by a relative import, once each, a file beside its directory included", () => {
    const directory = demo({
      [DEMO_ENTRY]: 'import { run } from "./app.js";\nimport type { Shape } from "./shape.js";\nrun();',
      "app.ts": 'import { fs } from "../_capabilities/fs.js";\nimport "./main.js";\nexport const run = () => fs;',
      "shape.ts": "export interface Shape {}",
      "../_capabilities/fs.ts": 'export * from "./more.js";\nexport const fs = 1;',
      "../_capabilities/more.ts": "export const more = 2;",
      "unused.ts": "export {};",
    });
    expect(demoProgram(directory).files.map((file) => file.name)).toEqual([
      "main.ts",
      "app.ts",
      "../_capabilities/fs.ts",
      "../_capabilities/more.ts",
      "shape.ts",
    ]);
  });

  it("imports a package only from the live library, but for types, which running drops", () => {
    const ok = demo({ [DEMO_ENTRY]: 'import { Console } from "@promptctl/rich-js";\nimport type { save } from "@promptctl/rich-js/node/save";\nnew Console();' });
    expect(demoProgram(ok).files).toHaveLength(1);
    expect(() => demoProgram(demo({ [DEMO_ENTRY]: 'import { saveText } from "@promptctl/rich-js/node/save";' }))).toThrow(
      /a live example cannot import @promptctl\/rich-js\/node\/save/,
    );
    expect(() => demoProgram(demo({ [DEMO_ENTRY]: 'const app = await import("./app.js");' }))).toThrow(/not `import\(\)`/);
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
    await runInTerminal(playgroundScript(programFiles(program), (await liveLibraryOnce()()).script), {
      ...EXAMPLE_TERMINAL,
      write: (chunk) => written.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)),
      onInput: () => {},
      exit: () => {},
    });
    const rows = stripAnsi(written.join("")).split(/\r?\n/);
    expect(rows[0]).toBe("PowerlineJoiner");
    expect(rows).toContain("FlexStrip + gap (tag cloud)");
    // Its last line ends with a line break, so the cursor stands on a row of its own: that row too must fit.
    expect(rows.length).toBeLessThanOrEqual(EXAMPLE_TERMINAL.rows);
  });
});
