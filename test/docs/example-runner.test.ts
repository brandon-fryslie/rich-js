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
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import {
  ExampleCompiler,
  LIVE_MODULE_PREFIX,
  LIVE_RUNTIME_MODULE,
  PLAYGROUND_MODULE,
  PLAYGROUND_START_PAGE,
  SHOWCASE_FILE,
  SHOWCASE_MODULE,
  type LoadContext,
  docsExamplesPlugin,
  liveLibraryOnce,
  liveScript,
  playgroundStart,
  runPageExamples,
} from "../../docs/.vitepress/example-runner.js";
import { PAGE_PARSER, scanFences } from "../../docs/.vitepress/example-markers.js";
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { decodeProgram } from "../../docs/.vitepress/playground-hash.js";
import { EXAMPLE_TERMINAL } from "../../docs/.vitepress/example-terminal.js";

const compiler = new ExampleCompiler();
const library = liveLibraryOnce();
const runPage = (markdown: string, page = "fixture.md") => runPageExamples(compiler, page, markdown, library);
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
    const edited = PANEL.replace(/console\.print\(Panel\.fit\([^\n]*\);/, 'throw new Error("edited");');
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
      /^Before\.\n\n<div class="rich-example">\n\n```ts\nconsole\.print\(1\);\n```\n\n<div class="rich-example-output"[^>\n]*>[^\n]*<\/div>\n\n<\/div>\n\nAfter\.$/,
    );
    const [shown] = outputs(result);
    expect(shown).toContain('<span class="rich-example-name">Output</span><span class="rich-example-caption">produced by running the code above</span>');
  });

  // custom.css shrinks an output's font to fit its card by this count, so a
  // short output keeps the code size however narrow the card.
  it("says how many columns its output draws: a static one its widest row, a live one the terminal", async () => {
    const [short] = outputs(await run(fence('console.print("ab\\nabcd");')));
    expect(short).toMatch(/^<div class="rich-example-output" style="--rich-example-columns:4">/);
    const [live] = outputs((await runPage(`# t\n\n${fence('console.print("live");', "ts live")}`)).markdown);
    expect(live).toMatch(new RegExp(`^<div class="rich-example-output" style="--rich-example-columns:${EXAMPLE_TERMINAL.columns}">`));
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

  it("type-checks a block it does not run as its block alone under the page's context", async () => {
    const context = ["---", "exampleContext: |", '  const items = ["a"];', "---", ""].join("\n");
    const above = fence('const mine = "static";\nconsole.print(mine);');
    await run(context + page(above, fence("console.print(items.length);", "ts node")));
    await expect(run(context + page(above, fence("console.print(mine);", "ts shape")))).rejects.toThrow(/fixture\.md:11: Cannot find name 'mine'/);
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
    expect(await liveOutput(liveScript(program!))).toContain("live");
  });

  it("is its block alone under the page's context, and writes only what the block writes", async () => {
    const context = ["---", "exampleContext: |", '  const who = "context";', "---", ""].join("\n");
    const result = await runPage(context + page(fence('const above = "above";', "ts silent"), fence("console.print(who);", "ts live")));
    const written = await liveOutput(liveScript(result.live[0]!));
    expect(written).toContain("context");
    expect(written).not.toContain("rich-example");
    await expect(run(context + page(fence('const above = "above";', "ts silent"), fence("console.print(above);", "ts live")))).rejects.toThrow(
      /fixture\.md:\d+: Cannot find name 'above'/,
    );
  });

  it.each([
    ["list item", ["- Run it:", "", "  ```ts", '  console.print("x");', "  ```"], 3],
    ["blockquote", ["> ```ts", '> console.print("x");', "> ```"], 1],
    ["::: code-group", ["::: code-group", "", "```ts [a.ts]", 'console.print("x");', "```", "", ":::"], 3],
    ["::: v-pre", ["::: v-pre", "", "```ts live", 'console.print("x");', "```", "", ":::"], 3],
  ])("refuses an example inside a %s, naming its line", async (enclosure, lines, line) => {
    await expect(run(lines.join("\n"))).rejects.toThrow(`docs/fixture.md:${line}: an example inside a ${enclosure} cannot carry its output`);
  });

  it("puts the card of an example in a ::: container inside that container", async () => {
    const result = await run(["::: tip Placement", "", fence('console.print("x");'), "", ":::"].join("\n"));
    const cards = PAGE_PARSER.parse(result, {}).filter((t) => t.type === "html_block" && t.content.includes("rich-example"));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.map((t) => t.level)).toEqual(cards.map(() => 1));
  });

  it("is not refused for a <script setup> shown in a fence", async () => {
    const result = await runPage(page(fence('<script setup lang="ts">\n</script>', "vue"), fence("console.print(1);", "ts live")));
    expect(result.live).toHaveLength(1);
  });

  // Each program carries its own code; the library it runs on is bundled once
  // for the site and shared, so a page of live examples does not download the
  // library once per example.
  it("shares one library between blocks, and keeps it out of each block", async () => {
    const result = await runPage(page(fence('console.print("one");', "ts live"), fence('console.print("two");', "ts live")));
    const [one, two] = result.live;
    expect(one!.library).toBe(two!.library);
    for (const program of result.live) expect(program.block.length).toBeLessThan(one!.library.script.length / 50);
    expect(await liveOutput(liveScript(two!))).toContain("two");
  });

  it("runs a block importing another entry point, or a peer, on the same library", async () => {
    const widgets = 'import { Checkbox } from "@promptctl/rich-js/widgets";\nimport { observable } from "mobx";\nconsole.print(typeof Checkbox, typeof observable);';
    const result = await runPage(page(fence('console.print("main");', "ts live"), fence(widgets, "ts live")));
    const [main, other] = result.live;
    expect(main!.library).toBe(other!.library);
    // One mobx, the library's: the block carries none of its own.
    expect(other!.block.length).toBeLessThan(2_000);
    expect(await liveOutput(liveScript(other!))).toContain("function function");
  });

  it("refuses a block that imports with import(), which a live program cannot run", async () => {
    const dynamic = 'const { Panel } = await import("@promptctl/rich-js");\nconsole.print(new Panel("x"));';
    await expect(runPage(page("# t", fence(dynamic, "ts live")))).rejects.toThrow(/fixture\.md:3: a live example imports only with `import` declarations/);
  });

  // A file past the entry points, and an entry point the worker cannot run.
  it.each(["renderables/panel", "node/save"])("refuses a block importing src/%s.ts, which the library does not hold", async (file) => {
    const deep = `import * as m from "../src/${file}.js";\nconsole.print(Object.keys(m));`;
    await expect(runPage(page("# t", fence(deep, "ts live")))).rejects.toThrow(
      new RegExp(`fixture\\.md:3: bundling failed: .*imports src/${file}\\.ts, which the live library does not hold; .*through src/index\\.ts(?!.*node/save)`, "s"),
    );
  });

  it("shares one module with an identical block", async () => {
    const result = await runPage(page(fence("console.print(1);", "ts live"), fence("console.print(1);", "ts live")));
    expect(result.live).toHaveLength(1);
    expect(result.markdown.match(/import\(/g)).toHaveLength(1);
  });
});

/** The program each "Try it" link on the page opens, in page order, and the address before its hash. */
async function tried(markdown: string): Promise<{ href: string; program: string }[]> {
  const links = [...markdown.matchAll(/<a class="rich-example-try" href="([^"#]*)#([^"]+)">Try it<\/a>/g)];
  return Promise.all(links.map(async ([, href, hash]) => ({ href: href!, program: await decodeProgram(hash!) })));
}

describe("Try it", { timeout: 30_000 }, () => {
  it("opens every block that runs as the block, under what it names from above it", async () => {
    const result = await run(page(fence('const title = "shared";\nconsole.print("first");'), fence("console.print(title);")));
    const [first, second] = await tried(result);
    expect(first!.program).toBe(['import { Console } from "@promptctl/rich-js";', "", "const console = new Console();", "", 'const title = "shared";\nconsole.print("first");'].join("\n"));
    // What the first block printed is not the second's to print again.
    expect(second!.program).toBe(['import { Console } from "@promptctl/rich-js";', "", "const console = new Console();", "", 'const title = "shared";', "", "console.print(title);"].join("\n"));
    expect(outputs(result)[1]).toContain('<a class="rich-example-try" href="playground#');
  });

  it("opens docs/panel.md's blocks naming only what each uses, a block that imports keeping its own imports", async () => {
    const blocks = scanFences("panel.md", PANEL);
    const [first, second] = await tried(await run(PANEL, "panel.md"));
    expect(first!.program).toBe(blocks[0]!.code);
    expect(second!.program).toBe(['import { Console, Panel } from "@promptctl/rich-js";', "", "const console = new Console();", "", blocks[1]!.code].join("\n"));
  });

  it("carries a statement above the block that changes what the block prints", async () => {
    const [, , third] = await tried(
      await run(page(fence('const table = new Table();\ntable.addColumn("name");', "ts silent"), fence('table.addRow("ada");\nconsole.print("rows");'), fence("console.print(table);"))),
    );
    expect(third!.program).toContain('table.addColumn("name");');
    expect(third!.program).toContain('table.addRow("ada");');
    expect(third!.program).not.toContain('console.print("rows");');
  });

  it("carries the page's context whole, a helper's changes included", async () => {
    const context = ["---", "exampleContext: |", "  const rows: string[] = [];", "  const add = (row: string) => rows.push(row);", '  add("q");', '  const unused = "n";', "---", ""].join("\n");
    const [only] = await tried(await run(context + fence('console.print(rows.join(","));')));
    expect(only!.program).toBe(
      ['import { Console } from "@promptctl/rich-js";', "", "const console = new Console();", "", "const rows: string[] = [];", "const add = (row: string) => rows.push(row);", 'add("q");', 'const unused = "n";', "", 'console.print(rows.join(","));'].join("\n"),
    );
  });

  it("carries every bare import the page ran by the block's end", async () => {
    const context = ["---", "exampleContext: |", '  import "@promptctl/rich-js";', '  const used = "u";', "---", ""].join("\n");
    const [only] = await tried(await run(context + fence("console.print(used);")));
    expect(only!.program.split("\n")[0]).toBe('import "@promptctl/rich-js";');
  });

  it("opens a scope where the block redeclares a name it carries, as the page does", async () => {
    const [, second] = await tried(
      await run(page(fence('const t = "a";\nconst p = new Panel(t);', "ts silent"), fence('const t = "b";\nconst console = new Console({ width: 30 });\nconsole.print(p, t);'))),
    );
    expect(second!.program).toBe(
      ['import { Console, Panel } from "@promptctl/rich-js";', "", 'const t = "a";', "const p = new Panel(t);", "", "{", 'const t = "b";', "const console = new Console({ width: 30 });", "console.print(p, t);", "}"].join("\n"),
    );
  });

  it("carries a statement with the comments above it, and not the one trailing the line before it", async () => {
    const [, second] = await tried(await run(page(fence('const a = "x"; // about a\n// about b\nconst b = "y";', "ts silent"), fence("console.print(b);"))));
    expect(second!.program).toContain('\n// about b\nconst b = "y";\n');
    expect(second!.program).not.toContain("about a");
  });

  it("opens a live block as its program alone, and gives a block that runs nowhere no link", async () => {
    const result = await runPage(page(fence('const above = "above";\nconsole.print(above);'), fence('console.print("live");', "ts live"), fence("process.exit(1);", "ts node")));
    const links = await tried(result.markdown);
    expect(links).toHaveLength(2);
    expect(links[1]!.program).toBe(['import { Console } from "@promptctl/rich-js";', "", "const console = new Console();", "", 'console.print("live");'].join("\n"));
  });

  it("links to the playground from a page in a folder", async () => {
    const [link] = await tried(await run(fence("console.print(1);"), "guide/fixture.md"));
    expect(link!.href).toBe("../playground");
  });

  it("fails the build at a block whose program would not print what the page shows", async () => {
    // The column is added by a statement that declares, which the cut reads as only reading `table`.
    const markdown = page(fence('const table = new Table();\nconst named = table.addColumn("name");', "ts silent"), fence("console.print(table);"));
    await expect(run(markdown)).rejects.toThrow(/fixture\.md:6: "Try it" opens this block as the program below, which completed where the page's run of the block completed/);
  });

  it("fails the build at a throws block whose program throws something else", async () => {
    // Declaring, the call that sets the columns is read as only reading `table`, so the program throws before its row is refused.
    const markdown = page(
      fence('const table = new Table();\nconst cols = [table.addColumn("a")];', "ts silent"),
      fence('if (table.columns.length === 0) throw new Error("no columns");\nthrow new RangeError("too many cells");', "ts throws"),
    );
    await expect(run(markdown)).rejects.toThrow(/fixture\.md:6: "Try it" [^]*which threw Error: no columns where the page's run of the block threw RangeError: too many cells/);
  });

  it("names random numbers among the causes when a block draws after one above it drew", async () => {
    const markdown = page(fence("console.print(String(Math.random()));"), fence("console.print(String(Math.random()));"));
    await expect(run(markdown)).rejects.toThrow(/fixture\.md:5: "Try it" [^]*random numbers the block draws after a block above it drew some/);
  });

  it("fails the build at a block whose program does not compile, saying it is the \"Try it\" program", async () => {
    // The assertion that narrows `v` names `console`, so the cut reads it as what the block above printed.
    const markdown = page(
      fence('const v: unknown = "hi";\nfunction check(value: unknown, _to: Console): asserts value is string {}', "ts silent"),
      fence("check(v, console);", "ts silent"),
      fence("console.print(v.toUpperCase());"),
    );
    await expect(run(markdown)).rejects.toThrow(/fixture\.md:10: "Try it" opens this block as the program below, which does not compile\. docs example does not compile:\ndocs\/fixture\.md:11: .v. is of type .unknown./);
  });
});

describe("a page run's time and random numbers", { timeout: 30_000 }, () => {
  /** What an output shows, as text: its light fragment without the markup. */
  const text = (html: string) => /<div class="rich-example-light" v-pre>(.*?)<\/div>/.exec(html)![1]!.replace(/<[^>]*>/g, "").replaceAll("&#10;", "").trim();

  it("are one instant and one sequence for every program the run executes", async () => {
    // Each block is run twice, in the chain and as its "Try it" program, and the two must print the same.
    const shown = outputs(await run(page(fence("console.print(String(Date.now()), String(Math.random()));"), fence("console.print(String(Date.now()));"))));
    const [first, second] = shown.map(text);
    expect(first!.split(" ")[0]).toBe(second);
  });

  it("keep \`Date()\` a string, as a host's is", async () => {
    expect(text(outputs(await run(fence("console.print(typeof Date(), Date() === new Date().toString());")))[0]!)).toBe("string true");
  });

  it("are the build's own, not a constant", async () => {
    const markdown = fence("console.print(String(Math.random()));");
    expect(text(outputs(await run(markdown))[0]!)).not.toBe(text(outputs(await run(markdown))[0]!));
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
    ["a shape block that does not compile, at its page line", page("# t", fence('new Table("Name");', "ts shape")), /fixture\.md:4: Type '"Name"' has no properties in common with type 'TableOptions'/],
    ["a node block that does not compile, at its page line", page("# t", fence("new Console({ widht: 80 });", "ts node")), /fixture\.md:4: Object literal may only specify known properties/],
    ["a build block that exits", fence("process.exit(2);", "ts silent"), /docs\/fixture\.md: an example calls process\.exit\(2\)/],
    ["a throws block that exits", fence("process.exit(1);", "ts throws"), /docs\/fixture\.md: an example calls process\.exit\(1\)/],
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
    // Vite's context, for a module that depends on no file.
    const context: LoadContext = { addWatchFile: () => {} };
    const program = (await plugin.load.call(context, plugin.resolveId(specifier)!))!;
    // The program imports its library and adds its own code to it.
    const [, librarySpecifier, block] = /^import library from ("[^"]+");\nexport default library \+ (".*");$/s.exec(program)!;
    const library = (await plugin.load.call(context, plugin.resolveId(JSON.parse(librarySpecifier!) as string)!))!;
    const [, script] = /^export default (".*");$/s.exec(library)!;
    expect(await liveOutput((JSON.parse(script!) as string) + (JSON.parse(block!) as string))).toContain("served");
    expect(plugin.resolveId("./elsewhere.js")).toBeNull();
    await expect(plugin.load.call(context, `\0${LIVE_MODULE_PREFIX}0000`)).rejects.toThrow(/no page run produced this live program/);
  });

  it("serves the live terminal's worker as one classic script, with no page run needed", { timeout: 60_000 }, async () => {
    const plugin = docsExamplesPlugin();
    const watched: string[] = [];
    const module = (await plugin.load.call({ addWatchFile: (file) => watched.push(file) }, plugin.resolveId(LIVE_RUNTIME_MODULE)!))!;
    // No page imports the worker's files, so `docs:dev` learns an edit made it stale only from these.
    expect(watched).toContain(path.join(REPO_ROOT, "docs", ".vitepress", "theme", "live-worker.ts"));
    expect(watched).toContain(path.join(REPO_ROOT, "docs", ".vitepress", "simulated-process.ts"));
    const [, runtime] = /^export default (".*");$/s.exec(module)!;
    // A frame starts the worker from this text as a classic script, which
    // cannot parse an `import`, an `export` or an `import.meta`.
    const script = JSON.parse(runtime!) as string;
    expect(() => new Function(script)).not.toThrow();
    // …and it does something: a bundle can drop a module it was only told to import.
    expect(script).toMatch(/onmessage/);
  });

  it("serves the playground the start page's first block, running on the live examples' own library", { timeout: 60_000 }, async () => {
    const plugin = docsExamplesPlugin();
    const context: LoadContext = { addWatchFile: () => {} };
    const watched: string[] = [];
    const module = (await plugin.load.call({ addWatchFile: (file) => watched.push(file) }, plugin.resolveId(PLAYGROUND_MODULE)!))!;
    const [, librarySpecifier, start] = /^import library from ("[^"]+");\nexport \{ library \};\nexport const start = (".*");$/s.exec(module)!;
    const startPage = path.join(REPO_ROOT, "docs", PLAYGROUND_START_PAGE);
    expect(JSON.parse(start!)).toBe(scanFences(PLAYGROUND_START_PAGE, readFileSync(startPage, "utf-8"))[0]!.code);
    // The playground is no page this plugin transforms, so `docs:dev` learns it is stale only from these.
    expect(watched).toContain(startPage);
    expect(watched).toContain(path.join(REPO_ROOT, "src", "index.ts"));
    // One library for the site: a live example's program imports the very module the playground does.
    const transformed = await plugin.transform(fence('console.print("served");', "ts live"), path.join(REPO_ROOT, "docs", "fixture-live.md"));
    const [specifier] = /virtual:rich-live\/[0-9a-f]+/.exec(transformed!.code)!;
    const program = (await plugin.load.call(context, plugin.resolveId(specifier)!))!;
    expect(program.startsWith(`import library from ${librarySpecifier!};`)).toBe(true);
    expect(await plugin.load.call(context, plugin.resolveId(JSON.parse(librarySpecifier!) as string)!)).toMatch(/^export default "/);
  });

  it("serves the landing page's showcase, a program under examples/, running on the live examples' own library", { timeout: 60_000 }, async () => {
    const plugin = docsExamplesPlugin();
    const context: LoadContext = { addWatchFile: () => {} };
    const watched: string[] = [];
    const module = (await plugin.load.call({ addWatchFile: (file) => watched.push(file) }, plugin.resolveId(SHOWCASE_MODULE)!))!;
    const [, librarySpecifier, block] = /^import library from ("[^"]+");\nexport default library \+ (".*");$/s.exec(module)!;
    // Imported by the hero, not by a page this plugin transforms, so `docs:dev` learns it is stale only from these.
    expect(watched).toContain(SHOWCASE_FILE);
    expect(watched).toContain(path.join(REPO_ROOT, "src", "index.ts"));
    const library = (await plugin.load.call(context, plugin.resolveId(JSON.parse(librarySpecifier!) as string)!))!;
    const [, script] = /^export default (".*");$/s.exec(library)!;
    const shared = JSON.parse(script!) as string;
    // It runs on the library, carrying none of it.
    expect((JSON.parse(block!) as string).length).toBeLessThan(shared.length / 50);

    // It never ends: its frames are drawn on timers, so the test drives the clock.
    vi.useFakeTimers();
    try {
      const output: string[] = [];
      await runInTerminal(shared + (JSON.parse(block!) as string), {
        ...EXAMPLE_TERMINAL,
        write: (chunk) => output.push(String(chunk)),
        onInput: () => {},
        exit: () => {},
      });
      // Its first frame is drawn before its body returns, where a still frame is taken.
      const frame = () => output.join("").split("\x1b[H").at(-1)!;
      const first = frame();
      expect(first).toContain("Services");
      expect(first).toContain("Progress");
      vi.advanceTimersByTime(2_000);
      expect(frame()).toContain("Services");
      expect(frame()).not.toBe(first);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("refuses a start block that is not a program on its own, at its line", { timeout: 60_000 }, () => {
    // `console` here is the page prelude's Console, which the playground does not give a block.
    const markdown = page("# Start", fence('console.print("[bold]hi[/]");'));
    expect(() => playgroundStart(compiler, markdown)).toThrow(new RegExp(`docs/${PLAYGROUND_START_PAGE}:4: Property 'print' does not exist`));
  });

  it.each(["node", "shape", "throws"])("refuses a start block marked %s, which does not run to an end", (marker) => {
    const markdown = page("# Start", fence('import { Console } from "@promptctl/rich-js";\nnew Console().print("hi");', `ts ${marker}`));
    expect(() => playgroundStart(compiler, markdown)).toThrow(`docs/${PLAYGROUND_START_PAGE}:3: the playground opens on this block, and a "${marker}" block`);
  });

  it("passes a page with no TypeScript example through untouched", async () => {
    expect(await docsExamplesPlugin().transform("# Prose\n\n```sh\nnpm install\n```\n", path.join(REPO_ROOT, "docs", "fixture-prose.md"))).toBeNull();
  });
});
