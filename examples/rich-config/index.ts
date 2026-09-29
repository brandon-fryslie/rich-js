/**
 * rich-config — node bootstrap. The app hands the terminal back on every
 * path out — Ctrl-C inside the demo, a signal, a crash — so there is nothing
 * to restore here.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: demo-inputs requires an interactive terminal.\n");
  process.exit(1);
}

void runDemo(host).done.then(() => host.write("\x1b[1;36mGoodbye!\x1b[0m\n"));
