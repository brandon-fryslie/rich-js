/**
 * What the build hands an example card (theme/RichExample.ts), and the
 * program the card runs when a reader edits its code.
 *
 * The card's program is the setup its block runs on above it, in groups by
 * where each came from (example-slice.ts), then whatever the editor holds,
 * then the scopes that setup opened, closed. The editor holds the block as the
 * page shows it, its imports included, so the setup imports only what the
 * block does not, and an import may land inside the setup's scopes; the
 * playground's script turns each module's first import into a `require` where
 * it stands, and a later import of a module already required into a name on
 * that one (theme/playground-program.ts), which runs as well there as at the top.
 *
 * [LAW:one-source-of-truth] The build runs this same composition of the
 * unedited block and holds it to the bytes the page shows
 * (`tryItPrints` in example-runner.ts), so the output a card shows at rest is
 * the output its program prints.
 *
 * Pure and dependency-free: the build reads it in Node, the card in the page.
 */
import type { Drawn } from "./example-fragments.js";

/** Lines of a card's setup that came from one place, named as the card labels them: "imports", "from 'Basic usage'". */
export interface SetupGroup {
  readonly origin: string;
  /** The group's lines, ending in the blank line that parts it from what follows (and, last, any brace opening the block's scope). */
  readonly lines: readonly string[];
}

/** The program around a card's block: the groups above it, and the lines below it that close their scopes. */
export interface CardSetup {
  readonly before: readonly SetupGroup[];
  readonly after: readonly string[];
}

/** The setup of a program that runs on nothing: every line of it is the reader's. */
export const NO_SETUP: CardSetup = { before: [], after: [] };

/**
 * One file of a card's program: its name, the setup its code runs on, and the
 * code a reader edits. A file's name is its path from the entry's directory,
 * the way an import between the program's files spells it (`app.ts`,
 * `../_capabilities/memory-file-system.ts`), and the name a thrown error's
 * stack gives its lines. Only a docs block has a setup; every file of a demo
 * is all the reader's, `NO_SETUP`.
 */
export interface CardFile {
  readonly name: string;
  readonly setup: CardSetup;
  readonly code: string;
}

/**
 * What a card edits: its files, the entry first, each shown as a tab. A docs
 * card's program is one file, its block in the setup the block runs on, and
 * it shows no tabs. "Try it" carries one to the playground
 * (playground-hash.ts), which opens it as the card held it, the setup still
 * locked and labelled.
 */
export interface CardProgram {
  readonly files: readonly [CardFile, ...CardFile[]];
}

/** The name of a docs block's one file. */
export const PLAYGROUND_SOURCE = "playground.ts";

/** A one-file program: `code`, in `setup`. */
export const oneFile = (setup: CardSetup, code: string): CardProgram => ({ files: [{ name: PLAYGROUND_SOURCE, setup, code }] });

/** What a reader has made of a program's files: the code of each, in the program's order. */
export type Codes = readonly string[];

/** The code of each of `program`'s files. */
export const codesOf = (program: CardProgram): Codes => program.files.map((file) => file.code);

export const sameCodes = (a: Codes, b: Codes): boolean => a.length === b.length && a.every((code, i) => code === b[i]);

/** `program` with `codes` in place of its files' code. */
export const withCodes = (program: CardProgram, codes: Codes): CardProgram => {
  const [entry, ...rest] = program.files;
  return { files: [{ ...entry, code: codes[0]! }, ...rest.map((file, i) => ({ ...file, code: codes[i + 1]! }))] };
};

/** One file of a program as it runs: its name, and its source, its code in its setup (`cardSource`). */
export interface ProgramFile {
  readonly name: string;
  readonly source: string;
}

/** A program's files as it runs: one at least, the entry first. */
export type ProgramFiles = readonly [ProgramFile, ...ProgramFile[]];

/** The files `program` runs as. */
export function programFiles(program: CardProgram): ProgramFiles {
  const run = (file: CardFile): ProgramFile => ({ name: file.name, source: cardSource(file.setup, file.code) });
  const [entry, ...rest] = program.files;
  return [run(entry), ...rest.map(run)];
}

/** The caption of output a card's code printed when it ran: an edit's, or the page's own unless its marker says more. */
export const RAN = "produced by running the code above";

/** A card's output panel's label and caption, for output drawn from what its code printed. */
export const DRAWN = { label: "Output", caption: RAN } as const;

/** A card's output panel's label and caption, for its program running in a live terminal: a `live` block's, or a playground program that animates or reads input. */
export const RUNNING = { label: "Live", caption: "the code above, running in your browser" } as const;

/** What a card says in place of output when its code printed nothing. */
export const PRINTS_NOTHING = "This example prints nothing when it runs.";

/** What every card a reader can edit carries: its program, and the panel under it. */
interface Editable {
  /** The program as the page shows it: a docs block's, one file holding the block as the page shows it. */
  readonly program: CardProgram;
  /** The output panel's label and the caption beside it. */
  readonly label: string;
  readonly caption: string;
  /** Where "Try it" goes: the playground, and the hash that opens the block's program in it. */
  readonly tryIt: { readonly playground: string; readonly program: string };
}

/**
 * One block's card, by where its marker says the block runs
 * (example-markers.ts). A block the build runs is editable, its output the
 * one the build printed until it is edited. A block that runs in the browser
 * is editable, its output its program running in a live terminal of
 * `columns` columns. One that runs nowhere is the same card, read-only, its
 * note in place of output.
 */
export type CardData =
  | (Editable & {
      readonly run: "build";
      /** What the block printed at build time; null if it printed nothing (`drawOutput`). */
      readonly output: Drawn | null;
    })
  | (Editable & { readonly run: "browser"; readonly columns: number })
  | { readonly run: "never"; readonly label: string; readonly note: string };

/** The lines above a card's block, in order. */
export const setupLines = (setup: CardSetup): string[] => setup.before.flatMap((group) => group.lines);

/** The program a card runs: `code` in the place of its block's lines. */
export function cardSource(setup: CardSetup, code: string): string {
  return [...setupLines(setup), code, ...setup.after].join("\n");
}

/** How many characters of a card's program stand before its block, and how many after it, whatever the block holds. */
export function blockSpan(setup: CardSetup): { readonly before: number; readonly after: number } {
  const length = (lines: readonly string[]) => lines.reduce((sum, line) => sum + line.length + 1, 0);
  return { before: length(setupLines(setup)), after: length(setup.after) };
}

/** The block in `program`, a card's program around it. */
export function blockOf(setup: CardSetup, program: string): string {
  const { before, after } = blockSpan(setup);
  return program.slice(before, program.length - after);
}
