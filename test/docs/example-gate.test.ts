/**
 * Every docs example shows its real output or says why not, and no output is
 * drawn by hand. The rule is `example-gate.ts`; this is the sweep over
 * `docs/`, and the fixtures that pin each way a page fails it.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";
import { NOT_YET_MIGRATED } from "../../docs/.vitepress/example-runner.js";
import { scanFences } from "../../docs/.vitepress/example-markers.js";
import { pageFindings } from "./example-gate.js";
import { docsPages } from "./pages.js";

const page = (...blocks: string[]) => blocks.join("\n\n");
const fence = (code: string, info = "ts") => `\`\`\`${info}\n${code}\n\`\`\``;

describe("docs/", () => {
  it.each(docsPages().map((p) => [p.file, p.absolutePath] as const))("%s", (file, absolutePath) => {
    expect(pageFindings(file, readFileSync(absolutePath, "utf-8"), NOT_YET_MIGRATED.has(file))).toEqual([]);
  });

  it("lists only pages that exist", () => {
    expect([...NOT_YET_MIGRATED].filter((file) => !existsSync(path.join(REPO_ROOT, "docs", file)))).toEqual([]);
  });
});

describe("a migrated page", () => {
  const PANEL = readFileSync(path.join(REPO_ROOT, "docs", "panel.md"), "utf-8");
  const lines = PANEL.split("\n");
  // Read inside each test: a marker the sweep refuses must fail one row, not the file.
  const first = () => scanFences("panel.md", PANEL)[0]!;

  it("fails at the line of a hand-drawn block put back under an example", () => {
    const { closeLine: closing } = first();
    const edited = [...lines.slice(0, closing), "", "```", "╭──╮", "╰──╯", "```", ...lines.slice(closing)].join("\n");
    expect(pageFindings("panel.md", edited, false)).toEqual([expect.stringMatching(`^docs/panel.md:${closing + 2}: a bare fence is drawn output`)]);
  });

  it("fails at the line of a marker word that is not in the table", () => {
    const { line: opening } = first();
    const edited = lines.map((line, i) => (i === opening - 1 ? `${line} animated` : line)).join("\n");
    expect(() => pageFindings("panel.md", edited, false)).toThrow(`docs/panel.md:${opening}: unknown example marker "animated"`);
  });

  it.each(["text", "txt", "plain", "plaintext", "ansi"])("reads a `%s` block as drawn output", (language) => {
    expect(pageFindings("fixture.md", page("Output:", fence("Hello", language)), false)).toEqual([
      expect.stringMatching(`^docs/fixture.md:3: a \`${language}\` fence is drawn output`),
    ]);
  });

  it("passes a block that names what it holds", () => {
    expect(pageFindings("fixture.md", page(fence("npm install", "sh"), fence('{{ "x" | bold }}', "go-template"), fence("[1]", "json")), false)).toEqual([]);
  });

  it("passes TypeScript, whatever its marker", () => {
    expect(pageFindings("fixture.md", page(fence("1;"), fence("1;", "ts live"), fence("1;", "typescript{2} silent")), false)).toEqual([]);
  });
});

describe("a page on NOT_YET_MIGRATED", () => {
  it("passes while it has a TypeScript fence to migrate", () => {
    expect(pageFindings("fixture.md", page("Prose.", fence("1;")), true)).toEqual([]);
  });

  it("passes while it has drawn output to replace", () => {
    expect(pageFindings("fixture.md", page("Prose.", fence("drawn", "")), true)).toEqual([]);
  });

  it("fails once nothing is left to migrate", () => {
    expect(pageFindings("fixture.md", page("Prose.", fence("npm install", "sh")), true)).toEqual([
      expect.stringMatching(/^docs\/fixture.md: on NOT_YET_MIGRATED with nothing left to migrate/),
    ]);
  });
});
