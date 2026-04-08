import { readFileSync } from "node:fs";
import { Markdown } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { Entry } from "../fs/walk.js";

const MAX_BYTES = 256 * 1024;

export function renderMarkdown(entry: Entry): Renderable {
  const content = readFileSync(entry.path, "utf-8").slice(0, MAX_BYTES);
  return new Markdown(content);
}
