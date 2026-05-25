/**
 * rich-dash — node bootstrap.
 *
 * [LAW:locality-or-seam] The entrypoint owns process lifecycle: signal
 * handling and exit live here, not inside the runtime, so the runtime stays
 * embeddable in tests and the browser bootstrap.
 */

import { NodeTerminalHost } from "../../src/index.js";
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
