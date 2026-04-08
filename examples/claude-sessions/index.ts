/**
 * claude-sessions — TUI browser for Claude Code session JSONL files in
 * ~/.claude/projects/. Combines a project/session sidebar, a pretty-printed
 * conversation viewer with per-block expand/raw toggles, and local search.
 */

import { run } from "./app.js";

run().catch((err) => {
  process.stderr.write(
    `claude-sessions error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
