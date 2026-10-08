/**
 * Runs a docs page's examples at build time and puts each in its card
 * (example-card.ts): one holding the output the build proved for it, one
 * whose output is its program running in a live terminal, or one that runs
 * nowhere.
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
 *      line of the block that caused an error, and type-check each block
 *      outside the chain (`live`, `shape`, `node`) the same way, as a program
 *      of its own;
 *   3. bundle it, `@promptctl/rich-js` resolved to `src/`;
 *   4. run it once under the simulated process, in one fixed terminal;
 *   5. cut the captured bytes into per-block output and hold each block to
 *      what its marker promised;
 *   6. draw each block's bytes as a light and a dark fragment
 *      (example-fragments.ts) and hand them to the block's card; one that
 *      runs nowhere is a read-only card with its note;
 *   7. cut each block that runs into a program of its own (example-slice.ts),
 *      type-check it and link it from the block's "Try it"; a block of the
 *      chain's is also run as the playground runs it and held to the block's
 *      output, and its card program with it. A `live` block's programs run
 *      only in the browser, on the one library every program there shares
 *      (`LiveLibrary`), so each is held to importing only what it holds.
 *
 * [LAW:no-silent-failure] Every failure throws and fails the build, naming the
 * page, and the line when one line is to blame.
 */

import { build } from "vite";
import ts from "typescript";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ENTRY_BY_SPECIFIER, PACKAGE_MANIFEST, REPO_ROOT, listTypeScriptFiles, loadCompilerOptions } from "../../scripts/repo-facts.js";
import { resolveAlias } from "../../scripts/resolve-alias.js";
import { tscTransform } from "../../scripts/tsc-transform.js";
import { osc8Sequences } from "../../src/index.js";
import { EXAMPLE_TERMINAL, STATIC_RUN_LIMIT_MS } from "./example-terminal.js";
import { drawOutput } from "./example-fragments.js";
import { cardSource, type CardData } from "./example-card.js";
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
  type MarkerRule,
} from "./example-markers.js";
import {
  MAIN_BARREL,
  buildBlockProgram,
  buildProgram,
  exampleContext,
  splitRecords,
  thrownLine,
  type BarrelExport,
  type BlockRecord,
  type ExampleContext,
  type ExampleProgram,
} from "./example-program.js";
import { runInTerminal, type SimulatedTerminal } from "./simulated-process.js";
import { LIBRARY_BINDING } from "./live-library.js";
import { standalonePrograms, type Checked, type Standalone } from "./example-slice.js";
import { encodeProgram } from "./playground-hash.js";
import { playgroundScript } from "./theme/playground-program.js";

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

  /**
   * Type-check `program`, throwing every error at the page line it came from; the checker's reading of it.
   *
   * [LAW:single-enforcer] This is where the docs are held to the library's
   * surface: an import an entry point does not export, or a member a class does
   * not have, fails here. The failures it exists for all shipped once, looking
   * like working code: `RenderGroup` for `Group`, a `richReprAuto` decorator for
   * a protocol never built, `console.status` / `console.pager` transliterated
   * from Python Rich's `Console`.
   *
   * When it fails on a symbol the library lacks, change the page, never
   * `src/`. The code is the truth and the
   * page a claim about it, so a symbol a page names and the library lacks is a
   * false page, not a missing feature; implementing it to clear the build lets
   * an unreviewed sentence set the roadmap. `docs/logging.md` documented a
   * `RichHandler` end to end across five snippets, and the resolution was to
   * delete the page. A symbol genuinely wanted is filed on its own merits.
   *
   * A clean compile is the weakest of the three ways a page lies. It catches
   * a symbol that does not exist. It cannot catch one that exists and does
   * something else — `docs/strip.md` taught `end: ""` as what makes a
   * `RichText` an inline cell, and it is inert — nor a true statement about one
   * code path stretched over the surface, like `docs/console.md` saying "any
   * other string throws" of `colorSystem` while `"vscode"` maps to truecolor.
   * Both live in sentences, and finding them means reading every branch a
   * claim of "any", "all", "never" or "only" depends on.
   */
  check(program: ExampleProgram): Checked {
    const compiled = this.compile(program.source);
    const file = compiled.getSourceFile(PROGRAM_FILE)!;
    const errors = ts.getPreEmitDiagnostics(compiled, file).map((d) => {
      const at = d.start === undefined ? null : program.origins[file.getLineAndCharacterOfPosition(d.start).line];
      const where = at == null ? `docs/${program.page} (generated code)` : `docs/${program.page}:${at}`;
      return `${where}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
    });
    if (errors.length > 0) throw new Error(`docs example does not compile:\n${errors.join("\n")}`);
    return { checker: compiled.getTypeChecker(), file };
  }
}

/** What a program's `node:readline` is under the simulated process, so `nodeAsk` reads from its terminal. */
const READLINE_STAND_IN = path.join(REPO_ROOT, "docs", ".vitepress", "node-readline.ts");

/**
 * `source` as the one self-contained script `runInTerminal` takes: every
 * import inlined, this package's entry points resolved to `src/`, and every
 * `process` read left as the free name the stand-in binds. Everything that
 * runs a program under the simulated process bundles it here, the tests of
 * that module included.
 */
export function bundleExample(source: string): Promise<string> {
  return bundle(generated(source), { format: "es" }).then(({ code }) => code);
}

/**
 * How a bundle is written: as a module (`es`), or as a minified script
 * declaring one variable, `name`, that holds its entry's default export
 * (`iife`). A module `onLibrary` is a program for the live library to run
 * (`libraryImport`).
 */
type BundleShape = { readonly format: "es"; readonly onLibrary?: boolean } | { readonly format: "iife"; readonly name: string };

/**
 * What a bundle starts from: `source`, bundled as though it were the file
 * `file`, so its relative imports resolve from where that file stands. The
 * bundle is of this module and what it imports, and an entry is never dropped
 * as unused; a module it only imports is, when it exports nothing and
 * package.json promises `"sideEffects": false`, as it does for this whole
 * repository.
 */
interface Entry {
  readonly file: string;
  readonly source: string;
}

/** A program generated here: a module no file backs. */
const generated = (source: string): Entry => ({ file: PROGRAM_FILE, source });

/** A specifier naming a package, not a file. */
const isPackage = (id: string): boolean => !id.startsWith(".") && !path.isAbsolute(id);

/**
 * What a live block may import: every entry point of this package but the two
 * that need a Node built-in the worker has no stand-in for (`node:fs`,
 * `node:util`), and the optional peers the entry points import, which
 * package.json's `peerDependencies` names.
 */
const NO_STAND_IN = new Set(["@promptctl/rich-js/node/save", "@promptctl/rich-js/node/traceback"]);

/** The entry points the live library holds, each by the file under `src/` it is. */
const SPECIFIER_BY_ENTRY: ReadonlyMap<string, string> = new Map(
  [...ENTRY_BY_SPECIFIER].filter(([specifier]) => !NO_STAND_IN.has(specifier)).map(([specifier, file]) => [path.join(REPO_ROOT, file), specifier]),
);

const LIVE_LIBRARY_PACKAGES: readonly string[] = [
  ...SPECIFIER_BY_ENTRY.values(),
  ...Object.keys(PACKAGE_MANIFEST.peerDependencies ?? {}),
].sort();

const SRC_ROOT = path.join(REPO_ROOT, "src") + path.sep;

/**
 * An import of a program bundled onto the live library, left as an import for
 * the library to supply: a package, by its name, and a file that is one of
 * this package's entry points, by the name the package publishes it under.
 * Any other file is the program's own, and bundled into it. Which file an
 * import names is the build's resolver's answer (`resolve`), extensions,
 * directories and all, never worked out again here.
 *
 * [LAW:single-enforcer] A file under `src/` the library does not hold is
 * refused here. It could only be bundled in, a second copy of library code
 * beside the library's, with classes of its own that none of the library's
 * are instances of.
 */
async function libraryImport<Resolved extends { readonly id: string }>(
  id: string,
  importer: string | undefined,
  resolve: () => Promise<Resolved | null>,
): Promise<Resolved | { readonly id: string; readonly external: true } | null> {
  if (isPackage(id)) return { id, external: true };
  // Only an entry is imported by nothing, and an entry is no import.
  if (importer === undefined) return null;
  // Unresolved, it is the build's own error, which names the import.
  const resolved = await resolve();
  if (resolved === null) return null;
  const specifier = SPECIFIER_BY_ENTRY.get(resolved.id);
  if (specifier !== undefined) return { id: specifier, external: true };
  if (resolved.id.startsWith(SRC_ROOT)) {
    throw new Error(
      `${path.relative(REPO_ROOT, importer)} imports ${path.relative(REPO_ROOT, resolved.id)}, which the live library does not hold; ` +
        `a live program reaches the library only through ${[...SPECIFIER_BY_ENTRY.keys()].map((file) => path.relative(REPO_ROOT, file)).join(", ")}`,
    );
  }
  return resolved;
}

/** A bundle's one chunk, and every file that went into it besides the source it was given. */
interface Bundled {
  readonly code: string;
  readonly modules: readonly string[];
}

async function bundle(entry: Entry, shape: BundleShape): Promise<Bundled> {
  const onLibrary = shape.format === "es" && shape.onLibrary === true;
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
        resolveId(id, importer) {
          return id === entry.file ? id
            : onLibrary ? libraryImport(id, importer, () => this.resolve(id, importer, { skipSelf: true }))
            : id === "node:readline" ? READLINE_STAND_IN
            : ENTRY_BY_SPECIFIER.has(id) ? path.join(REPO_ROOT, ENTRY_BY_SPECIFIER.get(id)!)
            : null;
        },
        load: (id) => (id === entry.file ? entry.source : null),
      },
      tscTransform(REPO_ROOT),
    ],
    build: {
      write: false,
      // A library is minified, its names kept: a program may print a class's
      // name, and the library is what every live page downloads.
      minify: shape.format === "iife",
      rolldownOptions: {
        input: entry.file,
        // An app build drops its entry's exports; a library's default export is its point.
        preserveEntrySignatures: shape.format === "iife" ? "exports-only" : false,
        output:
          shape.format === "es"
            ? { format: "es", codeSplitting: false }
            : { format: "iife", name: shape.name, exports: "default", codeSplitting: false, keepNames: true },
      },
    },
  });
  if (!("output" in result)) throw new Error("bundle: vite returned no single build output");
  const chunks = result.output.filter((file) => file.type === "chunk");
  if (chunks.length !== 1) throw new Error(`bundle: expected one chunk, vite produced ${chunks.length}`);
  // A `\0` id is a module the bundler made up, rolldown's own runtime among
  // them: there is no file to watch, and vite, handed one by `addWatchFile`,
  // fails resolving it as an import of the module that watched it.
  return { code: chunks[0]!.code, modules: chunks[0]!.moduleIds.filter((id) => id !== entry.file && !id.startsWith("\0")) };
}

type RunEnd = { readonly kind: "finished" } | { readonly kind: "threw"; readonly error: unknown } | { readonly kind: "stalled" };

/**
 * What a program reads that is neither its page nor `src/`: the time, and
 * random numbers. A page run fixes both, and every program it runs reads the
 * same: one instant, and one sequence from one seed.
 *
 * [LAW:one-source-of-truth] A block runs twice in a page run, in the page's
 * chain and as its "Try it" program (`tryItPrints`), and the second is held to
 * the first's bytes. `console.log` stamps each line with the time, and an
 * example may print a random number; read from the host, either would make two
 * runs of one block differ. A block that draws random numbers after a block
 * above it drew some still differs, since its program starts the sequence
 * afresh, and the gate names that among the causes at the block.
 */
interface World {
  readonly now: number;
  readonly seed: number;
}

function newWorld(): World {
  return { now: Date.now(), seed: Math.floor(Math.random() * 2 ** 32) };
}

/**
 * `world` as declarations over the globals `Date` and `Math` in the body a
 * program runs in: every `new Date()`, `Date()` and `Date.now()` is `world.now`, and
 * `Math.random` is mulberry32 from `world.seed`.
 */
const worldScript = (world: World): string => `const Date = new Proxy(globalThis.Date, {
  apply: (Clock) => new Clock(${world.now}).toString(),
  construct: (Clock, time, target) => Reflect.construct(Clock, time.length === 0 ? [${world.now}] : time, target),
  get: (Clock, key) => (key === "now" ? () => ${world.now} : Reflect.get(Clock, key)),
});
const Math = ((seed) => Object.create(globalThis.Math, { random: { value: () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = globalThis.Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + globalThis.Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
} } }))(${world.seed});`;

/** Run `script` in the example terminal, in `world`: every byte it wrote, and how the run ended. */
async function capture(script: string, world: World): Promise<{ stream: string; end: RunEnd; exits: number[] }> {
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
    runInTerminal(`${worldScript(world)}\n${script}`, terminal).then(
      (): RunEnd => ({ kind: "finished" }),
      (error: unknown): RunEnd => ({ kind: "threw", error: error ?? new Error("the example rejected with no reason") }),
    ),
    new Promise<RunEnd>((resolve) => {
      timer = setTimeout(() => resolve({ kind: "stalled" }), STATIC_RUN_LIMIT_MS);
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

/** The bytes a block shows, held to what its marker promised. */
function blockBytes(fence: Fence & { readonly marker: BuildMarker }, record: BlockRecord): string {
  const at = `docs/${fence.page}:${fence.line}`;
  const { outcome } = MARKERS[fence.marker];
  if (outcome === "throws" && record.ended.kind === "completed") throw new Error(`${at}: marked \`throws\` but returned normally`);
  if (outcome === "silent" && record.output !== "") throw new Error(`${at}: marked \`silent\` but wrote ${JSON.stringify(record.output.slice(0, 60))}`);
  if (outcome === "prints" && record.output === "") throw new Error(`${at}: writes nothing; mark it \`silent\``);
  const escape = disallowedEscape(record.output);
  if (escape !== null) throw new Error(`${at}: writes the escape ${escape}, which moves the cursor or clears the screen; mark it \`live\``);
  return record.ended.kind === "completed" ? record.output : `${record.output}${record.ended.line}\n`;
}

/** Where a run that did not finish stopped: the first part of the program with no record. */
function stoppedAt(page: string, context: ExampleContext | null, chain: readonly Fence[], records: number): string {
  if (records === 0) return `docs/${page} (imports and prelude)`;
  if (records === 1 && context !== null) return `docs/${page}:${context.line} (exampleContext)`;
  const failed = chain[records - 2];
  return failed === undefined ? `docs/${page}` : `docs/${page}:${failed.line}`;
}

/**
 * The library every live program runs on: each package in
 * `LIVE_LIBRARY_PACKAGES`, all its exports, bundled as one script that
 * declares `LIBRARY_BINDING`, keyed by specifier. There is one for the site,
 * so a reader downloads it once however many live examples they open, and a
 * package the entry points share (mobx under widgets) is one instance however
 * a block reaches it. Its id is its content's hash.
 *
 * [LAW:one-source-of-truth] It is a script evaluated in the same function
 * body as the program, not an ES module the program imports, because
 * simulated-process.ts binds `process` lexically: the library's free
 * `process` reads reach the stand-in only when its code sits inside that
 * function. A shared module would read the worker's global `process` instead.
 */
export interface LiveLibrary {
  readonly id: string;
  readonly script: string;
}

/** The virtual module a live program is served as. */
export const LIVE_MODULE_PREFIX = "virtual:rich-live/";

/** Where under `LIVE_MODULE_PREFIX` a live library is served. */
const LIVE_LIBRARY_PATH = "library/";

/**
 * The module whose default export is the script a live program's worker runs:
 * theme/live-worker.ts and everything it imports, bundled as one classic
 * script. The page hands that text to the sandboxed frame a program runs in,
 * because a frame with an opaque origin can start a worker only from a script
 * it holds, never from a URL on the site. theme/live-terminal.ts owns why the
 * frame.
 */
export const LIVE_RUNTIME_MODULE = `${LIVE_MODULE_PREFIX}runtime`;

const LIVE_WORKER = path.join(REPO_ROOT, "docs", ".vitepress", "theme", "live-worker.ts");

/** The script `LIVE_RUNTIME_MODULE` exports, as it stands on disk now, and the files it was built from. */
export function bundleLiveRuntime(): Promise<Bundled> {
  return bundle(generated(`import { serve } from ${JSON.stringify(LIVE_WORKER)};\nserve();`), { format: "es" }).catch((error: unknown) => {
    throw new Error(`the live terminal's worker did not bundle: ${String(error)}`, { cause: error });
  });
}

/** `bundle`, failing with where the program came from. */
async function bundleOrThrow(where: string, entry: Entry, shape: BundleShape = { format: "es" }): Promise<Bundled> {
  return bundle(entry, shape).catch((error: unknown) => {
    throw new Error(`${where}: bundling failed: ${String(error)}`, { cause: error });
  });
}

/**
 * The module the playground page imports: `library`, the live library's
 * script, and `start`, the program it opens on (`playgroundStart`).
 */
export const PLAYGROUND_MODULE = `${LIVE_MODULE_PREFIX}playground`;

/**
 * The module whose default export is the live library's script, for an
 * editable card (theme/RichExample.ts) running its program on it.
 */
export const LIBRARY_MODULE = `${LIVE_MODULE_PREFIX}library`;

/** The page whose first TypeScript block the playground opens on. */
export const PLAYGROUND_START_PAGE = "introduction.md";

/**
 * The program the playground opens on: the first TypeScript block of
 * `PLAYGROUND_START_PAGE`, exactly as that page shows it. The playground runs
 * a block with nothing around it, no prelude and no page context, so the
 * block is type-checked that way, and one that is not a program on its own
 * fails the build at its line. So does one its page does not run to an end:
 * every visitor would open on a program that fails.
 */
export function playgroundStart(compiler: ExampleCompiler, markdown: string): string {
  const page = PLAYGROUND_START_PAGE;
  const [first] = scanFences(page, markdown);
  if (first === undefined) throw new Error(`docs/${page}: has no TypeScript block for the playground to open on`);
  const rule: MarkerRule = MARKERS[first.marker];
  if (rule.run === "never" || (rule.run === "build" && rule.outcome === "throws")) {
    throw new Error(`docs/${page}:${first.line}: the playground opens on this block, and a "${first.marker}" block does not run to an end`);
  }
  compiler.check({ page, source: first.code, origins: first.code.split("\n").map((_, i) => first.line + 1 + i), blocks: [first] });
  return first.code;
}

/** The playground's page, which "Try it" links to. */
const PLAYGROUND_PAGE = "playground.md";

/** The playground's address from `page`'s, relative so it holds under any base the site is served from. */
function playgroundHref(page: string): string {
  return path.posix.relative(path.posix.dirname(`/${page}`), `/${PLAYGROUND_PAGE.replace(/\.md$/, "")}`);
}

/**
 * A program a block is run as on its own, and who runs it: "Try it", which
 * opens it in the playground, or a build block's editable card, which runs
 * the "Try it" program around whatever its editor holds (example-card.ts).
 */
interface Opened {
  readonly by: "try it" | "card";
  readonly source: string;
}

const OPENS: Record<Opened["by"], string> = {
  "try it": `"Try it" opens this block as the program below`,
  card: "this block's editable card runs it as the program below",
};

/** The programs a block is opened as, each once: a card whose program is its "Try it" program is held by that one run. */
function openedAs(fence: Fence, { program, setup }: Standalone): Opened[] {
  const all: Opened[] = [
    { by: "try it", source: program.source },
    { by: "card", source: cardSource(setup, fence.code) },
  ];
  return all.filter((opened, i) => all.findIndex((other) => other.source === opened.source) === i);
}

/**
 * Hold a program a block is opened as to what the page shows for the block:
 * run the way the playground runs it, on the live library, it writes the bytes
 * the block wrote in the page's chain and ends the way the block ended.
 *
 * [LAW:verifiable-goals] The program is cut from the page by what its names
 * refer to (example-slice.ts), and that reading can miss a statement the
 * block's output depends on. A miss fails here, at the block, rather than in
 * front of a reader.
 */
async function tryItPrints(fence: Fence, { by, source }: Opened, record: BlockRecord, shared: LiveLibrary, world: World): Promise<void> {
  const { stream, end, exits } = await capture(playgroundScript(source, shared.script), world);
  // How each ended, a throw by the line the page shows for it.
  const ended = end.kind === "finished" ? "completed" : end.kind === "threw" ? `threw ${thrownLine(end.error)}` : end.kind;
  const expected = record.ended.kind === "threw" ? `threw ${record.ended.line}` : record.ended.kind;
  if (exits.length === 0 && ended === expected && stream === record.output) return;
  let from = 0;
  while (from < stream.length && stream[from] === record.output[from]) from += 1;
  throw new Error(
    `docs/${fence.page}:${fence.line}: ${OPENS[by]}, which ${ended} ` +
      `where the page's run of the block ${expected}, writing ${JSON.stringify(stream.slice(from, from + 60))} ` +
      `where the page shows ${JSON.stringify(record.output.slice(from, from + 60))}. ` +
      `The program is the block and what example-slice.ts carries from above it, so the difference is a statement above ` +
      `the block that it leaves out, one it carries that prints, or random numbers the block draws after a block above it ` +
      `drew some, which the program draws afresh.\n${source}`,
    { cause: end.kind === "threw" ? end.error : undefined },
  );
}

const hash = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);


/** Where a live program's library comes from: built once, however many pages ask. */
export type LibrarySource = () => Promise<LiveLibrary>;

/** A source that builds the library the first time it is asked, from `src/` as it stands then. */
export function liveLibraryOnce(): LibrarySource {
  let built: Promise<LiveLibrary> | undefined;
  return () => (built ??= bundleLiveLibrary());
}

async function bundleLiveLibrary(): Promise<LiveLibrary> {
  const entry = [
    ...LIVE_LIBRARY_PACKAGES.map((specifier, i) => `import * as m${i} from ${JSON.stringify(specifier)};`),
    `export default { ${LIVE_LIBRARY_PACKAGES.map((specifier, i) => `${JSON.stringify(specifier)}: m${i}`).join(", ")} };`,
  ].join("\n");
  const { code: script } = await bundle(generated(entry), { format: "iife", name: LIBRARY_BINDING }).catch((error: unknown) => {
    throw new Error(`the live examples' library did not bundle: ${String(error)}`, { cause: error });
  });
  return { id: hash(script), script };
}

/** Whether `node` is an `import()` or `import.meta`, which a program run as a function body cannot evaluate. */
const isModuleOnly = (node: ts.Node): boolean =>
  (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
  (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword);

/**
 * Refuse an import a program on the live library makes that the library
 * cannot answer: of a module it does not hold, or of a default export, which
 * no module in it has.
 *
 * [LAW:single-enforcer] A bundled live program (`bundleOnLibrary`) and a live
 * card's program (`refuseOffLibraryImports`) are both held to it here.
 */
function refuseOffLibrary(at: string, specifier: string, clause: ts.ImportClause | undefined): void {
  if (!LIVE_LIBRARY_PACKAGES.includes(specifier)) {
    throw new Error(`${at}: a live example cannot import ${specifier}; it may import ${LIVE_LIBRARY_PACKAGES.join(", ")}`);
  }
  if (clause?.name !== undefined) throw new Error(`${at}: ${specifier} is imported by default, which the live library does not carry`);
}

/**
 * Refuse a live card's program, TypeScript run in the browser as the
 * playground runs it, that imports what the live library does not hold: there
 * every import is a `require` over that library (theme/playground-program.ts),
 * and nothing runs the program before a reader does.
 */
function refuseOffLibraryImports(at: string, source: string): void {
  const file = ts.createSourceFile("card.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) refuseOffLibrary(at, (node.moduleSpecifier as ts.StringLiteral).text, node.importClause);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [specifier] = node.arguments;
      if (specifier === undefined || !ts.isStringLiteral(specifier)) throw new Error(`${at}: a live example imports a module only by its name, written out`);
      refuseOffLibrary(at, specifier.text, undefined);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

/**
 * A live program's own code: bundled with what the library supplies left as
 * imports (`libraryImport`), then each import rewritten as a read of the
 * library. The library holds every export of every package a program may
 * import, so a binding the program imports is always there. `at` is where the
 * program is written, for its errors.
 */
async function bundleOnLibrary(at: string, entry: Entry): Promise<Bundled> {
  const { code, modules } = await bundleOrThrow(at, entry, { format: "es", onLibrary: true });
  const file = ts.createSourceFile("live.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const refuse = (node: ts.Node): void => {
    if (isModuleOnly(node)) throw new Error(`${at}: a live example imports only with \`import\` declarations, not \`import()\``);
    ts.forEachChild(node, refuse);
  };
  refuse(file);
  let block = code;
  for (const statement of [...file.statements].reverse()) {
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) throw new Error(`${at}: a live example cannot export`);
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
    const clause = statement.importClause;
    refuseOffLibrary(at, specifier, clause);
    const from = `${LIBRARY_BINDING}[${JSON.stringify(specifier)}]`;
    const bindings = clause?.namedBindings;
    const key = (name: ts.ModuleExportName): string => (ts.isStringLiteral(name) ? JSON.stringify(name.text) : name.text);
    const read =
      bindings === undefined ? ""
      : ts.isNamespaceImport(bindings) ? `const ${bindings.name.text} = ${from};`
      : `const { ${bindings.elements.map((e) => (e.propertyName === undefined ? e.name.text : `${key(e.propertyName)}: ${e.name.text}`)).join(", ")} } = ${from};`;
    block = block.slice(0, statement.getStart(file)) + read + block.slice(statement.getEnd());
  }
  return { code: `\n${block}`, modules };
}

/**
 * `file`, a module of this repository's own, as a script that adds it to the
 * live library under `name`: bundled onto the library as a live program is,
 * its exports set on `LIBRARY_BINDING` where the playground's `require` reads
 * every module a program may import. Run after the library and before the
 * program, it lets a program import `name` as it imports a package. Returns
 * the script and every file it was built from.
 */
export async function libraryModule(name: string, file: string): Promise<Bundled> {
  const entry = generated(`import * as module from ${JSON.stringify(file)};\n${LIBRARY_BINDING}[${JSON.stringify(name)}] = module;`);
  const { code, modules } = await bundleOnLibrary(path.relative(REPO_ROOT, file), entry);
  return { code, modules: [file, ...modules] };
}

/**
 * The program the landing page's hero runs (theme/RichShowcase.ts). It is a
 * program under `examples/`, not a docs block, so the demo-coverage gate
 * (test/coverage/) counts what it imports; it runs on the live library as a
 * live block does.
 */
export const SHOWCASE_FILE = path.join(REPO_ROOT, "examples", "showcase", "showcase.ts");

/** The module the landing page's hero imports: a live program, the showcase's. */
export const SHOWCASE_MODULE = `${LIVE_MODULE_PREFIX}showcase`;

/** The showcase's own code, as a live program's block, and every file it was built from. */
async function bundleShowcase(): Promise<Bundled> {
  const entry: Entry = { file: SHOWCASE_FILE, source: readFileSync(SHOWCASE_FILE, "utf-8") };
  const { code, modules } = await bundleOnLibrary(path.relative(REPO_ROOT, SHOWCASE_FILE), entry);
  return { code, modules: [SHOWCASE_FILE, ...modules] };
}

/** The module a live program is served as: its library, imported, and its block. */
const liveModule = (library: string, block: string): string => `import library from ${library};\nexport default library + ${JSON.stringify(block)};`;

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
  if (clash !== -1) throw new Error(`docs/${page}:${clash + 1}: a page with an example card cannot have its own <script setup>`);
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

/** `markdown` with each example in its card. */
export async function runPageExamples(
  compiler: ExampleCompiler,
  page: string,
  markdown: string,
  library: LibrarySource = liveLibraryOnce(),
): Promise<string> {
  const scanned = scanBlocks(page, markdown);
  const fences = typescriptFences(scanned);
  refuseCutOff(fences);
  const chain = fences.filter(runsAtBuild);
  const context = exampleContext(page, markdown);
  const barrel = compiler.barrelExports();
  const program = buildProgram(page, context, chain, barrel);
  const checked = compiler.check(program);
  // [LAW:single-enforcer] Every block outside the chain is checked here, each
  // as a program of its own, whether it runs in the browser or nowhere: not
  // being run at build time is no licence to call something that does not exist.
  const alone = new Map<Fence, ExampleProgram>(fences.filter((f) => !runsAtBuild(f)).map((fence) => [fence, buildBlockProgram(page, context, fence, barrel)]));
  // Each "Try it" program is cut from the program its block ran in, as the checker read it.
  const cutAlone = new Map<Fence, Standalone>();
  for (const [fence, blockProgram] of alone) {
    const read = compiler.check(blockProgram);
    if (MARKERS[fence.marker].run !== "never") cutAlone.set(fence, standalonePrograms(read, blockProgram)(fence));
  }
  const inChain = standalonePrograms(checked, program);
  const tried = new Map<Fence, Standalone>(
    fences.filter((fence) => MARKERS[fence.marker].run !== "never").map((fence) => [fence, runsAtBuild(fence) ? inChain(fence) : cutAlone.get(fence)!]),
  );
  for (const [fence, { program: standalone }] of tried) {
    try {
      compiler.check(standalone);
    } catch (error) {
      throw new Error(`docs/${page}:${fence.line}: "Try it" opens this block as the program below, which does not compile. ${(error as Error).message}\n${standalone.source}`, {
        cause: error,
      });
    }
  }
  const { code: script } = await bundleOrThrow(`docs/${page}`, generated(program.source));
  const world = newWorld();
  const { stream, end, exits } = await capture(script, world);
  if (exits.length > 0) throw new Error(`docs/${page}: an example calls process.exit(${exits[0]}), which would end the build; mark it \`node\``);
  const records = splitRecords(stream);
  if (end.kind !== "finished") {
    const where = stoppedAt(page, context, chain, records.length);
    if (end.kind === "stalled") throw new Error(`${where}: the example did not finish within ${STATIC_RUN_LIMIT_MS / 1000} s; mark it \`live\``);
    throw new Error(`${where}: the example threw ${String(end.error)}`, { cause: end.error });
  }
  const [prelude, contextRecord, ...blocks] = records as [BlockRecord, BlockRecord, ...BlockRecord[]];
  if (prelude.output !== "") {
    throw new Error(`docs/${page} (imports and prelude) wrote ${JSON.stringify(prelude.output.slice(0, 60))}`);
  }
  if (contextRecord.output !== "") {
    throw new Error(`docs/${page}: exampleContext wrote ${JSON.stringify(contextRecord.output.slice(0, 60))}; it may not print`);
  }
  const bytes = new Map<Fence, string>(chain.map((fence, i) => [fence, blockBytes(fence, blocks[i]!)]));
  const shared = await library();
  for (const [i, fence] of chain.entries()) {
    for (const opened of openedAs(fence, tried.get(fence)!)) await tryItPrints(fence, opened, blocks[i]!, shared, world);
  }
  for (const [fence, standalone] of tried) {
    if (MARKERS[fence.marker].run === "browser") {
      for (const { source } of openedAs(fence, standalone)) refuseOffLibraryImports(`docs/${page}:${fence.line}`, source);
    }
  }
  const playground = playgroundHref(page);
  const hashes = new Map<Fence, string>(
    await Promise.all([...tried].map(async ([fence, standalone]) => [fence, await encodeProgram(standalone.program.source)] as const)),
  );
  // Every block is a card, its data a constant of the page's script. `<` is
  // escaped so no string in it can close the script.
  const cardData = (fence: Fence): CardData => {
    const rule: MarkerRule = MARKERS[fence.marker];
    if (rule.run === "never") return { run: "never", label: rule.label, note: rule.note };
    const editable = {
      code: fence.code,
      setup: tried.get(fence)!.setup,
      label: rule.label,
      caption: rule.caption,
      tryIt: { playground, program: hashes.get(fence)! },
    };
    // A live terminal is as wide as the whole example terminal, since what
    // its program will draw is not known here (custom.css shrinks the
    // output's font where the card is narrower).
    return rule.run === "build"
      ? { run: "build", ...editable, output: drawOutput(bytes.get(fence)!) }
      : { run: "browser", ...editable, columns: EXAMPLE_TERMINAL.columns };
  };
  const cards = new Map<Fence, { readonly binding: string; readonly data: CardData }>(
    fences.map((fence, i) => [fence, { binding: `__richCard_${i}`, data: cardData(fence) }]),
  );

  const lines = pageLines(markdown);
  // The widget: the fence, untouched for VitePress to highlight, inside the
  // card component, which draws it and the output beneath it as one card. The
  // component's tags stand between blank lines, because markdown's HTML block
  // runs to the next blank line: without them the fence would not be parsed
  // as a fence, and prose written straight under it would be swallowed. The
  // component's slot is markdown the same way.
  for (const fence of [...fences].reverse()) {
    lines.splice(fence.closeLine, 0, "", "</RichExample>", "");
    lines.splice(fence.line - 1, 0, "", `<RichExample :card="${cards.get(fence)!.binding}">`, "");
  }
  const pageScript = [...cards.values()].map(({ binding, data }) => `const ${binding} = ${JSON.stringify(data).replaceAll("<", "\\u003c")};`);
  if (pageScript.length > 0) lines.splice(scriptLine(page, markdown, scanned), 0, "", "<script setup>", ...pageScript, "</script>", "");
  return lines.join("\n");
}

/**
 * The Vite plugin: every page's examples, run as the page is built,
 * and the live modules the site's components import. Typed by its shape rather than as
 * `vite`'s `Plugin`, because VitePress runs it on the vite it bundles, not on
 * the one `bundleExample` builds with.
 */
export interface DocsExamplesPlugin {
  readonly name: string;
  readonly enforce: "pre";
  transform(code: string, id: string): Promise<{ code: string; map: null } | null>;
  resolveId(id: string): string | null;
  load(this: LoadContext, id: string): Promise<string | null>;
}

/** The part of a plugin's context `load` uses: Vite reloads a module when a file it names changes. */
export interface LoadContext {
  addWatchFile(file: string): void;
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
  const runs = new Map<string, { readonly key: string; readonly result: Promise<string> }>();
  let library: { readonly source: string | null; readonly get: LibrarySource } = { source: null, get: liveLibraryOnce() };
  // Every live library served, as the module served under its id. A module
  // imports only the id it was served with, so one that outlives an edit is
  // never asked for, and the bundler gives a library its importers share one
  // chunk.
  const libraries = new Map<string, string>();
  // The live library is a function of `src/` alone: built once per state of it.
  const libraryAt = (source: string): LibrarySource => {
    if (library.source !== source) library = { source, get: liveLibraryOnce() };
    return library.get;
  };
  /** Serve `shared` under its id, and return the specifier that imports it. */
  const serveLibrary = (shared: LiveLibrary): string => {
    const id = `${LIVE_LIBRARY_PATH}${shared.id}`;
    libraries.set(id, `export default ${JSON.stringify(shared.script)};`);
    return JSON.stringify(LIVE_MODULE_PREFIX + id);
  };
  return {
    name: "rich-docs-examples",
    enforce: "pre",
    async transform(code, id) {
      if (!id.endsWith(".md") || !id.startsWith(docsRoot)) return null;
      const page = path.relative(docsRoot, id);
      if (!scanFences(page, code).length) return null;
      const source = stamp();
      const key = `${source}\u0000${code}`;
      const last = runs.get(id);
      const result = last !== undefined && last.key === key ? last.result : runPageExamples(compiler, page, code, libraryAt(source));
      runs.set(id, { key, result });
      return { code: await result, map: null };
    },
    resolveId: (id) => (id.startsWith(LIVE_MODULE_PREFIX) ? `\0${id}` : null),
    async load(id) {
      if (!id.startsWith(RESOLVED_LIVE_PREFIX)) return null;
      if (id === `\0${LIVE_RUNTIME_MODULE}`) {
        // No page imports its files, so only these watches tell `docs:dev`
        // that an edit to one makes this module stale.
        const runtime = await bundleLiveRuntime();
        runtime.modules.forEach((file) => this.addWatchFile(file));
        return `export default ${JSON.stringify(runtime.code)};`;
      }
      if (id === `\0${PLAYGROUND_MODULE}`) {
        // Imported by the playground's component, not by a page this plugin
        // transforms, so only these watches re-run it in `docs:dev`: the start
        // page for `start`, and `src/` for the library.
        const startPage = path.join(docsRoot, PLAYGROUND_START_PAGE);
        [startPage, ...listTypeScriptFiles("src")].forEach((file) => this.addWatchFile(file));
        const start = playgroundStart(compiler, readFileSync(startPage, "utf-8"));
        // Imported from the same module the cards import, so the site bundles the library once.
        const shared = await libraryAt(stamp())();
        return `import library from ${serveLibrary(shared)};\nexport { library };\nexport const start = ${JSON.stringify(start)};`;
      }
      if (id === `\0${LIBRARY_MODULE}`) {
        // Imported by the card component, not by a page this plugin
        // transforms, so only these watches rebuild it in `docs:dev`. It
        // re-exports the module the playground and the showcase import, so
        // the site bundles the library once.
        listTypeScriptFiles("src").forEach((file) => this.addWatchFile(file));
        const shared = await libraryAt(stamp())();
        return `export { default } from ${serveLibrary(shared)};`;
      }
      if (id === `\0${SHOWCASE_MODULE}`) {
        // Imported by the landing page's hero, not by a page this plugin
        // transforms, so only these watches re-run it in `docs:dev`: the
        // showcase's files for its block, and `src/` for the library.
        const [showcase, shared] = await Promise.all([bundleShowcase(), libraryAt(stamp())()]);
        [...showcase.modules, ...listTypeScriptFiles("src")].forEach((file) => this.addWatchFile(file));
        return liveModule(serveLibrary(shared), showcase.code);
      }
      const module = libraries.get(id.slice(RESOLVED_LIVE_PREFIX.length));
      if (module === undefined) throw new Error(`${id.slice(1)}: no live library was served under this id`);
      return module;
    },
  };
}
