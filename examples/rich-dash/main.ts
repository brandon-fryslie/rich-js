/**
 * rich-dash: a dashboard of ticking panels — host vitals, this repository's
 * build pipeline, and its README rendered as Markdown. `q` quits.
 *
 * The entry for the demo's card on the docs site. A page has no file system
 * and no host to report on, so it reads what is staged under `staging/`: a
 * build runner's vitals and this repository's README. `npm run dash` runs
 * `node.ts`, which reads the real ones.
 */
import { systemClock } from "@promptctl/rich-js";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { MemoryFileSystem } from "../_capabilities/memory-file-system.js";
import { run } from "./app.js";
import { README } from "./staging/readme.js";
import { StagedSystemInfo } from "./staging/vitals.js";

// The card has no shell to return to, so say the program ended.
const host = new NodeTerminalHost();
const fs = new MemoryFileSystem({ home: "/home/demo", root: { kind: "directory", children: { "README.md": { kind: "file", content: README } } } });
const clock = systemClock();
const sysinfo = new StagedSystemInfo(() => clock.now() * 1000);
await run(host, { clock, fs, sysinfo, readmePath: fs.join(fs.homeDir(), "README.md") }).done;
host.write("rich-dash has quit.\n");
