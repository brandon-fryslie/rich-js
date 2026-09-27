/**
 * rich-viewport — node bootstrap. Constructs the node TerminalHost and runs the
 * shared demo body against it until Ctrl-C.
 *
 * [LAW:one-source-of-truth] The demo logic lives in app.ts. This file owns
 * only the node-side host wiring; the browser bootstrap (wire.ts) is its
 * mirror image.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();
const demo = runDemo(host);
process.once("SIGINT", () => {
  demo.stop();
  host.stop();
});
