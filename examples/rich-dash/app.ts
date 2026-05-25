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
  // [LAW:dataflow-not-control-flow] Width AND height are data flowing from
  // the host through `getSize`. Console's defaults fall back to
  // `process.stdout` dimensions, which are 80x24 in the browser (no real
  // stdout), so layout would clip even when xterm.js is at 100xN. Both
  // dimensions are load-bearing because `Live.refresh` reads `console.height`
  // to crop frames — without a live read browser frames would truncate to 24
  // rows regardless of viewport. (Pattern shared with claude-sessions /
  // rich-explore.)
  const consoleOut = new Console({
    forceTerminal: true,
    file: hostStream(host),
    getSize: () => {
      const { cols, rows } = host.size();
      return { width: cols, height: rows };
    },
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
