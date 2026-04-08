/**
 * rich-explore — TUI file browser + markdown/code reader.
 * Entry point. Usage: `npm run demo -- [path]` (defaults to cwd).
 */

import { resolve } from "node:path";
import { run } from "./app.js";

const startPath = resolve(process.argv[2] ?? process.cwd());

run(startPath).catch((err) => {
  process.stderr.write(
    `rich-explore error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
