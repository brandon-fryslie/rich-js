/**
 * terminal-host on this process's terminal: the entry for `npm run
 * terminal-host` and for the demo's card, where the terminal is the card's.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { inspectKeys } from "./app.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: terminal-host requires an interactive terminal.\n");
  process.exit(1);
}

host.start();
await inspectKeys(host);
host.stop();
