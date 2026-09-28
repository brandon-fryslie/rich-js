/**
 * The build step that runs a docs page's examples: what a page's markdown
 * becomes, and every way a page can fail the build.
 *
 * [LAW:behavior-not-structure] Markdown in, markdown out, or an error naming
 * the page and line. Nothing here reads the generated program.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";
import {
  ExampleCompiler,
  LIVE_MODULE_PREFIX,
  NOT_YET_MIGRATED,
  docsExamplesPlugin,
  runPageExamples,
} from "../../docs/.vitepress/example-runner.js";
import { scanFences } from "../../docs/.vitepress/example-markers.js";
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { EXAMPLE_TERMINAL } from "../../docs/.vitepress/example-terminal.js";

const compiler = new ExampleCompiler();
const runPage = (markdown: string, page = "fixture.md") => runPageExamples(compiler, page, markdown);
const run = async (markdown: string, page = "fixture.md") => (await runPage(markdown, page)).markdown;

/** What a live program writes, run to the end of its body in the example terminal. */
async function liveOutput(script: string): Promise<string> {
  const output: string[] = [];
  await runInTerminal(script, { ...EXAMPLE_TERMINAL, write: (chunk) => output.push(String(chunk)), onInput: () => {}, exit: () => {} });
  return output.join("");
}
const PANEL = readFileSync(path.join(REPO_ROOT, "docs", "panel.md"), "utf-8");

const page = (...blocks: string[]) => blocks.join("\n\n");
const fence = (code: string, info = "ts") => `\`\`\`${info}\n${code}\n\`\`\``;

/** The output wrappers the run wrote, in page order. */
const outputs = (markdown: string) => [...markdown.matchAll(/<div class="rich-example-output"[^\n]*<\/div>/g)].map((m) => m[0]);

describe("docs/panel.md", { timeout: 60_000 }, () => {
  it("carries a light and a dark fragment under every example", async () => {
    const result = await run(PANEL, "panel.md");
    const shown = outputs(result);
    expect(shown).toHaveLength(scanFences("panel.md", PANEL).length);
    for (const html of shown) {
      expect(html).toMatch(/<div class="rich-example-light" v-pre><pre style="[^"]*background:#fafafa/);
      expect(html).toMatch(/<div class="rich-example-dark" v-pre><pre style="[^"]*background:#282c34/);
    }
    const unwrapped = result
      .replace(/\n<div class="rich-example">\n\n/g, "")
      .replace(/\n\n<div class="rich-example-output"[^\n]*<\/div>\n\n<\/div>\n/g, "");
    expect(unwrapped).toBe(PANEL);
  });

  it("fails naming panel.md and the line of an example that throws", async () => {
    const edited = PANEL.replace('console.print(Panel.fit("Short content"));', 'throw new Error("edited");');
    const fenceLine = scanFences("panel.md", edited).find((f) => f.code.includes("edited"))!.line;
    await expect(run(edited, "panel.md")).rejects.toThrow(`docs/panel.md:${fenceLine}: the example threw Error: edited`);
  });

  it("is byte-identical across runs, and blind to the build machine's terminal", async () => {
    const first = await run(PANEL, "panel.md");
    expect(await run(PANEL, "panel.md")).toBe(first);
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("COLUMNS", "40");
    vi.stubEnv("FORCE_COLOR", "0");
    expect(await run(PANEL, "panel.md")).toBe(first);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

describe("the example widget", { timeout: 30_000 }, () => {
  // The fence stays a fence for VitePress to highlight; the widget is the
  // element around it and the output panel under it, each between blank lines
  // so markdown still parses the fence and the prose after it.
  it("puts the fence and its output in one element, the output labelled with where it came from", async () => {
    const result = await run(`Before.\n${fence("console.print(1);")}\nAfter.`);
    expect(result).toMatch(
      /^Before\.\n\n<div class="rich-example">\n\n```ts\nconsole\.print\(1\);\n```\n\n<div class="rich-example-output">[^\n]*<\/div>\n\n<\/div>\n\nAfter\.$/,
    );
    const [shown] = outputs(result);
    expect(shown).toContain('<span class="rich-example-name">Output</span><span class="rich-example-caption">produced by running the code above</span>');
  });
});

describe("one page, one program", { timeout: 30_000 }, () => {
  it("assumes console and the main barrel, and lets a block redeclare console", async () => {
    const result = await run(
      page(fence('console.print(new Rule("one"));'), fence("const console = new Console({ width: 20 });\nconsole.print(new Rule());")),
    );
    const [first, second] = outputs(result);
    expect(first).toContain("one");
    // 20 cells of rule in each of the two fragments.
    expect(second!.match(/─/g)).toHaveLength(40);
  });

  it("lets a block see what the blocks above it declared", async () => {
    const result = await run(page(fence('const title = "shared";', "ts silent"), fence("console.print(title);")));
    expect(outputs(result)[1]).toContain("shared");
  });

  it("reads the page's exampleContext, which may not print", async () => {
    const context = ["---", "exampleContext: |", "  const items = [\"a\", \"b\"];", "---", ""].join("\n");
    expect(outputs(await run(context + fence('console.print(items.join("+"));')))[0]).toContain("a+b");
    const noisy = ["---", "exampleContext: |", '  console.print("hi");', "---", ""].join("\n");
    await expect(run(noisy + fence('console.print("x");'))).rejects.toThrow(/exampleContext wrote/);
  });

  it("lets the exampleContext redeclare console for every block below it", async () => {
    const context = ["---", "exampleContext: |", "  const console = new Console({ width: 20 });", "---", ""].join("\n");
    expect(outputs(await run(context + fence("console.print(new Rule());")))[0]!.match(/─/g)).toHaveLength(40);
  });

  it("blames the exampleContext, not the first block, when the context throws", async () => {
    const context = ["---", "exampleContext: |", '  console.print("half");', '  throw new Error("ctx");', "---", ""].join("\n");
    await expect(run(context + fence('console.print("x");'))).rejects.toThrow("docs/fixture.md:3 (exampleContext): the example threw Error: ctx");
  });

  it("shows a thrown value the way Node reports it, an empty one included", async () => {
    const shown = outputs(await run(page(fence('throw "";', "ts throws"), fence("throw new RangeError();", "ts throws"))));
    expect(shown[0]).toContain(`Uncaught ""`);
    expect(shown[1]).toMatch(/>RangeError(&#10;)*</);
  });

  it("merges a type import and a value import of one export, from any entry point", async () => {
    const shown = outputs(
      await run(
        page(
          fence('import { BrowserTerminalHost } from "@promptctl/rich-js/host";\nconsole.print(typeof BrowserTerminalHost);'),
          fence('import type { BrowserTerminalHost } from "@promptctl/rich-js/host";\nconst host: BrowserTerminalHost | null = null;\nconsole.print(String(host));'),
        ),
      ),
    );
    expect(shown[0]).toContain("function");
    expect(shown[1]).toContain("null");
  });

  it("decodes a character whose bytes arrive in two writes", async () => {
    const shown = outputs(await run(fence("process.stdout.write(new Uint8Array([0xe2, 0x94]));\nprocess.stdout.write(new Uint8Array([0x80]));")))[0]!;
    expect(shown).toContain("─");
    expect(shown).not.toContain("\uFFFD");
  });

  it("assumes the main barrel's types as well as its values", async () => {
    const shown = outputs(await run(fence("const width = (options: RenderOptions) => options.maxWidth;\nconsole.print(String(typeof width));")))[0]!;
    expect(shown).toContain("function");
  });

  it("lets a block import a barrel type it also uses as a value", async () => {
    const shown = outputs(
      await run(fence('import type { Console } from "@promptctl/rich-js";\nconst c: Console = new Console({ width: 20 });\nc.print("typed");')),
    )[0]!;
    expect(shown).toContain("typed");
  });

  it("lets a static block print a hyperlink", async () => {
    expect(outputs(await run(fence('console.print("[link=https://example.com]site[/link]");')))[0]).toContain("site");
  });

  it("leaves prose written straight under a fence to markdown", async () => {
    const result = await run(`${fence('console.print("x");')}\n**after**`);
    expect(result).toMatch(/<\/div>\n\n\*\*after\*\*$/);
  });

  it("shows a silent block's note in place of output", async () => {
    const shown = outputs(await run(page(fence("const a = 1;", "ts silent"), fence("console.print(a);"))))[0]!;
    expect(shown).toContain("This example prints nothing when it runs.");
    expect(shown).not.toContain("<pre");
  });

  it("shows a throws block's output, then the error, and keeps its names to itself", async () => {
    const shown = outputs(await run(page(fence('console.print("before");\nthrow new RangeError("nope");', "ts throws"))))[0]!;
    expect(shown).toContain("before");
    expect(shown).toContain("RangeError: nope");
    await expect(
      run(page(fence("const hidden = 1;\nthrow new Error();", "ts throws"), fence("console.print(hidden);"))),
    ).rejects.toThrow(/fixture\.md:\d+: Cannot find name 'hidden'/);
  });

  it("shows the reader the note for a block it does not run, and runs nothing for it", async () => {
    const shown = outputs(await run(page(fence("process.exit(1);", "ts node"), fence("interface X { y(): void }", "ts shape"))));
    expect(shown[0]).toContain("It needs a real Node process");
    expect(shown[1]).toContain("This is a shape to implement");
    for (const html of shown) {
      expect(html).toContain('<span class="rich-example-name">Not run</span>');
      expect(html).not.toContain("rich-example-caption");
    }
  });

});

describe("a live block", { timeout: 30_000 }, () => {
  it("shows a live terminal under its code, loading the block's own program only when asked", async () => {
    const result = await runPage(`# t\n\n${fence('console.print("live");', "ts live")}`);
    const [program] = result.live;
    const binding = `__richLive_${program!.id}`;
    expect(result.live).toHaveLength(1);
    expect(result.markdown).toContain(`<script setup>\nconst ${binding} = () => import("${LIVE_MODULE_PREFIX}${program!.id}");\n</script>`);
    const [shown] = outputs(result.markdown);
    expect(shown).toContain('<span class="rich-example-name">Live</span>');
    expect(shown).toContain(`<RichLive :load="${binding}" />`);
    expect(await liveOutput(program!.script)).toContain("live");
  });

  it("is its block alone under the page's context, and writes only what the block writes", async () => {
    const context = ["---", "exampleContext: |", '  const who = "context";', "---", ""].join("\n");
    const result = await runPage(context + page(fence('const above = "above";', "ts silent"), fence("console.print(who);", "ts live")));
    const written = await liveOutput(result.live[0]!.script);
    expect(written).toContain("context");
    expect(written).not.toContain("rich-example");
    await expect(run(context + page(fence('const above = "above";', "ts silent"), fence("console.print(above);", "ts live")))).rejects.toThrow(
      /fixture\.md:\d+: Cannot find name 'above'/,
    );
  });

  it("shares one module with an identical block", async () => {
    const result = await runPage(page(fence("console.print(1);", "ts live"), fence("console.print(1);", "ts live")));
    expect(result.live).toHaveLength(1);
    expect(result.markdown.match(/import\(/g)).toHaveLength(1);
  });
});

describe("a page that breaks its contract fails the build", { timeout: 30_000 }, () => {
  const failures: [string, string, RegExp][] = [
    ["a type error, at its page line", page("# t", fence('const n: number = "x";')), /fixture\.md:4: Type 'string' is not assignable/],
    ["a silent block that writes", fence('console.print("x");', "ts silent"), /fixture\.md:1: marked `silent` but wrote/],
    ["a static block that writes nothing", fence("const n = 1;"), /fixture\.md:1: writes nothing; mark it `silent`/],
    ["a throws block that returns", fence("const n = 1;", "ts throws"), /fixture\.md:1: marked `throws` but returned normally/],
    ["a cursor escape", fence('process.stdout.write("\\x1b[2J");'), /fixture\.md:1: writes the escape .* mark it `live`/],
    // csstype carries types and no JavaScript: it type-checks and cannot be bundled.
    ["an import that type-checks and does not bundle", fence('import * as css from "csstype";\nconsole.print(typeof css);'), /^docs\/fixture\.md: bundling failed: /],
    ["an unknown marker", fence("1;", "ts loud"), /fixture\.md:1: unknown example marker "loud"/],
    ["a build block that exits", fence("process.exit(2);", "ts silent"), /fixture\.md:1: the example threw Error: calls process\.exit\(2\)/],
    [
      "a live block on a page with its own <script setup>",
      page("<script setup>\nconst n = 1;\n</script>", fence("console.print(1);", "ts live")),
      /fixture\.md:1: a page with a live example cannot have its own <script setup>/,
    ],
    [
      "an exampleContext whose code is not indented",
      ["---", "exampleContext: |", "const items = [];", "---", fence("console.print(1);")].join("\n"),
      /fixture\.md:3: exampleContext is empty; its code must be indented/,
    ],
    [
      "two imports binding one name differently",
      page(fence('import { Panel as P } from "@promptctl/rich-js";\nconsole.print(P.fit("a"));'), fence('import { Rule as P } from "@promptctl/rich-js";\nconsole.print(new P());')),
      /fixture\.md:7: imports P, which docs\/fixture\.md:2 already imports differently/,
    ],
    [
      "a barrel type import and another import binding the same name",
      page(fence('import type { Panel } from "@promptctl/rich-js";\nconsole.print(Panel.fit("a") satisfies Panel);'), fence('import { Rule as Panel } from "@promptctl/rich-js";\nconsole.print(new Panel());')),
      /fixture\.md:7: imports Panel, which docs\/fixture\.md:2 already imports differently/,
    ],
    [
      "a run that never finishes, at the block it waits in",
      page(fence('console.print("first");'), fence("await new Promise(() => {});\nconsole.print(1);")),
      /fixture\.md:5: the example did not finish within 5 s; mark it `live`/,
    ],
    // Every name a default-plus-named import binds is the page's, so the
    // prelude does not import `Panel` a second time: the one error is the page's.
    [
      "a default import the barrel does not have, and nothing blamed on generated code",
      fence('import Rich, { Panel } from "@promptctl/rich-js";\nconsole.print(Panel.fit(String(Rich)));'),
      /^docs example does not compile:\ndocs\/fixture\.md:2: [^\n]*has no default export[^\n]*$/,
    ],
  ];
  for (const [what, markdown, message] of failures) {
    it(what, async () => {
      await expect(run(markdown)).rejects.toThrow(message);
    });
  }
});

describe("the plugin", () => {
  // VitePress builds server then client, and both pass every page through the
  // transform. A page whose output differs on every run shows whether it ran twice.
  it("runs a page once per source, and again when the source changes", { timeout: 60_000 }, async () => {
    const plugin = docsExamplesPlugin();
    const id = path.join(REPO_ROOT, "docs", "fixture-runs-once.md");
    const markdown = fence("console.print(String(Math.random()));");
    const first = await plugin.transform(markdown, id);
    expect(await plugin.transform(markdown, id)).toEqual(first);
    expect(await plugin.transform(`${markdown}\n`, id)).not.toEqual(first);
  });

  it("runs a page again when src/ changes under it", { timeout: 60_000 }, async () => {
    let edits = 0;
    const plugin = docsExamplesPlugin(() => String(edits));
    const id = path.join(REPO_ROOT, "docs", "fixture-src-edit.md");
    const markdown = fence("console.print(String(Math.random()));");
    const first = await plugin.transform(markdown, id);
    expect(await plugin.transform(markdown, id)).toEqual(first);
    edits += 1;
    expect(await plugin.transform(markdown, id)).not.toEqual(first);
  });

  it("serves a page's live programs as the modules its script imports", { timeout: 60_000 }, async () => {
    const plugin = docsExamplesPlugin();
    const transformed = await plugin.transform(fence('console.print("served");', "ts live"), path.join(REPO_ROOT, "docs", "fixture-live.md"));
    const [specifier] = /virtual:rich-live\/[0-9a-f]+/.exec(transformed!.code)!;
    const resolved = plugin.resolveId(specifier)!;
    const module = plugin.load(resolved)!;
    expect(await liveOutput(JSON.parse(module.replace(/^export default /, "").replace(/;$/, "")) as string)).toContain("served");
    expect(plugin.resolveId("./elsewhere.js")).toBeNull();
    expect(() => plugin.load(`\0${LIVE_MODULE_PREFIX}0000`)).toThrow(/no page run produced this live program/);
  });

  it("passes a page that has not migrated through untouched", async () => {
    const [unmigrated] = NOT_YET_MIGRATED;
    const source = readFileSync(path.join(REPO_ROOT, "docs", unmigrated!), "utf-8");
    expect(await docsExamplesPlugin().transform(source, path.join(REPO_ROOT, "docs", unmigrated!))).toBeNull();
  });
});
