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
 * [LAW:no-silent-failure] A README that cannot be read fails `init`, and so
 * the run, with the path in the error: a placeholder panel would hide a
 * wrong path behind a dashboard that looks fine.
 */

import { Markdown, type Renderable } from "@promptctl/rich-js";
import type { FileSystem } from "../../_capabilities/file-system.js";
import { defineWidget } from "../widget.js";

interface NotesState {
  readonly body: Renderable;
}

const MAX_LINES = 60;

function loadReadme(fs: FileSystem, readmePath: string): NotesState {
  const truncated = fs.readFile(readmePath).split("\n").slice(0, MAX_LINES).join("\n");
  return { body: new Markdown(truncated) };
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
