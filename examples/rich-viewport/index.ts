/**
 * rich-viewport — node bootstrap. Constructs the node TerminalHost and runs the
 * shared demo body against it until Ctrl-C.
 *
 * [LAW:one-source-of-truth] The demo logic lives in app.ts. This file owns
 * only the node-side host wiring and process lifecycle; the browser bootstrap
 * (wire.ts) is its mirror image.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();

let demo: ReturnType<typeof runDemo>;
try {
  demo = runDemo(host);
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
