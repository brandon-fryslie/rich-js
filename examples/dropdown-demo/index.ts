/**
 * dropdown-demo — node bootstrap. Constructs `NodeTerminalHost`, runs the
 * shared demo body, and wires SIGINT/SIGTERM into a clean shutdown.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: demo:dropdown requires an interactive terminal.\n");
  process.exit(1);
}

host.start();

const shutdown = (): void => {
  demo.stop();
  host.stop();
  process.exit(0);
};

const demo = runDemo(host, { onShutdown: shutdown });

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
