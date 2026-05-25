/**
 * notes — read a README once at init, render as Markdown each frame.
 *
 * The state is the parsed Markdown renderable itself; tick is a no-op
 * (returns the same reference). Even no-op widgets follow the same protocol
 * as everything else — no special "static widget" path.
 *
 * [LAW:capabilities-over-context] The widget takes a `FileSystem` and an
 * absolute `readmePath`; it does not know whether the path resolves on disk
 * (node) or in a memory tree (browser). Same body, different capability.
 *
 * [LAW:dataflow-not-control-flow] A missing README is data, not a branch on
 * environment — the renderable falls back to a placeholder Markdown body
 * with no path-search logic in the widget itself.
 */

import { Markdown, type Renderable } from "../../../src/index.js";
import type { FileSystem } from "../../_capabilities/index.js";
import { defineWidget } from "../runtime/widget.js";

interface NotesState {
  readonly body: Renderable;
}

const MAX_LINES = 60;

function loadReadme(fs: FileSystem, readmePath: string): NotesState {
  if (!fs.exists(readmePath)) {
    return { body: new Markdown("# README not found\n\nNo README.md was located.") };
  }
  try {
    const md = fs.readFile(readmePath);
    const truncated = md.split("\n").slice(0, MAX_LINES).join("\n");
    return { body: new Markdown(truncated) };
  } catch {
    return { body: new Markdown("# README not found\n\nNo README.md was located.") };
  }
}

export function notesWidget(fs: FileSystem, readmePath: string) {
  return defineWidget<NotesState>({
    id: "notes",
    title: " README ",
    borderStyle: "magenta",
    init: () => loadReadme(fs, readmePath),
    tick: (state) => state,
    render: (state) => state.body,
  });
}
