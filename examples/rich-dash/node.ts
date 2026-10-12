/**
 * rich-dash in Node: the dashboard `main.ts` runs, over this machine's vitals
 * and this repository's README.
 *
 * Reading files and the host is what a page cannot do, so it lives here and
 * not in `main.ts`.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { NodeFileSystem } from "../_capabilities/node-file-system.js";
import { NodeSystemInfo } from "../_capabilities/node-system-info.js";
import { run } from "./app.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fs = new NodeFileSystem();
// Source: examples/rich-dash/ -> ../../README.md
// Built:  dist-demo/examples/rich-dash/ -> ../../../README.md
const readmePath =
  [fs.resolve(HERE, "../../README.md"), fs.resolve(HERE, "../../../README.md")]
    .find((p) => fs.exists(p)) ?? fs.resolve(HERE, "../../README.md");

await run(new NodeTerminalHost(), { fs, sysinfo: new NodeSystemInfo(), readmePath }).done;
