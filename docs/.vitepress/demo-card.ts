/**
 * A demo directory under `examples/` as the card its page on the docs site
 * shows (theme/RichExample.ts's `RichDemo`): every file of it a tab, each
 * editable, the program running in the card's live terminal.
 *
 * A demo is a Node program, and the card runs that same program unchanged:
 *
 * - `examples/<name>/main.ts` is its entry, for the card and for its
 *   `npm run` script alike (`DEMO_ENTRY`).
 * - It builds its own terminal, `new NodeTerminalHost()`, or prints through a
 *   `new Console()`. In the card it runs on the stand-in process
 *   (simulated-process.ts), which gives it the card's terminal, its size,
 *   its keys and its colour depth, so nothing in a demo asks where it runs.
 * - It imports the library by its published names, `@promptctl/rich-js` and
 *   its subpaths, never `../../src/…`, and its own files by relative `./x.js`.
 *   In the card a published name is the live library's
 *   (`LIVE_LIBRARY_PACKAGES` in example-runner.ts) and a relative one is
 *   another of the card's files (`fileOf`); in Node, scripts/build-demos.ts
 *   compiles both onto `src/`. The coverage gate (test/coverage/) resolves the
 *   published names to `src/` too, so they demonstrate what they import.
 * - Its tabs are the entry, then every other file it reaches by a relative
 *   import, each named by its path from the entry's directory, a file shared
 *   from `examples/_capabilities/` included. A demo of one file shows no tabs.
 *
 * [LAW:single-enforcer] A demo is held to running in the card here, at
 * build: an import the live library does not hold, or one by `import()`,
 * fails the docs build naming the file and the import.
 */
import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { NO_SETUP, RUNNING, type CardData, type CardFile, type CardProgram } from "./example-card.js";
import { EXAMPLE_TERMINAL } from "./example-terminal.js";
import { playgroundHref, refuseOffLibrary } from "./example-runner.js";
import { encodeProgram } from "./playground-hash.js";
import { fileOf } from "./theme/playground-program.js";

/** The file a demo directory runs from, in the card and in Node. */
export const DEMO_ENTRY = "main.ts";

/** A demo's card: a program the browser runs in a live terminal. */
export type DemoCard = Extract<CardData, { readonly run: "browser" }>;

/** Each import `source`, the file `name`, makes of a module by name: its specifier, and its clause, which a bare import has none of. */
function imports(name: string, source: string): { readonly specifier: string; readonly clause: ts.ImportClause | undefined; readonly typeOnly: boolean }[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: ReturnType<typeof imports> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      throw new Error(`${name}: a demo imports only with \`import\` declarations, not \`import()\``);
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const typeOnly = ts.isImportDeclaration(node) ? clause?.isTypeOnly === true : node.isTypeOnly;
      found.push({ specifier: (node.moduleSpecifier as ts.StringLiteral).text, clause, typeOnly });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/**
 * The program of the demo in `directory`: its entry and every file it reaches
 * by a relative import, in the order it reaches them. Every import of a
 * package is one the live library answers, or only of types, which running
 * drops.
 */
export function demoProgram(directory: string): CardProgram {
  const files: CardFile[] = [];
  const reached = new Set<string>();
  const reach = (name: string): void => {
    if (reached.has(name)) return;
    reached.add(name);
    const code = readFileSync(path.join(directory, name), "utf-8");
    files.push({ name, setup: NO_SETUP, code });
    const at = path.relative(REPO_ROOT, path.join(directory, name));
    for (const { specifier, clause, typeOnly } of imports(at, code)) {
      if (specifier.startsWith(".")) reach(fileOf(specifier, name));
      else if (!typeOnly) refuseOffLibrary(at, specifier, clause);
    }
  };
  reach(DEMO_ENTRY);
  const [entry, ...rest] = files;
  return { files: [entry!, ...rest] };
}

/** The card the page of the demo in `examples/<demo>/` shows. */
export async function demoCard(demo: string): Promise<DemoCard> {
  const program = demoProgram(path.join(REPO_ROOT, "examples", demo));
  return {
    run: "browser",
    program,
    ...RUNNING,
    tryIt: { playground: playgroundHref(`demos/${demo}.md`), program: await encodeProgram(program) },
    columns: EXAMPLE_TERMINAL.columns,
  };
}
