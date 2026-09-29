/**
 * rich-dash demo body — declarative dashboard runtime.
 *
 * [LAW:locality-or-seam] Signal handling and process lifecycle stay in the
 * node bootstrap (index.ts); this body holds only the runtime construction
 * + start/stop so it embeds cleanly into any TerminalHost (node or browser).
 *
 * [LAW:capabilities-over-context] `runDemo` takes a `DashboardCapabilities`
 * bag — FileSystem, SystemInfo, and the README path the notes widget reads.
 * Node and browser entries supply different capability values; the demo body
 * has no environment-aware branches.
 */

import { Console } from "../../src/index.js";
import { hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import { buildWidgets, LAYOUT, type DashboardCapabilities } from "./config.js";
import { buildLayout } from "./layout.js";
import { DashboardRuntime } from "./runtime/runtime.js";

export interface DemoHandle {
  stop(): void;
}

export function runDemo(host: TerminalHost, caps: DashboardCapabilities): DemoHandle {
  // [LAW:single-enforcer] The host is the console's whole environment: where
  // bytes go, its size and the colours it draws. Height is load-bearing for
  // Live: `Live.refresh` reads `console.height` to crop frames, so it has to
  // be the host's, live through resizes.
  const consoleOut = new Console({
    environment: hostEnvironment(host),
  });

  const runtime = new DashboardRuntime({
    layout: buildLayout(LAYOUT),
    widgets: buildWidgets(caps),
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
