/**
 * notes — read README.md once at init, render as Markdown each frame.
 *
 * The state is the parsed Markdown renderable itself; tick is a no-op
 * (returns the same reference). Even no-op widgets follow the same protocol
 * as everything else — no special "static widget" path.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Markdown, type Renderable } from "../../../src/index.js";
import { defineWidget } from "../runtime/widget.js";

interface NotesState {
  readonly body: Renderable;
}

const HERE = dirname(fileURLToPath(import.meta.url));

function loadReadme(): NotesState {
  const candidates = [
    resolve(HERE, "../../../README.md"),
    resolve(HERE, "../../../../README.md"),
  ];
  for (const path of candidates) {
    try {
      const md = readFileSync(path, "utf8");
      const truncated = md.split("\n").slice(0, 60).join("\n");
      return { body: new Markdown(truncated) };
    } catch {
      // try next candidate
    }
  }
  return { body: new Markdown("# README not found\n\nNo README.md was located.") };
}

export const notesWidget = defineWidget<NotesState>({
  id: "notes",
  title: " README ",
  borderStyle: "magenta",
  init: loadReadme,
  tick: (state) => state,
  render: (state) => state.body,
});
