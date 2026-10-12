/**
 * claude-sessions: a browser for Claude Code session JSONL files — a
 * project/session sidebar, a conversation viewer with per-block expand and raw
 * toggles, and search. `q` quits.
 *
 * The entry for the demo's card on the docs site. A page has no file system,
 * so it reads `fixture.ts`; `npm run sessions` runs `node.ts`, which reads
 * `~/.claude/projects/`.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { MemoryFileSystem } from "../_capabilities/memory-file-system.js";
import { run } from "./app.js";
import { FIXTURE_TREE } from "./fixture.js";

// The card has no shell to return to, so say the program ended.
const host = new NodeTerminalHost();
await run(host, new MemoryFileSystem(FIXTURE_TREE)).done;
host.write("claude-sessions has quit.\n");
