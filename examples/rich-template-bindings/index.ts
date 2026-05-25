/**
 * rich-template-bindings — node bootstrap.
 *
 * [LAW:types-are-the-program] `onShutdown` does not reference `demo` — the
 * demo has already torn down its own state before invoking it.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: template-bindings requires an interactive terminal.\n");
  process.exit(1);
}

host.start();

let demo: ReturnType<typeof runDemo>;
try {
  demo = runDemo(host, {
    onShutdown: () => {
      host.stop();
      process.exit(0);
    },
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
