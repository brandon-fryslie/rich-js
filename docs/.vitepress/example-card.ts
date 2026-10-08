/**
 * What the build hands an editable example card (theme/RichExample.ts), and
 * the program the card runs when a reader edits its code.
 *
 * The card's program is the block's "Try it" program (example-slice.ts) with
 * the block's own lines replaced by whatever the editor holds: the setup the
 * block runs on above it, and the scopes that setup opened closed below it.
 * The editor holds the block as the page shows it, its imports included, so
 * an import lands inside the setup's scopes; the playground's script turns
 * every import into a `require` where it stands (theme/playground-program.ts),
 * which runs as well there as at the top.
 *
 * [LAW:one-source-of-truth] The build runs this same composition of the
 * unedited block and holds it to the bytes the page shows
 * (`tryItPrints` in example-runner.ts), so the output a card shows at rest is
 * the output its program prints.
 *
 * Pure and dependency-free: the build reads it in Node, the card in the page.
 */
import type { Drawn } from "./example-fragments.js";

/** The "Try it" program around its block: the lines above the block's, and the lines below. */
export interface CardSetup {
  readonly before: readonly string[];
  readonly after: readonly string[];
}

/** One static block's card. */
export interface CardData {
  /** The block as the page shows it. */
  readonly code: string;
  readonly setup: CardSetup;
  /** What the block printed at build time. */
  readonly output: Drawn;
  /** The output panel's label and the caption beside it. */
  readonly label: string;
  readonly caption: string;
  /** The playground address that opens the block's "Try it" program. */
  readonly tryIt: string;
}

/** The program a card runs: `code` in the place of its block's lines. */
export function cardSource(setup: CardSetup, code: string): string {
  return [...setup.before, code, ...setup.after].join("\n");
}

/**
 * The line of the card's code that `programLine`, a 1-based line of
 * `cardSource(setup, code)`, is; `null` for a line of the setup.
 */
export function codeLine(setup: CardSetup, code: string, programLine: number): number | null {
  const line = programLine - setup.before.length;
  return line >= 1 && line <= code.split("\n").length ? line : null;
}
