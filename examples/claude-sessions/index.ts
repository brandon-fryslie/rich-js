/**
 * claude-sessions — TUI browser for Claude Code session JSONL files in
 * ~/.claude/projects/. Combines a project/session sidebar, a pretty-printed
 * conversation viewer with per-block expand/raw toggles, and local search.
 *
 * Node entry: constructs the node-backed `TerminalHost` and `FileSystem`
 * capabilities and hands them to the shared demo body.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { run } from "./app.js";

run(new NodeTerminalHost(), new NodeFileSystem()).catch((err) => {
  process.stderr.write(
    `claude-sessions error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
