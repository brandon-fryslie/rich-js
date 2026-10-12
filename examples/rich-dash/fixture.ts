/**
 * What rich-dash reads when there is no machine to read: the README the notes
 * panel renders and the vitals the sysinfo panel shows. `main.ts` hands these
 * to the dashboard; `node.ts` hands it the real ones.
 */
import type { MemoryTree } from "../_capabilities/memory-file-system.js";
import type { SystemInfoSnapshot } from "../_capabilities/memory-system-info.js";

const README_MD = `# rich-dash (fixture)

A small ticker dashboard demo. The app, layout, widgets, and panel chrome
are the same in a page and in Node — only the files and the vitals
they read differ.

## Panels

- **sysinfo** — host vitals from a fixed snapshot. Uptime ticks with
  wall-clock so the panel proves it is repainting; everything else holds
  steady from a fixture.
- **build** — a fake build pipeline driving a \`Progress\` instance. Stages
  advance every frame; when the last stage finishes, a fresh job starts.
- **README** — *this file*, rendered by rich-js's Markdown.

## Architecture

\`\`\`
run(host, caps)
  -> buildWidgets(caps)
  -> App + one clock
  -> Layout + Panels
\`\`\`
`;

export const FIXTURE_TREE: MemoryTree = {
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
export const SYSINFO_SNAPSHOT: SystemInfoSnapshot = {
  hostname: "rich-dash.browser",
  platform: "browser",
  arch: "wasm32",
  uptimeAtBootSec: 60 * 60 * 5, // under a day, so formatUptime shows seconds and the panel visibly ticks
  loadAverage: [0.42, 0.58, 0.61],
  totalMemoryBytes: 16 * 1024 ** 3,
  freeMemoryBytes: 7 * 1024 ** 3,
};
