/**
 * What a demo is on the site: a directory under `examples/` holding the file
 * it runs from, in its card (demo-card.ts), and under its `npm run` script
 * unless a `node.ts` beside it runs the same program with what a page cannot
 * do. A module of its own so the readers of the demo list — the sidebar
 * (config.ts), the demo routes (demos/[demo].paths.ts), the Demos index
 * (demos.data.ts) and the e2e gate — load it without the docs' example
 * pipeline that builds the card.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEMO_ENTRY = "main.ts";

const EXAMPLES = fileURLToPath(new URL("../../examples", import.meta.url));

/**
 * [LAW:one-source-of-truth] The site's one list of demos, read off the tree:
 * every directory under `examples/` with a `DEMO_ENTRY`, by name. Empty is
 * never a true answer — it means `EXAMPLES` or `DEMO_ENTRY` stopped matching
 * the tree — so it throws rather than handing every reader nothing to check.
 */
export function demoNames(): readonly string[] {
  const names = readdirSync(EXAMPLES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(EXAMPLES, entry.name, DEMO_ENTRY)))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) throw new Error(`no demos: no ${EXAMPLES}/*/${DEMO_ENTRY}`);
  return names;
}
