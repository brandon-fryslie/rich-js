/**
 * rich-explore in Node: the explorer `main.ts` runs, over the real file system,
 * from the directory given (`npm run demo -- <path>`) or the current one.
 *
 * Reading files is what a page cannot do, so it lives here and not in `main.ts`.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { run } from "./app.js";

const fs = new NodeFileSystem();
await run(new NodeTerminalHost(), fs, fs.resolve(process.argv[2] ?? process.cwd())).done;
