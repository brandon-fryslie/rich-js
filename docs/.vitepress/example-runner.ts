/**
 * Runs a docs page's examples at build time and writes their output under
 * them.
 *
 * It is a Vite plugin with `enforce: "pre"`: VitePress's own plugin turns
 * markdown into Vue in its `transform` and declares no `enforce`, so a pre
 * plugin's `transform` receives the page's markdown and hands on a rewrite of
 * it. Nothing is written to disk, and `docs:dev` re-runs a page when it is
 * edited. The alternatives lose: markdown-it fence rules are synchronous and
 * cannot await a run, and a pre-pass writing files would be a second store of
 * outputs that goes stale in dev.
 *
 * Per page, in order:
 *   1. build the page's program (`example-program.ts`);
 *   2. type-check it under the repo's strict options, reporting the page and
 *      line of the block that caused an error;
 *   3. bundle it, `@promptctl/rich-js` resolved to `src/`;
 *   4. run it once under the simulated process, in one fixed terminal;
 *   5. cut the captured bytes into per-block output and hold each block to
 *      what its marker promised;
 *   6. decode each block's bytes (`decodeAnsi`, colours kept as emitted) and
 *      encode them twice, as a light and a dark fragment.
 *
 * [LAW:no-silent-failure] Every failure throws and fails the build, naming the
 * page and line: a type error, a throw from a block not marked `throws`, a
 * `throws` block that returns, a `silent` block that writes, a static block
 * that writes nothing, context that writes, a disallowed escape, an unknown
 * marker.
 */

import { build } from "vite";
import ts from "typescript";
import path from "node:path";
import { ENTRY_BY_SPECIFIER, REPO_ROOT, loadCompilerOptions } from "../../test/coverage/extract.js";
import { tscTransform } from "../../scripts/tsc-transform.js";
import { decodeAnsi, osc8Sequences } from "../../src/index.js";
import { encodeHtmlFragment } from "../../src/core/export-html.js";
import type { Segment } from "../../src/index.js";
import { ATOM_ONE_DARK, ATOM_ONE_LIGHT } from "../../src/themes/terminalThemes.js";
import { MARKERS, scanFences, type Fence } from "./example-markers.js";
import {
  MAIN_BARREL,
  buildProgram,
  exampleContext,
  splitRecords,
  type BlockRecord,
  type ExampleProgram,
} from "./example-program.js";
import { runInTerminal, type SimulatedTerminal } from "./simulated-process.js";

/**
 * Pages whose fences still render as plain code; the plugin passes them
 * through untouched. Each migration takes its own pages off, and the last one
 * deletes the list.
 */
export const NOT_YET_MIGRATED: ReadonlySet<string> = new Set([
  "columns.md",
  "console.md",
  "contrast.md",
  "group.md",
  "highlighting.md",
  "introduction.md",
  "layout.md",
  "live.md",
  "markdown.md",
  "markup.md",
  "padding.md",
  "panel.md",
  "pretty.md",
  "progress.md",
  "prompt.md",
  "protocol.md",
  "strip.md",
  "style.md",
  "syntax.md",
  "tables.md",
  "template-bindings.md",
  "text.md",
  "transpose.md",
  "traceback.md",
  "tree.md",
  "viewport.md",
  "widgets.md",
]);

/**
 * The terminal every static example runs in. 75 columns is what the docs
 * content column holds in the code font from 1120px to 1920px wide (it dips
 * to 68–72 between 1280px and 1320px, where the aside appears); below that the
 * output scrolls rather than reflows. The environment is exactly this: nothing
 * from the build machine's passes through.
 */
export const EXAMPLE_COLUMNS = 75;
const TERMINAL = { columns: EXAMPLE_COLUMNS, rows: 24, isTTY: true, env: { TERM: "xterm-256color", COLORTERM: "truecolor" } };

const PROGRAM_FILE = path.join(REPO_ROOT, "docs", "__docs-example__.ts");

/** A TypeScript program over the repo's own options, reusing its predecessor's parsed files. */
export class ExampleCompiler {
  private previous: ts.Program | undefined = undefined;
  private readonly options: ts.CompilerOptions = {
    ...loadCompilerOptions(),
    paths: Object.fromEntries([...ENTRY_BY_SPECIFIER].map(([spec, src]) => [spec, [path.join(REPO_ROOT, src)]])),
  };

  private compile(source: string): ts.Program {
    const host = ts.createCompilerHost(this.options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, language, ...rest) =>
      fileName === PROGRAM_FILE
        ? ts.createSourceFile(fileName, source, language, true)
        : getSourceFile(fileName, language, ...rest);
    const fileExists = host.fileExists.bind(host);
    host.fileExists = (fileName) => fileName === PROGRAM_FILE || fileExists(fileName);
    this.previous = ts.createProgram({ rootNames: [PROGRAM_FILE], options: this.options, host, oldProgram: this.previous });
    return this.previous;
  }

  /** The value exports of the main barrel, by the name a reader imports them under. */
  barrelValues(): string[] {
    const program = this.compile(`import {} from ${JSON.stringify(MAIN_BARREL)};`);
    const checker = program.getTypeChecker();
    const barrel = program.getSourceFile(path.join(REPO_ROOT, ENTRY_BY_SPECIFIER.get(MAIN_BARREL)!))!;
    return checker
      .getExportsOfModule(checker.getSymbolAtLocation(barrel)!)
      .filter((symbol) => (checker.getAliasedSymbol(symbol).flags & ts.SymbolFlags.Value) !== 0)
      .map((symbol) => symbol.name)
      .sort();
  }

  /** Type-check `program`, throwing every error at the page line it came from. */
  check(program: ExampleProgram): void {
    const compiled = this.compile(program.source);
    const file = compiled.getSourceFile(PROGRAM_FILE)!;
    const errors = ts.getPreEmitDiagnostics(compiled, file).map((d) => {
      const at = d.start === undefined ? null : program.origins[file.getLineAndCharacterOfPosition(d.start).line];
      const where = at == null ? `docs/${program.page} (generated code)` : `docs/${program.page}:${at}`;
      return `${where}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
    });
    if (errors.length > 0) throw new Error(`docs example does not compile:\n${errors.join("\n")}`);
  }
}

/**
 * `source` as the one self-contained script `runInTerminal` takes: every
 * import inlined, this package's entry points resolved to `src/`, and every
 * `process` read left as the free name the stand-in binds.
 */
export async function bundleExample(source: string): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root: REPO_ROOT,
    environments: { client: { keepProcessEnv: true } },
    plugins: [
      {
        name: "rich-docs-example-entry",
        enforce: "pre",
        resolveId: (id) => (id === PROGRAM_FILE ? id : ENTRY_BY_SPECIFIER.has(id) ? path.join(REPO_ROOT, ENTRY_BY_SPECIFIER.get(id)!) : null),
        load: (id) => (id === PROGRAM_FILE ? source : null),
      },
      tscTransform(REPO_ROOT),
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: PROGRAM_FILE, output: { format: "es", codeSplitting: false } },
    },
  });
  if (!("output" in result)) throw new Error("bundleExample: vite returned no single build output");
  const chunks = result.output.filter((file) => file.type === "chunk");
  if (chunks.length !== 1) throw new Error(`bundleExample: expected one chunk, vite produced ${chunks.length}`);
  return chunks[0]!.code;
}

/** Run `script` in the example terminal and return every byte it wrote, or the error it stopped with. */
async function capture(script: string): Promise<{ stream: string; error: unknown }> {
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  const terminal: SimulatedTerminal = {
    ...TERMINAL,
    write: (chunk) => chunks.push(typeof chunk === "string" ? chunk : decoder.decode(chunk)),
  };
  const error = await runInTerminal(script, terminal).then(
    () => null,
    (e: unknown) => e ?? new Error("the example rejected with no reason"),
  );
  return { stream: chunks.join(""), error };
}

const SGR = /\x1b\[[0-9;]*m/g;

/** The one escape a static block may not write: anything but SGR and OSC 8. */
function disallowedEscape(output: string): string | null {
  let rest = output;
  for (const seq of osc8Sequences(output).reverse()) rest = rest.slice(0, seq.index) + rest.slice(seq.index + seq.length);
  const at = rest.replace(SGR, "").indexOf("\x1b");
  return at === -1 ? null : JSON.stringify(rest.replace(SGR, "").slice(at, at + 8));
}

/** The bytes a block shows, held to what its marker promised. */
function blockBytes(fence: Fence, record: BlockRecord): string {
  const at = `docs/${fence.page}:${fence.line}`;
  const outcome = MARKERS[fence.marker].run === "build" ? MARKERS[fence.marker as "static" | "silent" | "throws"].outcome : null;
  if (outcome === "throws" && record.ended.kind === "completed") throw new Error(`${at}: marked \`throws\` but returned normally`);
  if (outcome === "silent" && record.output !== "") throw new Error(`${at}: marked \`silent\` but wrote ${JSON.stringify(record.output.slice(0, 60))}`);
  if (outcome === "prints" && record.output === "") throw new Error(`${at}: writes nothing; mark it \`silent\``);
  const escape = disallowedEscape(record.output);
  if (escape !== null) throw new Error(`${at}: writes the escape ${escape}, which moves the cursor or clears the screen; mark it \`live\``);
  return record.ended.kind === "threw" ? `${record.output}${record.ended.name}: ${record.ended.message}\n` : record.output;
}

/** Decoded bytes, drawn once per site colour mode. */
function fragments(bytes: string): { light: string; dark: string } {
  const text = decodeAnsi(bytes, { noWrap: true });
  const segments: Segment[] = [...text.render({ maxWidth: EXAMPLE_COLUMNS, isTerminal: false, encoding: "utf-8", asciiOnly: false })];
  return { light: encodeHtmlFragment(segments, ATOM_ONE_LIGHT), dark: encodeHtmlFragment(segments, ATOM_ONE_DARK) };
}

/**
 * What goes under a block. One line of HTML: a blank line inside it would end
 * markdown's HTML block and hand the rest of the fragment to the markdown
 * parser, so each fragment's row breaks are written as `&#10;`, which a `pre`
 * shows the same way. `v-pre` keeps Vue from reading `{{` in output.
 */
function outputHtml(fence: Fence, bytes: string | null): string {
  const note = MARKERS[fence.marker].note;
  const shown =
    bytes === null
      ? ""
      : (() => {
          const { light, dark } = fragments(bytes);
          return `<div class="rich-example-light">${light}</div><div class="rich-example-dark">${dark}</div>`;
        })();
  const noteHtml = note === null ? "" : `<p class="rich-example-note">${note}</p>`;
  return `<div class="rich-example-output" data-marker="${fence.marker}" v-pre>${noteHtml}${shown}</div>`.replaceAll("\n", "&#10;");
}

/** `markdown` with each executed or exempt example's output written under its fence. */
export async function runPageExamples(compiler: ExampleCompiler, page: string, markdown: string): Promise<string> {
  const fences = scanFences(page, markdown);
  const chain = fences.filter((fence) => MARKERS[fence.marker].run === "build");
  const program = buildProgram(page, exampleContext(page, markdown), chain, compiler.barrelValues());
  compiler.check(program);
  const { stream, error } = await capture(await bundleExample(program.source));
  const { context, blocks } = splitRecords(stream);
  if (context !== "") throw new Error(`docs/${page}: exampleContext wrote ${JSON.stringify(context.slice(0, 60))}; it may not print`);
  if (error !== null) {
    const failed = chain[blocks.length];
    const where = failed === undefined ? `docs/${page}` : `docs/${page}:${failed.line}`;
    throw new Error(`${where}: the example threw ${String(error)}`, { cause: error });
  }
  const shown = new Map(chain.map((fence, i) => [fence, blockBytes(fence, blocks[i]!)]));

  const lines = markdown.split("\n");
  for (const fence of [...fences].reverse()) {
    if (MARKERS[fence.marker].run === "browser") continue;
    lines.splice(fence.closeLine, 0, "", outputHtml(fence, shown.get(fence) ?? null));
  }
  return lines.join("\n");
}

/**
 * The Vite plugin: every migrated page's examples, run as the page is built.
 * Typed by its shape rather than as `vite`'s `Plugin`, because VitePress runs
 * it on the vite it bundles, not on the one `bundleExample` builds with.
 */
export interface DocsExamplesPlugin {
  readonly name: string;
  readonly enforce: "pre";
  transform(code: string, id: string): Promise<{ code: string; map: null } | null>;
}

export function docsExamplesPlugin(): DocsExamplesPlugin {
  const compiler = new ExampleCompiler();
  const docsRoot = path.join(REPO_ROOT, "docs");
  return {
    name: "rich-docs-examples",
    enforce: "pre",
    async transform(code, id) {
      if (!id.endsWith(".md") || !id.startsWith(docsRoot)) return null;
      const page = path.relative(docsRoot, id);
      if (NOT_YET_MIGRATED.has(page) || !scanFences(page, code).length) return null;
      return { code: await runPageExamples(compiler, page, code), map: null };
    },
  };
}
