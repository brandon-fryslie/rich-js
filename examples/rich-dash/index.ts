/**
 * rich-dash — pluggable dashboard demo.
 *
 * Wires the declarative LAYOUT + WIDGETS into a DashboardRuntime and starts
 * the tick loop. Run with: `npm run dash`. Press Ctrl-C to exit.
 *
 * [LAW:locality-or-seam] The entrypoint owns process lifecycle: signal
 * handling and exit live here, not inside the runtime, so the runtime stays
 * embeddable in tests and other CLIs.
 */

import { Console } from "../../src/index.js";
import { buildLayout } from "./layout.js";
import { DashboardRuntime } from "./runtime/runtime.js";
import { LAYOUT, WIDGETS } from "./config.js";

function main(): void {
  const consoleOut = new Console({ forceTerminal: true });
  const runtime = new DashboardRuntime({
    layout: buildLayout(LAYOUT),
    widgets: WIDGETS,
    fps: 8,
    console: consoleOut,
  });

  const onSignal = (): void => {
    runtime.stop();
    process.exit(0);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    runtime.start();
  } catch (err) {
    runtime.stop();
    throw err;
  }
}

main();
