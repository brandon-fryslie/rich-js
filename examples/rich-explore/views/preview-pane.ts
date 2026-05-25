import { Panel, RichText, Constrain } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { FileSystem } from "../../_capabilities/index.js";
import type { Entry } from "../fs/walk.js";
import type { FileKind } from "../fs/kinds.js";
import type { Mode } from "../state.js";
import { renderMarkdown } from "../renderers/markdown.js";
import { renderSyntax } from "../renderers/syntax.js";
import { renderJson } from "../renderers/json.js";
import { renderDirectory } from "../renderers/directory.js";
import { renderBinary } from "../renderers/binary.js";
import { renderFallback } from "../renderers/fallback.js";
import { CoverageRenderable } from "../renderers/coverage.js";
import { Window } from "./window.js";

// Kind → renderer dispatch table. To support a new file type, add a
// variant to FileKind in fs/kinds.ts, a renderer module, and a row here.
// [LAW:dataflow-not-control-flow] Both file-reading renderers (markdown,
// source, json, fallback, directory) and metadata-only renderers (binary)
// share the same signature — the unused `fs` parameter for binary is the
// price of one uniform dispatch instead of two parallel tables.
type RenderFn = (fs: FileSystem, entry: Entry) => Renderable;
const RENDERERS: Record<FileKind, RenderFn> = {
  markdown: renderMarkdown,
  source: renderSyntax,
  json: renderJson,
  directory: renderDirectory,
  binary: (_fs, entry) => renderBinary(entry),
  fallback: renderFallback,
};

export function buildPreviewPane(
  fs: FileSystem,
  entry: Entry | undefined,
  innerHeight: number,
  offset: number,
  focused: boolean,
  mode: Mode = "browse",
): Renderable {
  const focusPrefix = focused ? "▸ " : "";
  const baseBorder = focused ? "bold " : "dim ";

  const MAX_CONTENT_WIDTH = 120;
  const wrap = (inner: Renderable, title: string, color: string) =>
    new Panel(new Window(new Constrain(inner, MAX_CONTENT_WIDTH), innerHeight, offset), {
      title: `${focusPrefix}${title}`,
      borderStyle: baseBorder + color,
      padding: [0, 1],
    });

  // Coverage mode: show the kitchen-sink renderable exercising all exports
  if (mode === "coverage") {
    return wrap(new CoverageRenderable(), "Coverage — all rich-js exports", "yellow");
  }

  if (!entry) {
    const empty = new RichText("(nothing selected)", { end: "" });
    empty.stylize("dim italic");
    return wrap(empty, "Preview", "white");
  }

  if (entry.error) {
    const text = new RichText(`Cannot read: ${entry.error}`, { end: "" });
    text.stylize("red");
    return wrap(text, entry.name, "red");
  }

  try {
    const inner = RENDERERS[entry.kind](fs, entry);
    return wrap(inner, `${entry.name}  [${entry.kind}]`, "green");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const text = new RichText(msg, { end: "" });
    text.stylize("red");
    return wrap(text, `Error: ${entry.name}`, "red");
  }
}
