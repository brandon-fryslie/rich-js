/**
 * claude-sessions in Node: the viewer `main.ts` runs, over this machine's
 * `~/.claude/projects/`.
 *
 * Reading files is what a page cannot do, so it lives here and not in
 * `main.ts`.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { installTraceback } from "@promptctl/rich-js/node/traceback";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { run } from "./app.js";

// [LAW:single-enforcer] One crash renderer for this demo, and it covers
// `unhandledRejection`, so `done` needs no `.catch`.
installTraceback();

await run(new NodeTerminalHost(), new NodeFileSystem()).done;
