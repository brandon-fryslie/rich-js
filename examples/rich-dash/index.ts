/**
 * rich-dash — node bootstrap.
 *
 * [LAW:locality-or-seam] The entrypoint owns process lifecycle: signal
 * handling, exit, and node-only capability construction live here, not
 * inside the runtime, so the runtime stays embeddable in tests and the
 * browser bootstrap.
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
import { runDemo } from "./app.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fs = new NodeFileSystem();
// Source layout: examples/rich-dash/index.ts -> ../../README.md
// Compiled:      dist-demo/examples/rich-dash/index.js -> ../../../README.md
const readmePath =
  [fs.resolve(HERE, "../../README.md"), fs.resolve(HERE, "../../../README.md")]
    .find((p) => fs.exists(p)) ?? fs.resolve(HERE, "../../README.md");

const host = new NodeTerminalHost();
host.start();

let demo: ReturnType<typeof runDemo>;
try {
  demo = runDemo(host, {
    fs,
    sysinfo: new NodeSystemInfo(),
    readmePath,
  });
} catch (err) {
  host.stop();
  throw err;
}

const shutdown = (): void => {
  demo.stop();
  host.stop();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
