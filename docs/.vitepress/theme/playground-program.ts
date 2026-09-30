/**
 * A visitor's TypeScript as the one script a live terminal runs: the live
 * library, then the visitor's code on it.
 *
 * Types are stripped, not checked. Running code needs no type-checker, and
 * whatever strips them is downloaded by every visitor to the playground, so
 * the stripper was chosen by its weight on the page, measured minified and
 * gzipped (`gzip -9`): Sucrase 48 KB, `typescript` 1.0 MB, esbuild-wasm 3.7 MB
 * (its wasm). Sucrase also leaves every line where it was, which is what lets
 * an error name the visitor's own line.
 *
 * The visitor imports the library by its published names. Sucrase turns each
 * import into a `require` at the import's line, and `require` reads the live
 * library, which holds every entry point a live program may import and the
 * optional peers they need (`LIVE_LIBRARY_PACKAGES` in example-runner.ts).
 *
 * The code runs through a direct `eval` inside the program, so it sees the
 * simulated process's `process` and the library as names in scope, under a
 * `//# sourceURL` naming it `PLAYGROUND_SOURCE`: an engine counts that
 * source's lines from the visitor's first, so the stack of an error thrown in
 * it names the visitor's own line. It is wrapped in an async function, begun
 * on that first line, so the visitor may `await` at the top level.
 *
 * [LAW:dataflow-not-control-flow] Code that does not compile is a script too:
 * one that throws the syntax error at its line. A run always has a program,
 * and a terminal shows every failure the one way it shows a crash.
 */
import { transform } from "sucrase";
import { LIBRARY_BINDING } from "../live-library.js";

/** The name the visitor's code runs under, and so the name an error's stack gives its lines. */
export const PLAYGROUND_SOURCE = "playground.ts";

/** A visitor's code, stripped of its types, or where it failed to parse. */
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
    return { kind: "refused", message: error.message, line: error.loc.line, column: error.loc.column };
  }
}

/**
 * The visitor's `require`, over the library. It is written into the program
 * as source, so it may use nothing but its own names and the globals.
 */
function requireFrom(library: Readonly<Record<string, object>>): (specifier: string) => object {
  const modules = new Map(Object.entries(library));
  return (specifier) => {
    const module = modules.get(specifier);
    if (module === undefined) {
      throw new Error(`Cannot find module '${specifier}'. The playground can import ${[...modules.keys()].join(", ")}.`);
    }
    return module;
  };
}

/** The script that runs `source`, a visitor's TypeScript, on `library`, the live library's script. */
export function playgroundScript(source: string, library: string): string {
  const compiled = compile(source);
  if (compiled.kind === "refused") {
    // The stack is only the visitor's line: the frames of this script would point at code they never wrote.
    const stack = `SyntaxError: ${compiled.message}\n    at ${PLAYGROUND_SOURCE}:${compiled.line}:${compiled.column}`;
    return `throw Object.assign(new SyntaxError(${JSON.stringify(compiled.message)}), { stack: ${JSON.stringify(stack)} });`;
  }
  const evaluated = `(async () => {${compiled.code}\n})\n//# sourceURL=${PLAYGROUND_SOURCE}`;
  return [
    library,
    `const require = (${requireFrom})(${LIBRARY_BINDING});`,
    `await eval(${JSON.stringify(evaluated)})();`,
  ].join("\n");
}
