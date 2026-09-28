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
 *      encode them twice, as a light and a dark fragment;
 *   7. type-check and bundle each `live` block as a program of its own, which
 *      the page imports as a module when its live terminal
 *      (theme/RichLive.ts) first scrolls into view.
 *
 * [LAW:no-silent-failure] Every failure throws and fails the build, naming the
 * page, and the line when one line is to blame.
 */

import { build } from "vite";
import ts from "typescript";
import { statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ENTRY_BY_SPECIFIER, REPO_ROOT, listTypeScriptFiles, loadCompilerOptions, resolveAlias } from "../../test/coverage/extract.js";
import { tscTransform } from "../../scripts/tsc-transform.js";
import { decodeAnsi, osc8Sequences } from "../../src/index.js";
import { encodeHtmlFragment } from "../../src/core/export-html.js";
import type { Segment } from "../../src/index.js";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "./example-terminal.js";
import {
  MARKERS,
  frontmatterEnd,
  pageLines,
  runsAtBuild,
  scanBlocks,
  scanFences,
  typescriptFences,
  type Block,
  type BuildMarker,
  type Enclosure,
  type Fence,
} from "./example-markers.js";
import {
  MAIN_BARREL,
  buildLiveProgram,
  buildProgram,
  exampleContext,
  splitRecords,
  type BarrelExport,
  type BlockRecord,
  type ExampleContext,
  type ExampleProgram,
} from "./example-program.js";
import { runInTerminal, type SimulatedTerminal } from "./simulated-process.js";

/**
 * Pages whose fences still render as plain code; the plugin passes them
 * through untouched. Each migration takes its own pages off, and the last one
 * deletes the list.
 */
export const NOT_YET_MIGRATED: ReadonlySet<string> = new Set([
  "live.md",
  "prompt.md",
]);

const PROGRAM_FILE = path.join(REPO_ROOT, "docs", "__docs-example__.ts");

/**
 * A TypeScript program over the repo's own options. Every file but the
 * example is parsed once and kept until its mtime changes, so each page
 * re-checks `src/` without re-reading it, and `docs:dev` still sees an edit.
 */
export class ExampleCompiler {
  private previous: ts.Program | undefined = undefined;
  private readonly parsed = new Map<string, { readonly mtimeMs: number; readonly file: ts.SourceFile }>();
  private readonly options: ts.CompilerOptions = {
    ...loadCompilerOptions(),
    paths: Object.fromEntries([...ENTRY_BY_SPECIFIER].map(([spec, src]) => [spec, [path.join(REPO_ROOT, src)]])),
  };

  private compile(source: string): ts.Program {
    const host = ts.createCompilerHost(this.options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, language, ...rest) => {
      if (fileName === PROGRAM_FILE) return ts.createSourceFile(fileName, source, language, true);
      const mtimeMs = statSync(fileName, { throwIfNoEntry: false })?.mtimeMs ?? -1;
      const kept = this.parsed.get(fileName);
      if (kept !== undefined && kept.mtimeMs === mtimeMs) return kept.file;
      const file = getSourceFile(fileName, language, ...rest);
      if (file !== undefined) this.parsed.set(fileName, { mtimeMs, file });
      return file;
    };
    const fileExists = host.fileExists.bind(host);
    host.fileExists = (fileName) => fileName === PROGRAM_FILE || fileExists(fileName);
    this.previous = ts.createProgram({ rootNames: [PROGRAM_FILE], options: this.options, host, oldProgram: this.previous });
    return this.previous;
  }

  /** The main barrel's exports, by the name a reader imports them under. */
  barrelExports(): BarrelExport[] {
    const program = this.compile(`import {} from ${JSON.stringify(MAIN_BARREL)};`);
    const checker = program.getTypeChecker();
    const barrel = program.getSourceFile(path.join(REPO_ROOT, ENTRY_BY_SPECIFIER.get(MAIN_BARREL)!))!;
    return checker
      .getExportsOfModule(checker.getSymbolAtLocation(barrel)!)
      .map((symbol) => ({ name: symbol.name, typeOnly: (resolveAlias(symbol, checker).flags & ts.SymbolFlags.Value) === 0 }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
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
 * `process` read left as the free name the stand-in binds. Everything that
 * runs a program under the simulated process bundles it here, the tests of
 * that module included.
 */
export async function bundleExample(source: string): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root: REPO_ROOT,
    // Left alone, a build rewrites `process.env` to `{}` at bundle time, and
    // the program's env reads never reach the stand-in `runInTerminal` binds.
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

/**
 * How long a static example may run. Its point is what it prints, not when;
 * one that waits on something is `live`. This catches a run that waits, not
 * one that spins: a synchronous loop never yields to the timer.
 */
const RUN_DEADLINE_MS = 5_000;

type RunEnd = { readonly kind: "finished" } | { readonly kind: "threw"; readonly error: unknown } | { readonly kind: "stalled" };

/** Run `script` in the example terminal: every byte it wrote, and how the run ended. */
async function capture(script: string): Promise<{ stream: string; end: RunEnd; exits: number[] }> {
  const chunks: string[] = [];
  const exits: number[] = [];
  const decoder = new TextDecoder();
  const terminal: SimulatedTerminal = {
    ...EXAMPLE_TERMINAL,
    write: (chunk) => chunks.push(typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true })),
    // Nobody types at a build.
    onInput: () => {},
    // Recorded rather than thrown: a throw the program could catch, or one
    // raised from a timer after the run, would hide the call or crash the build.
    exit: (code) => exits.push(code),
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = await Promise.race([
    runInTerminal(script, terminal).then(
      (): RunEnd => ({ kind: "finished" }),
      (error: unknown): RunEnd => ({ kind: "threw", error: error ?? new Error("the example rejected with no reason") }),
    ),
    new Promise<RunEnd>((resolve) => {
      timer = setTimeout(() => resolve({ kind: "stalled" }), RUN_DEADLINE_MS);
    }),
  ]);
  clearTimeout(timer);
  chunks.push(decoder.decode());
  return { stream: chunks.join(""), end, exits };
}

const SGR = /\x1b\[[0-9;]*m/g;

/** The one escape a static block may not write: anything but SGR and OSC 8. */
function disallowedEscape(output: string): string | null {
  let rest = output;
  for (const seq of osc8Sequences(output).reverse()) rest = rest.slice(0, seq.index) + rest.slice(seq.index + seq.length);
  const at = rest.replace(SGR, "").indexOf("\x1b");
  return at === -1 ? null : JSON.stringify(rest.replace(SGR, "").slice(at, at + 8));
}

/**
 * The bytes a block shows, held to what its marker promised; `null` for a
 * `silent` block, whose note stands in place of output.
 */
function blockBytes(fence: Fence & { readonly marker: BuildMarker }, record: BlockRecord): string | null {
  const at = `docs/${fence.page}:${fence.line}`;
  const { outcome } = MARKERS[fence.marker];
  if (outcome === "throws" && record.ended.kind === "completed") throw new Error(`${at}: marked \`throws\` but returned normally`);
  if (outcome === "silent" && record.output !== "") throw new Error(`${at}: marked \`silent\` but wrote ${JSON.stringify(record.output.slice(0, 60))}`);
  if (outcome === "prints" && record.output === "") throw new Error(`${at}: writes nothing; mark it \`silent\``);
  const escape = disallowedEscape(record.output);
  if (escape !== null) throw new Error(`${at}: writes the escape ${escape}, which moves the cursor or clears the screen; mark it \`live\``);
  if (outcome === "silent") return null;
  return record.ended.kind === "completed" ? record.output : `${record.output}${record.ended.line}\n`;
}

/** Where a run that did not finish stopped: the first part of the program with no record. */
function stoppedAt(page: string, context: ExampleContext | null, chain: readonly Fence[], records: number): string {
  if (records === 0) return `docs/${page} (imports and prelude)`;
  if (records === 1 && context !== null) return `docs/${page}:${context.line} (exampleContext)`;
  const failed = chain[records - 2];
  return failed === undefined ? `docs/${page}` : `docs/${page}:${failed.line}`;
}

/** Decoded bytes, drawn once per site colour mode. */
function fragments(bytes: string): { light: string; dark: string } {
  const text = decodeAnsi(bytes, { noWrap: true });
  const segments: Segment[] = [...text.render({ maxWidth: EXAMPLE_TERMINAL.columns, isTerminal: false, encoding: "utf-8", asciiOnly: false })];
  return { light: encodeHtmlFragment(segments, EXAMPLE_THEMES.light), dark: encodeHtmlFragment(segments, EXAMPLE_THEMES.dark) };
}

/**
 * What a block shows under its code: nothing (its note stands there), the
 * bytes it printed at build time, or a live terminal running the program the
 * page's script binds to `binding`.
 */
type Shown =
  | { readonly kind: "nothing" }
  | { readonly kind: "bytes"; readonly bytes: string }
  | { readonly kind: "live"; readonly binding: string };

function shownHtml(shown: Shown): string {
  switch (shown.kind) {
    case "nothing":
      return "";
    case "bytes": {
      const { light, dark } = fragments(shown.bytes);
      return `<div class="rich-example-light" v-pre>${light}</div><div class="rich-example-dark" v-pre>${dark}</div>`;
    }
    case "live":
      return `<RichLive :load="${shown.binding}" />`;
  }
}

/**
 * What goes under a block. One line of HTML: a blank line inside it would end
 * markdown's HTML block and hand the rest of the fragment to the markdown
 * parser, so each fragment's row breaks are written as `&#10;`, which a `pre`
 * shows the same way. `v-pre` on each fragment keeps Vue from reading `{{` in
 * output; it cannot sit on the whole card, which may hold a component.
 */
function outputHtml(fence: Fence, shown: Shown): string {
  const { label, caption, note } = MARKERS[fence.marker];
  const captionHtml = caption === null ? "" : `<span class="rich-example-caption">${caption}</span>`;
  const labelHtml = `<div class="rich-example-label"><span class="rich-example-name">${label}</span>${captionHtml}</div>`;
  const noteHtml = note === null ? "" : `<p class="rich-example-note">${note}</p>`;
  return `<div class="rich-example-output">${labelHtml}${noteHtml}${shownHtml(shown)}</div>`.replaceAll("\n", "&#10;");
}

/**
 * A live block's program, bundled: what the page's live terminal runs. Its id
 * is its content's hash, so an edit in `docs:dev` is a new module rather than a
 * stale one the dev server has cached.
 */
export interface LiveProgram {
  readonly id: string;
  readonly script: string;
}

/** A page run: its markdown with every example's output written in, and the live programs it loads. */
export interface PageRun {
  readonly markdown: string;
  readonly live: readonly LiveProgram[];
}

/** The virtual module a live program is served as. */
export const LIVE_MODULE_PREFIX = "virtual:rich-live/";

async function bundleOrThrow(page: string, source: string): Promise<string> {
  return bundleExample(source).catch((error: unknown) => {
    throw new Error(`docs/${page}: bundling failed: ${String(error)}`, { cause: error });
  });
}

async function liveProgram(compiler: ExampleCompiler, page: string, context: ExampleContext | null, fence: Fence): Promise<LiveProgram> {
  const program = buildLiveProgram(page, context, fence, compiler.barrelExports());
  compiler.check(program);
  const script = await bundleOrThrow(page, program.source);
  return { id: createHash("sha256").update(script).digest("hex").slice(0, 16), script };
}

/**
 * Where the page's script goes: straight after its frontmatter, or at the top
 * of a page with none. A page that already has a `<script setup>` is refused:
 * Vue takes one per component, and merging into a hand-written one is a
 * second author in a block the page owns.
 */
function scriptLine(page: string, markdown: string, blocks: readonly Block[]): number {
  const lines = pageLines(markdown);
  // A `<script setup>` shown inside a fence, of any language, is code on the
  // page, not the page's script.
  const clash = lines.findIndex(
    (line, i) => /^<script\b[^>]*\bsetup\b/.test(line) && !blocks.some((b) => b.line <= i + 1 && i + 1 <= b.closeLine),
  );
  if (clash !== -1) throw new Error(`docs/${page}:${clash + 1}: a page with a live example cannot have its own <script setup>`);
  return frontmatterEnd(lines) + 1;
}

/**
 * Where the card, HTML written at column 0 around its fence, cannot go. A list
 * item or a blockquote is ended by it; `::: code-group` builds its tabs from
 * the fences directly inside it; `::: v-pre` keeps Vue from compiling a live
 * terminal. Every other container reads the card as its own content.
 */
const CUTS_OFF: ReadonlySet<Enclosure> = new Set(["list item", "blockquote", "::: code-group", "::: v-pre"]);

function refuseCutOff(fences: readonly Fence[]): void {
  for (const fence of fences) {
    const cut = fence.within.find((enclosure) => CUTS_OFF.has(enclosure));
    if (cut !== undefined) {
      throw new Error(`docs/${fence.page}:${fence.line}: an example inside a ${cut} cannot carry its output; move it out`);
    }
  }
}

/** `markdown` with each executed or exempt example's output written under its fence. */
export async function runPageExamples(compiler: ExampleCompiler, page: string, markdown: string): Promise<PageRun> {
  const scanned = scanBlocks(page, markdown);
  const fences = typescriptFences(scanned);
  refuseCutOff(fences);
  const chain = fences.filter(runsAtBuild);
  const context = exampleContext(page, markdown);
  const program = buildProgram(page, context, chain, compiler.barrelExports());
  compiler.check(program);
  const script = await bundleOrThrow(page, program.source);
  const { stream, end, exits } = await capture(script);
  if (exits.length > 0) throw new Error(`docs/${page}: an example calls process.exit(${exits[0]}), which would end the build; mark it \`node\``);
  const records = splitRecords(stream);
  if (end.kind !== "finished") {
    const where = stoppedAt(page, context, chain, records.length);
    if (end.kind === "stalled") throw new Error(`${where}: the example did not finish within ${RUN_DEADLINE_MS / 1000} s; mark it \`live\``);
    throw new Error(`${where}: the example threw ${String(end.error)}`, { cause: end.error });
  }
  const [prelude, contextRecord, ...blocks] = records as [BlockRecord, BlockRecord, ...BlockRecord[]];
  if (prelude.output !== "") {
    throw new Error(`docs/${page} (imports and prelude) wrote ${JSON.stringify(prelude.output.slice(0, 60))}`);
  }
  if (contextRecord.output !== "") {
    throw new Error(`docs/${page}: exampleContext wrote ${JSON.stringify(contextRecord.output.slice(0, 60))}; it may not print`);
  }
  const bytes = new Map<Fence, string | null>(chain.map((fence, i) => [fence, blockBytes(fence, blocks[i]!)]));
  const liveFences = fences.filter((f) => MARKERS[f.marker].run === "browser");
  const programs = await Promise.all(liveFences.map((fence) => liveProgram(compiler, page, context, fence)));
  const live = new Map<Fence, LiveProgram>(liveFences.map((fence, i) => [fence, programs[i]!]));
  const binding = (program: LiveProgram): string => `__richLive_${program.id}`;
  const shown = (fence: Fence): Shown => {
    const program = live.get(fence);
    if (program !== undefined) return { kind: "live", binding: binding(program) };
    const printed = bytes.get(fence) ?? null;
    return printed === null ? { kind: "nothing" } : { kind: "bytes", bytes: printed };
  };

  const lines = pageLines(markdown);
  // The widget: the fence, untouched for VitePress to highlight, and its output
  // beneath, both inside one element the theme draws as a single card. Every
  // piece of HTML stands between blank lines, because markdown's HTML block
  // runs to the next blank line: without them the fence would not be parsed as
  // a fence, and prose written straight under it would be swallowed.
  for (const fence of [...fences].reverse()) {
    lines.splice(fence.closeLine, 0, "", outputHtml(fence, shown(fence)), "", "</div>", "");
    lines.splice(fence.line - 1, 0, "", '<div class="rich-example">', "");
  }
  // Each live program is a module of its own, imported only when its terminal
  // asks for it: a reader who never scrolls to one never downloads it.
  // Two blocks with the same program share one module and one binding.
  const modules = [...new Map(programs.map((p) => [p.id, p])).values()];
  if (modules.length > 0) {
    const imports = modules.map((p) => `const ${binding(p)} = () => import(${JSON.stringify(LIVE_MODULE_PREFIX + p.id)});`);
    lines.splice(scriptLine(page, markdown, scanned), 0, "", "<script setup>", ...imports, "</script>", "");
  }
  return { markdown: lines.join("\n"), live: modules };
}

/**
 * The Vite plugin: every migrated page's examples, run as the page is built,
 * and the live programs those pages import. Typed by its shape rather than as
 * `vite`'s `Plugin`, because VitePress runs it on the vite it bundles, not on
 * the one `bundleExample` builds with.
 */
export interface DocsExamplesPlugin {
  readonly name: string;
  readonly enforce: "pre";
  transform(code: string, id: string): Promise<{ code: string; map: null } | null>;
  resolveId(id: string): string | null;
  load(id: string): string | null;
}

/** Every file under `src/` and when it last changed: what a page's output depends on besides the page. */
function sourceStamp(): string {
  return listTypeScriptFiles("src")
    .map((file) => `${file}:${statSync(file).mtimeMs}`)
    .join("\n");
}

// Rollup's convention for a module no file backs: the NUL keeps every other
// plugin from trying to read it off disk.
const RESOLVED_LIVE_PREFIX = `\0${LIVE_MODULE_PREFIX}`;

export function docsExamplesPlugin(stamp: () => string = sourceStamp): DocsExamplesPlugin {
  const compiler = new ExampleCompiler();
  const docsRoot = path.join(REPO_ROOT, "docs") + path.sep;
  // VitePress builds twice, server then client, and both pass every page
  // through this transform. The last run of each page is kept by what its
  // output is a function of, the page and `src/`, so a build runs a page once
  // and `docs:dev` re-runs it when either is edited.
  const runs = new Map<string, { readonly key: string; readonly result: Promise<PageRun> }>();
  // Every live program a page run has produced, by id. A page imports only the
  // ids its own run returned, so one that outlives an edit is never asked for.
  const live = new Map<string, string>();
  return {
    name: "rich-docs-examples",
    enforce: "pre",
    async transform(code, id) {
      if (!id.endsWith(".md") || !id.startsWith(docsRoot)) return null;
      const page = path.relative(docsRoot, id);
      if (NOT_YET_MIGRATED.has(page) || !scanFences(page, code).length) return null;
      const key = `${stamp()}\u0000${code}`;
      const last = runs.get(id);
      const result = last !== undefined && last.key === key ? last.result : runPageExamples(compiler, page, code);
      runs.set(id, { key, result });
      const run = await result;
      for (const program of run.live) live.set(program.id, program.script);
      return { code: run.markdown, map: null };
    },
    resolveId: (id) => (id.startsWith(LIVE_MODULE_PREFIX) ? `\0${id}` : null),
    load(id) {
      if (!id.startsWith(RESOLVED_LIVE_PREFIX)) return null;
      const script = live.get(id.slice(RESOLVED_LIVE_PREFIX.length));
      if (script === undefined) throw new Error(`${id.slice(1)}: no page run produced this live program`);
      return `export default ${JSON.stringify(script)};`;
    },
  };
}
