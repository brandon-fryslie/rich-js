/**
 * rich-dash: a dashboard of ticking panels — host vitals, a fake build
 * pipeline, and a README rendered as Markdown. `q` quits.
 *
 * The entry for the demo's card on the docs site. A page has no file system
 * and no host to report on, so it reads `fixture.ts`; `npm run dash` runs
 * `node.ts`, which reads the real ones.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { MemoryFileSystem } from "../_capabilities/memory-file-system.js";
import { MemorySystemInfo } from "../_capabilities/memory-system-info.js";
import { run } from "./app.js";
import { FIXTURE_TREE, SYSINFO_SNAPSHOT } from "./fixture.js";

// The card has no shell to return to, so say the program ended.
const host = new NodeTerminalHost();
const fs = new MemoryFileSystem(FIXTURE_TREE);
const sysinfo = new MemorySystemInfo(SYSINFO_SNAPSHOT);
await run(host, { fs, sysinfo, readmePath: fs.join(fs.homeDir(), "README.md") }).done;
host.write("rich-dash has quit.\n");
