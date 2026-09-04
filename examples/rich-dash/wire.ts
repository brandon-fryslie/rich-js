/**
 * rich-dash — browser bootstrap. Constructs `BrowserTerminalHost` over the
 * xterm.js Terminal provided by the page shell, hands the shared demo body
 * a `MemoryFileSystem` with a small README fixture and a `MemorySystemInfo`
 * holding a snapshot of plausible vitals, then returns the mount handle.
 *
 * [LAW:one-source-of-truth] The same `runDemo` from app.ts powers the node
 * and browser entries. No forked code path; only the capability values
 * differ.
 *
 * [LAW:dataflow-not-control-flow] The fixture below is data. Tuning the
 * snapshot (different host name, different memory size) means editing
 * literals — no demo-side logic changes.
 *
 * [LAW:capabilities-over-context] Every node-only behavior used by rich-dash
 * — filesystem reads (notes widget) and OS vitals (sysinfo widget) — is
 * supplied as a capability value. There are no node imports in this file.
 */

import {
  BrowserTerminalHost,
  type TerminalHost,
  type XtermTerminal,
} from "../../src/host/terminal-host.js";
import {
  MemoryFileSystem,
  MemorySystemInfo,
  type MemoryTree,
  type SystemInfoSnapshot,
} from "../_capabilities/index.js";
import { runDemo, type DemoHandle } from "./app.js";

export interface MountHandle {
  readonly host: TerminalHost;
  stop(): void;
}

const README_MD = `# rich-dash (browser fixture)

A small ticker dashboard demo. The runtime, layout, widgets, and panel
chrome are identical to the node version — only the capability values are
different in-browser.

## Panels

- **sysinfo** — host vitals from a fixed snapshot. Uptime ticks with
  wall-clock so the panel proves it is repainting; everything else holds
  steady from a fixture.
- **build** — a fake build pipeline driving a \`Progress\` instance. Stages
  advance every frame; when the last stage finishes, a fresh job starts.
- **README** — *this file*, rendered by rich-js's Markdown.

## Architecture

\`\`\`
runDemo(host, { fs, sysinfo, readmePath })
  -> buildWidgets(caps)        // per-widget capabilities
  -> DashboardRuntime          // one Live, one tick scheduler
  -> Layout + Panels           // pure render of widget state
\`\`\`
`;

const FIXTURE_TREE: MemoryTree = {
  home: "/home/demo",
  root: {
    kind: "directory",
    children: {
      "README.md": { kind: "file", content: README_MD },
    },
  },
};

// [LAW:dataflow-not-control-flow] Plausible-but-fixed vitals. Memory is
// 16 GiB total with ~7 GiB free; load averages are calm. The memory impl
// advances `uptimeSeconds()` from `uptimeAtBootSec` by wall-clock, so the
// sysinfo panel shows a live-looking uptime even though the snapshot is
// frozen.
const SYSINFO_SNAPSHOT: SystemInfoSnapshot = {
  hostname: "rich-dash.browser",
  platform: "browser",
  arch: "wasm32",
  uptimeAtBootSec: 60 * 60 * 24 * 3, // 3 days of "uptime" to make formatUptime exercise its days/hours/minutes branches
  loadAverage: [0.42, 0.58, 0.61],
  totalMemoryBytes: 16 * 1024 ** 3,
  freeMemoryBytes: 7 * 1024 ** 3,
};

export function mount(terminal: XtermTerminal): MountHandle {
  const host = new BrowserTerminalHost({ terminal });
  host.start();
  const fs = new MemoryFileSystem(FIXTURE_TREE);
  const sysinfo = new MemorySystemInfo(SYSINFO_SNAPSHOT);

  let demo: DemoHandle | null = null;
  try {
    demo = runDemo(host, {
      fs,
      sysinfo,
      readmePath: fs.join(fs.homeDir(), "README.md"),
    });
  } catch (err) {
    host.stop();
    throw err;
  }

  return {
    host,
    stop(): void {
      demo?.stop();
      host.stop();
    },
  };
}

export default mount;
