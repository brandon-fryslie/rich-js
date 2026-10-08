/**
 * A visitor's TypeScript, its files with the entry first, as the one script a
 * live terminal runs: the live library, then the visitor's files on it.
 *
 * Types are stripped, not checked. Running code needs no type-checker, and
 * whatever strips them is downloaded by every visitor to the playground, so
 * the stripper was chosen by its weight on the page, measured minified and
 * gzipped (`gzip -9`): Sucrase 48 KB, `typescript` 1.0 MB, esbuild-wasm 3.7 MB
 * (its wasm). Sucrase also leaves every line where it was, which is what lets
 * an error name the visitor's own line.
 *
 * Each file is a module. Sucrase turns its first import of a module into a
 * `require` at that import's line, a later import of the same module into
 * names on it, and its exports into names set on `exports`. `require` reads a
 * published name, `@promptctl/rich-js/…`, from the live library, which holds
 * every entry point a live program may import and the optional peers they need
 * (`LIVE_LIBRARY_PACKAGES` in example-runner.ts), and a relative name from
 * the program's own files (`fileOf`), each run once, the first time it is
 * required, as Node runs a module.
 *
 * Each file runs through a direct `eval` inside the program, so it sees the
 * simulated process's `process` and the library as names in scope, under a
 * `//# sourceURL` naming it by its file's name: an engine counts that source's
 * lines from the file's first, so the stack of an error thrown in it names the
 * visitor's own file and line. The entry is wrapped in an async function, begun
 * on that first line, so the visitor may `await` at its top level; any other
 * file is required as Node requires a module, and runs to its end before the
 * import that required it returns, so a top-level `await` in one does not parse.
 *
 * [LAW:dataflow-not-control-flow] Code that does not compile is a script too:
 * one that throws the syntax error at its line. A run always has a program,
 * and a terminal shows every failure the one way it shows a crash.
 */
import { transform } from "sucrase";
import { LIBRARY_BINDING } from "../live-library.js";
import { PLAYGROUND_SOURCE, type ProgramFiles } from "../example-card.js";

/** `source` as a program of one file, as a docs block's card runs it. */
export const oneSource = (source: string): ProgramFiles => [{ name: PLAYGROUND_SOURCE, source }];

/** A file's code, stripped of its types, or where it failed to parse. */
type Compiled =
  | { readonly kind: "compiled"; readonly code: string }
  | { readonly kind: "refused"; readonly message: string; readonly line: number; readonly column: number };

/** Sucrase's parse error: a SyntaxError carrying where it is, both counted from 1. */
interface ParseError extends SyntaxError {
  readonly loc: { readonly line: number; readonly column: number };
}

const isParseError = (error: unknown): error is ParseError => error instanceof SyntaxError && "loc" in error;

function compile(source: string): Compiled {
  try {
    return { kind: "compiled", code: transform(source, { transforms: ["typescript", "imports"] }).code };
  } catch (error) {
    // [LAW:no-silent-failure] Only a parse error is the visitor's; anything
    // else Sucrase throws is a fault here, and stays one.
    if (!isParseError(error)) throw error;
    // Sucrase ends its message with where, which the stack says already.
    return { kind: "refused", message: error.message.replace(/ \(\d+:\d+\)$/, ""), line: error.loc.line, column: error.loc.column };
  }
}

/**
 * The name of the file `specifier`, a relative import, names when the file
 * named `importer` makes it: a path from the entry's directory, the `.js` an
 * import spells it with read as the `.ts` it is compiled from, as Node runs a
 * demo compiled into `dist-demo/`. The build names a demo's files with it
 * (demo-card.ts), and the program resolves its imports with it, so the two
 * agree on every name.
 *
 * Written into the program as source, so it uses nothing but its own names.
 */
export function fileOf(specifier: string, importer: string): string {
  const parts = importer.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    // `..` leaves the directory it is in, or, above the entry's, climbs past it.
    if (part === ".." && parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/").replace(/\.js$/, ".ts");
}

/** A file of a program as it is run: its name, and its code compiled and wrapped as the function `evaluate` makes of it. */
interface Module {
  readonly name: string;
  readonly wrapped: string;
}

/**
 * Runs a program: `files`, the entry first, each a function of its `require`
 * and its `exports` once `evaluate` has read it, on `library`. It is written
 * into the program as source, so it may use nothing but its own names and the
 * globals: `fileOf` is handed in, since a minifier renames what this calls by
 * a name from outside it.
 */
function run(
  library: Readonly<Record<string, object>>,
  files: readonly Module[],
  evaluate: (wrapped: string) => (require: unknown, exports: object) => unknown,
  fileOf: (specifier: string, importer: string) => string,
) {
  const packages = new Map(Object.entries(library));
  const sources = new Map(files.map((file) => [file.name, file.wrapped]));
  const loaded = new Map<string, object>();
  const requireIn =
    (importer: string) =>
    (specifier: string): object => {
      if (!specifier.startsWith(".")) {
        const module = packages.get(specifier);
        if (module === undefined) {
          throw new Error(`Cannot find module '${specifier}'. The playground can import ${[...packages.keys()].join(", ")}.`);
        }
        return module;
      }
      const name = fileOf(specifier, importer);
      const done = loaded.get(name);
      if (done !== undefined) return done;
      const wrapped = sources.get(name);
      if (wrapped === undefined) {
        throw new Error(`Cannot find module '${specifier}' imported by ${importer}. The program's files are ${[...sources.keys()].join(", ")}.`);
      }
      // Kept before it runs, so a file required again while it runs, by an
      // import cycle, gets the exports set so far, as in Node.
      const exports = {};
      loaded.set(name, exports);
      evaluate(wrapped)(requireIn(name), exports);
      return exports;
    };
  const [entry] = files;
  const exports = {};
  loaded.set(entry!.name, exports);
  return evaluate(entry!.wrapped)(requireIn(entry!.name), exports);
}

/**
 * The file and line of the visitor's code a failure's report names first: the
 * innermost frame of the stack that is in one of `names`, every engine writing
 * a frame as the source's name, its line and its column. `null` when no frame
 * is the visitor's, as for a failure raised wholly inside the library.
 */
export function thrownAt(report: string, names: readonly string[]): { readonly file: string; readonly line: number } | null {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));
  const frame = new RegExp(`(?:^|[\\s(])(${escaped.join("|")}):(\\d+):\\d+`, "m").exec(report);
  return frame === null ? null : { file: frame[1]!, line: Number(frame[2]) };
}

/**
 * A visitor's program as a live terminal takes it: the script that runs it,
 * or, for a file that does not parse, the report a run of it would crash
 * with, naming the file and line when the parse that failed knows them.
 */
export type PlaygroundProgram =
  | {
      readonly kind: "runs";
      readonly script: string;
      /** Each file's code as compiled, each import it runs a `require`. */
      readonly modules: readonly { readonly name: string; readonly code: string }[];
    }
  | { readonly kind: "refused"; readonly message: string; readonly report: string };

/** `files` compiled and wrapped, or the first that does not parse. */
function modules(files: ProgramFiles): { readonly kind: "runs"; readonly modules: readonly (Module & { readonly code: string })[] } | Extract<PlaygroundProgram, { kind: "refused" }> {
  const compiled: (Module & { readonly code: string })[] = [];
  for (const [i, { name, source }] of files.entries()) {
    const file = compile(source);
    if (file.kind === "refused") {
      // The stack is only the visitor's line: the frames of this script would point at code they never wrote.
      const { message, line, column } = file;
      return { kind: "refused", message, report: `SyntaxError: ${message}\n    at ${name}:${line}:${column}` };
    }
    const wrapped = `(${i === 0 ? "async " : ""}(require, exports) => {${file.code}\n})\n//# sourceURL=${name}`;
    // [LAW:single-enforcer] Sucrase passes what only a module may say,
    // `import.meta`, and the eval then refuses it, as it refuses an `await`
    // outside the entry. The eval's own parser is asked here, running
    // nothing, so an edit and the build (example-runner.ts) are refused the
    // one way.
    try {
      new Function(wrapped);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return { kind: "refused", message: error.message, report: `SyntaxError: ${error.message}\n    at ${name}` };
    }
    compiled.push({ name, wrapped, code: file.code });
  }
  return { kind: "runs", modules: compiled };
}

/**
 * `files`, a visitor's TypeScript, on `library`, the live library's script.
 * A file that does not parse refuses the program here, for a caller that keeps
 * what is on screen rather than run it (theme/RichExample.ts).
 */
export function playgroundProgram(files: ProgramFiles, library: string): PlaygroundProgram {
  const made = modules(files);
  if (made.kind === "refused") return made;
  const wrappedFiles = JSON.stringify(made.modules.map(({ name, wrapped }) => ({ name, wrapped })));
  // A direct eval, here in the program, where each file sees `process` and the library.
  const script = [library, `await (${run})(${LIBRARY_BINDING}, ${wrappedFiles}, (wrapped) => eval(wrapped), ${fileOf});`].join("\n");
  return { kind: "runs", script, modules: made.modules.map(({ name, code }) => ({ name, code })) };
}

/**
 * The script that runs `files` on `library`, as `playgroundProgram` makes
 * it; a file that does not parse is a script that throws the syntax error at
 * its line.
 */
export function playgroundScript(files: ProgramFiles, library: string): string {
  const program = playgroundProgram(files, library);
  if (program.kind === "runs") return program.script;
  return `throw Object.assign(new SyntaxError(${JSON.stringify(program.message)}), { stack: ${JSON.stringify(program.report)} });`;
}
