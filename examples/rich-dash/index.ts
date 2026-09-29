/**
 * rich-dash — node bootstrap.
 *
 * The app hands the terminal back when the program ends under it — a
 * signal, a crash — so this entry owns only the node-only capabilities and
 * the exit code of a run that failed.
 *
 * [LAW:capabilities-over-context] Capabilities are instantiated here and
 * passed in. `app.ts` is identical between node and browser; only the
 * capability values differ.
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { NodeSystemInfo } from "../_capabilities/node-system-info.js";
import { run } from "./app.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fs = new NodeFileSystem();
// Source layout: examples/rich-dash/index.ts -> ../../README.md
// Compiled:      dist-demo/examples/rich-dash/index.js -> ../../../README.md
const readmePath =
  [fs.resolve(HERE, "../../README.md"), fs.resolve(HERE, "../../../README.md")]
    .find((p) => fs.exists(p)) ?? fs.resolve(HERE, "../../README.md");

run(new NodeTerminalHost(), { fs, sysinfo: new NodeSystemInfo(), readmePath }).catch((err) => {
  process.stderr.write(
    `rich-dash error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
