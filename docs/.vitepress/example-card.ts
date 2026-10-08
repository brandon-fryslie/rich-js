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

/** The caption of output a card's code printed when it ran: an edit's, or the page's own unless its marker says more. */
export const RAN = "produced by running the code above";

/** What a card says in place of output when its code printed nothing. */
export const PRINTS_NOTHING = "This example prints nothing when it runs.";

/**
 * One block's card, by where its marker says the block runs
 * (example-markers.ts). A block the build runs is editable; one that runs
 * nowhere is the same card, read-only, its note in place of output.
 */
export type CardData =
  | {
      readonly run: "build";
      /** The block as the page shows it. */
      readonly code: string;
      readonly setup: CardSetup;
      /** What the block printed at build time; null if it printed nothing (`drawOutput`). */
      readonly output: Drawn | null;
      /** The output panel's label and the caption beside it. */
      readonly label: string;
      readonly caption: string;
      /** Where "Try it" goes: the playground, and the hash that opens the block's program in it. */
      readonly tryIt: { readonly playground: string; readonly program: string };
    }
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
