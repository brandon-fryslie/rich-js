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
import { REPO_ROOT } from "../../scripts/repo-facts.js";

export const DEMO_ENTRY = "main.ts";

const EXAMPLES = path.join(REPO_ROOT, "examples");

/**
 * [LAW:one-source-of-truth] The site's one list of demos, read off the tree:
 * every directory under `examples/` with a `DEMO_ENTRY`, by name. A `_`
 * directory is shared code, not a demo.
 */
export function demoNames(): readonly string[] {
  return readdirSync(EXAMPLES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && existsSync(path.join(EXAMPLES, entry.name, DEMO_ENTRY)))
    .map((entry) => entry.name)
    .sort();
}
