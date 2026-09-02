/**
 * rich-explore — TUI file browser + markdown/code reader. Usage:
 *   `npm run demo -- [path]` (defaults to cwd).
 *
 * Node entry: constructs the node-backed `TerminalHost` and `FileSystem`
 * capabilities and hands them to the shared demo body. The browser entry
 * lives in `wire.ts` and constructs `BrowserTerminalHost` + `MemoryFileSystem`.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { run } from "./app.js";

const fs = new NodeFileSystem();
const startPath = fs.resolve(process.argv[2] ?? process.cwd());

run(new NodeTerminalHost(), fs, startPath).catch((err) => {
  process.stderr.write(
    `rich-explore error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
