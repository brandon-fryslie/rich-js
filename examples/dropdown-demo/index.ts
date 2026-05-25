/**
 * dropdown-demo — node bootstrap. Constructs `NodeTerminalHost`, runs the
 * shared demo body, and wires SIGINT/SIGTERM into a clean shutdown.
 *
 * [LAW:types-are-the-program] The bootstrap's `onShutdown` callback (passed
 * into `runDemo` and fired from inside the demo on Ctrl-C in raw mode) does
 * NOT reference `demo` — the demo has already torn down its own state
 * before invoking it. Avoiding that reference makes the const-binding
 * order irrelevant to correctness (no TDZ window).
 */

import { NodeTerminalHost } from "../../src/index.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: demo:dropdown requires an interactive terminal.\n");
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
