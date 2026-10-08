/**
 * The cards of the effects playground page (docs/effects-playground.md): one
 * for each of the library's effects, each a program a reader edits and tunes,
 * running in the card's live terminal.
 *
 * Each card's entry is its effect's program, made from the library's own
 * source (examples/effects-playground/programs.ts) rather than read from a
 * file, named for the effect, and set in `examples/effects-playground/` beside
 * the kit it imports; its other tabs are the files it reaches from there, as a
 * demo's are (`cardProgram` in demo-card.ts). Their terminal's size, their
 * sliders and their contrast are that directory's `card.json`.
 */
import path from "node:path";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { EFFECTS, type EffectName } from "../../examples/effects-feel/vocabulary.js";
import { effectPrograms } from "../../examples/effects-playground/programs.js";
import { cardJson, cardLibrary, cardProgram, type DemoCard } from "./demo-card.js";
import { RUNNING } from "./example-card.js";
import { playgroundHref } from "./example-runner.js";
import { encodeProgram } from "./playground-hash.js";

/** The directory every effect's card is set in. */
export const EFFECTS_DIRECTORY = path.join(REPO_ROOT, "examples", "effects-playground");

/** The page the cards are on, as the docs build names a page. */
export const EFFECTS_PAGE = "effects-playground.md";

/** One effect's card, and the effect it is. */
export interface EffectCard {
  readonly effect: EffectName;
  readonly card: DemoCard;
}

/** Every effect's card, in the order the effects-feel demo lists them. */
export async function effectCards(): Promise<readonly EffectCard[]> {
  const { terminal, options } = cardJson(EFFECTS_DIRECTORY);
  const { script } = await cardLibrary();
  const programs = effectPrograms();
  const playground = playgroundHref(EFFECTS_PAGE);
  return Promise.all(
    EFFECTS.map(async (effect) => {
      const program = cardProgram(EFFECTS_DIRECTORY, { name: `${effect}.ts`, code: programs[effect] }, terminal, script);
      return { effect, card: { run: "browser", program, options, ...RUNNING, tryIt: { playground, program: await encodeProgram(program) } } };
    }),
  );
}
