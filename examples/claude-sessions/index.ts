/**
 * claude-sessions — TUI browser for Claude Code session JSONL files in
 * ~/.claude/projects/. Combines a project/session sidebar, a pretty-printed
 * conversation viewer with per-block expand/raw toggles, and local search.
 *
 * Node entry: constructs the node-backed `TerminalHost` and `FileSystem`
 * capabilities and hands them to the shared demo body.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { installTraceback } from "../../src/node/traceback.js";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { run } from "./app.js";

// [LAW:single-enforcer] One crash renderer for this demo, registered before
// anything can throw. Because it covers `unhandledRejection` as well as
// `uncaughtException`, `run`'s promise needs no `.catch` — a rejection is a
// crash, and crashes are this handler's job.
installTraceback();

void run(new NodeTerminalHost(), new NodeFileSystem());
