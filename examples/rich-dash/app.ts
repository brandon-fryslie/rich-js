/**
 * rich-dash demo body — declarative dashboard runtime.
 *
 * [LAW:locality-or-seam] Signal handling and process lifecycle stay in the
 * node bootstrap (index.ts); this body holds only the runtime construction
 * + start/stop so it embeds cleanly into any TerminalHost (node or browser).
 */

import { Console, hostStream, type TerminalHost } from "../../src/index.js";
import { buildLayout } from "./layout.js";
import { DashboardRuntime } from "./runtime/runtime.js";
import { LAYOUT, WIDGETS } from "./config.js";

export interface DemoHandle {
  stop(): void;
}

export function runDemo(host: TerminalHost): DemoHandle {
  const { cols } = host.size();
  const consoleOut = new Console({
    forceTerminal: true,
    file: hostStream(host),
    width: cols,
  });
  const runtime = new DashboardRuntime({
    layout: buildLayout(LAYOUT),
    widgets: WIDGETS,
    fps: 8,
    console: consoleOut,
  });

  try {
    runtime.start();
  } catch (err) {
    runtime.stop();
    throw err;
  }

  return {
    stop(): void { runtime.stop(); },
  };
}
