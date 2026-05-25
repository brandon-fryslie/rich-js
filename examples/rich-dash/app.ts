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

import { Console, hostStream, type TerminalHost } from "../../src/index.js";
import { buildWidgets, LAYOUT, type DashboardCapabilities } from "./config.js";
import { buildLayout } from "./layout.js";
import { DashboardRuntime } from "./runtime/runtime.js";

export interface DemoHandle {
  stop(): void;
}

export function runDemo(host: TerminalHost, caps: DashboardCapabilities): DemoHandle {
  const consoleOut = new Console({
    forceTerminal: true,
    // hostStream returns a narrow Writable; Console's file: type is wider.
    // See followup rich-demo-site-pek.3.4 for the structural fix.
    file: hostStream(host) as unknown as NodeJS.WritableStream,
  });
  // [LAW:dataflow-not-control-flow] Width AND height are data flowing from
  // the host. Console's defaults fall back to `process.stdout` dimensions,
  // which are 80x24 in the browser (no real stdout), so layout would clip
  // even when xterm.js is at 100xN. Both overrides are required because
  // `Live.refresh` (src/renderables/live.ts) reads `console.height` to crop
  // frames — without the height override, browser frames truncate to 24 rows
  // regardless of viewport. Reading `host.size()` lazily keeps render
  // dimensions tracking the terminal on resize. (Pattern from #48.)
  Object.defineProperty(consoleOut, "width", { get: () => host.size().cols });
  Object.defineProperty(consoleOut, "height", { get: () => host.size().rows });

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
