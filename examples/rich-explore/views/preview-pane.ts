import { Panel, RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { Entry } from "../fs/walk.js";
import type { FileKind } from "../fs/kinds.js";
import { renderMarkdown } from "../renderers/markdown.js";
import { renderSyntax } from "../renderers/syntax.js";
import { renderJson } from "../renderers/json.js";
import { renderDirectory } from "../renderers/directory.js";
import { renderBinary } from "../renderers/binary.js";
import { renderFallback } from "../renderers/fallback.js";
import { Window } from "./window.js";

// Kind → renderer dispatch table. To support a new file type, add a
// variant to FileKind in fs/kinds.ts, a renderer module, and a row here.
const RENDERERS: Record<FileKind, (entry: Entry) => Renderable> = {
  markdown: renderMarkdown,
  source: renderSyntax,
  json: renderJson,
  directory: renderDirectory,
  binary: renderBinary,
  fallback: renderFallback,
};

export function buildPreviewPane(
  entry: Entry | undefined,
  innerHeight: number,
  offset: number,
  focused: boolean,
): Renderable {
  const focusPrefix = focused ? "▸ " : "";
  const baseBorder = focused ? "bold " : "dim ";

  const wrap = (inner: Renderable, title: string, color: string) =>
    new Panel(new Window(inner, innerHeight, offset), {
      title: `${focusPrefix}${title}`,
      borderStyle: baseBorder + color,
      padding: [0, 1],
    });

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
    const inner = RENDERERS[entry.kind](entry);
    return wrap(inner, `${entry.name}  [${entry.kind}]`, "green");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const text = new RichText(msg, { end: "" });
    text.stylize("red");
    return wrap(text, `Error: ${entry.name}`, "red");
  }
}
