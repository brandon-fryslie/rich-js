/**
 * A demo directory under `examples/` as the card its page on the docs site
 * shows (theme/RichExample.ts's `RichDemo`): every file of it a tab, each
 * editable, the program running in the card's live terminal.
 *
 * A demo is a Node program, and the card runs that same program unchanged:
 *
 * - `examples/<name>/main.ts` is its entry, for the card and for its
 *   `npm run` script alike (`DEMO_ENTRY`, demo-entry.ts).
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
 * - Its card's terminal is the size `card.json` beside its entry gives
 *   (`cardJson`), which the demo is drawn to fit; the same file may turn on
 *   the card's sliders and say the contrast its terminal shows. A demo never takes the
 *   size as a parameter; it reads it off its terminal, as it does in Node.
 * - Its tabs are the entry, then every other file it reaches by a relative
 *   import, each named by its path from the entry's directory, a file shared
 *   from `examples/_capabilities/` included. A demo of one file shows no tabs.
 *
 * [LAW:single-enforcer] A demo is held to running in the card here, at
 * build, by the check every live docs block passes (`refuseUnrunnable`): the
 * card's compile refusing a file, or an import neither the live library nor
 * the demo's files answer, fails the docs build naming the file.
 */
import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { DEMO_ENTRY } from "./demo-entry.js";
import { CONTRASTS, NO_SETUP, PLAIN_CARD, RUNNING, type CardData, type CardFile, type CardOptions, type CardProgram } from "./example-card.js";
import { liveLibraryOnce, playgroundHref, refuseUnrunnable } from "./example-runner.js";
import { encodeProgram } from "./playground-hash.js";
import { terminalSize } from "./terminal-size.js";
import { fileOf } from "./theme/playground-program.js";

/** A demo's card: a program the browser runs in a live terminal. */
export type DemoCard = Extract<CardData, { readonly run: "browser" }>;

/** Each module `source` imports or re-exports by a relative name. */
function relativeImports(name: string, source: string): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return file.statements.flatMap((node) =>
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.startsWith(".")
      ? [node.moduleSpecifier.text]
      : [],
  );
}

/**
 * The program whose entry is `entry`, a file of `directory`, and every file
 * it reaches by a relative import, in the order it reaches them, in
 * `screen`'s terminal, refused unless the card runs it on `library`, the live
 * library's script. A relative import may not leave `examples/`, the directory
 * `directory` is in, since a demo reaches the library by its published names.
 * The entry is handed in, so it need not be a file on disk: an effect's card
 * opens on a program made from the library's own source (effect-cards.ts).
 */
export function cardProgram(directory: string, entry: { readonly name: string; readonly code: string }, screen: Screen, library: string): CardProgram {
  const files: CardFile[] = [];
  const at = (name: string): string => path.relative(REPO_ROOT, path.join(directory, name));
  const reach = (name: string, code: string): void => {
    if (files.some((file) => file.name === name)) return;
    files.push({ name, setup: NO_SETUP, code });
    for (const specifier of relativeImports(at(name), code)) {
      const reached = fileOf(specifier, name);
      if (path.relative(path.dirname(directory), path.join(directory, reached)).startsWith("..")) {
        throw new Error(`${at(name)}: ${specifier} is outside examples/; a demo imports the library by its published names, @promptctl/rich-js and its subpaths`);
      }
      reach(reached, readFileSync(path.join(directory, reached), "utf-8"));
    }
  };
  reach(entry.name, entry.code);
  const [first, ...rest] = files;
  const program: CardProgram = { files: [first!, ...rest], ...screen };
  refuseUnrunnable(at, "its card runs it", program, library);
  return program;
}

/** The program of the demo in `directory`: its entry, `main.ts`, and what it reaches, in `screen`'s terminal (its `cardJson`'s). */
export function demoProgram(directory: string, screen: Screen, library: string): CardProgram {
  const entry = { name: DEMO_ENTRY, code: readFileSync(path.join(directory, DEMO_ENTRY), "utf-8") };
  return cardProgram(directory, entry, screen, library);
}

/** The file beside a card's entry that says what its card is. */
export const CARD_OPTIONS = "card.json";

/** The terminal a card's program runs in: its size and its contrast. */
export type Screen = Pick<CardProgram, "terminal" | "contrast">;

/** What a card.json says: the terminal the card's program runs in, and how the card shows it. */
export interface CardJson {
  readonly screen: Screen;
  readonly options: CardOptions;
}

/**
 * [LAW:parse-dont-validate] What `card.json` in `directory` says, or the
 * build fails naming the file: `{ "terminal": <size> }`, and optionally
 * `"sliders": true` and `"contrast": "as drawn"`, each otherwise as a docs
 * block's card has it (`PLAIN_CARD`, `oneFile`).
 */
export function cardJson(directory: string): CardJson {
  const file = path.join(directory, CARD_OPTIONS);
  try {
    const read: unknown = JSON.parse(readFileSync(file, "utf-8"));
    const { terminal, sliders = PLAIN_CARD.sliders, contrast = "readable", ...rest } =
      typeof read === "object" && read !== null ? (read as { readonly terminal?: unknown; readonly sliders?: unknown; readonly contrast?: unknown }) : {};
    const unknown = Object.keys(rest);
    if (unknown.length > 0) throw new Error(`it has no ${unknown.map((key) => JSON.stringify(key)).join(", ")}`);
    if (typeof sliders !== "boolean") throw new Error(`"sliders" is true or false`);
    const known = CONTRASTS.find((c) => c === contrast);
    if (known === undefined) throw new Error(`"contrast" is one of ${CONTRASTS.map((c) => JSON.stringify(c)).join(", ")}`);
    return { screen: { terminal: terminalSize(terminal), contrast: known }, options: { sliders } };
  } catch (error) {
    throw new Error(
      `${path.relative(REPO_ROOT, file)}: must be { "terminal": <size>, "sliders"?: <boolean>, "contrast"?: <contrast> }: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** The live library every demo's card is held to, built once for them all. */
export const cardLibrary = liveLibraryOnce();

/** The card the page of the demo in `examples/<demo>/` shows. */
export async function demoCard(demo: string): Promise<DemoCard> {
  const directory = path.join(REPO_ROOT, "examples", demo);
  const { screen, options } = cardJson(directory);
  const program = demoProgram(directory, screen, (await cardLibrary()).script);
  return {
    run: "browser",
    program,
    options,
    ...RUNNING,
    tryIt: { playground: playgroundHref(`demos/${demo}.md`), program: await encodeProgram(program) },
  };
}
