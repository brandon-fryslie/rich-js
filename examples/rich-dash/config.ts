/**
 * config — declarative dashboard composition.
 *
 * Adding a widget = one new file in widgets/ + one entry in `buildWidgets`
 * and a matching leaf in `LAYOUT`. The runtime never changes.
 *
 * [LAW:one-source-of-truth] LAYOUT cell names and widget ids must agree.
 * The runtime uses Layout.getByName(widget.id) — if the leaf is missing, the
 * widget is silently skipped, which is the correct dataflow behavior.
 *
 * [LAW:capabilities-over-context] `buildWidgets` takes a capability bag.
 * Each widget factory closes over exactly the capabilities it needs — the
 * sysinfo widget never sees the FileSystem, the notes widget never sees
 * SystemInfo, and the job widget needs neither.
 */

import type { FileSystem, SystemInfo } from "../_capabilities/index.js";
import type { LayoutSpec } from "./layout.js";
import type { Widget } from "./runtime/widget.js";
import { jobWidget } from "./widgets/job.js";
import { notesWidget } from "./widgets/notes.js";
import { sysinfoWidget } from "./widgets/sysinfo.js";

export interface DashboardCapabilities {
  readonly fs: FileSystem;
  readonly sysinfo: SystemInfo;
  /** Absolute path to the README the notes widget should render. */
  readonly readmePath: string;
}

export function buildWidgets(caps: DashboardCapabilities): Widget[] {
  return [
    sysinfoWidget(caps.sysinfo),
    notesWidget(caps.fs, caps.readmePath),
    jobWidget,
  ];
}

export const LAYOUT: LayoutSpec = {
  split: "row",
  children: [
    {
      ratio: 1,
      split: "column",
      children: [
        { name: "sysinfo", size: 9 },
        { name: "job",     ratio: 1 },
      ],
    },
    { name: "notes", ratio: 2 },
  ],
};
