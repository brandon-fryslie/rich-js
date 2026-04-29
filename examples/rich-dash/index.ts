/**
 * rich-dash — pluggable dashboard demo.
 *
 * Wires the declarative LAYOUT + WIDGETS into a DashboardRuntime and starts
 * the tick loop. Run with: `npm run dash`. Press Ctrl-C to exit.
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
  runtime.start();
}

main();
