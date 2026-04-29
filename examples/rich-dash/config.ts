/**
 * config — declarative dashboard composition.
 *
 * Adding a widget = one new file in widgets/ + one entry in `WIDGETS` and a
 * matching leaf in `LAYOUT`. The runtime never changes.
 *
 * [LAW:one-source-of-truth] LAYOUT cell names and WIDGETS ids must agree.
 * The runtime uses Layout.getByName(widget.id) — if the leaf is missing, the
 * widget is silently skipped, which is the correct dataflow behavior.
 */

import type { LayoutSpec } from "./layout.js";
import type { Widget } from "./runtime/widget.js";
import { sysinfoWidget } from "./widgets/sysinfo.js";
import { notesWidget } from "./widgets/notes.js";
import { jobWidget } from "./widgets/job.js";

export const WIDGETS: Widget[] = [
  sysinfoWidget,
  notesWidget,
  jobWidget,
];

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
