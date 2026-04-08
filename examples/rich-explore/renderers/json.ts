import { readFileSync } from "node:fs";
import { JSONRenderable } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { Entry } from "../fs/walk.js";

const MAX_BYTES = 256 * 1024;

export function renderJson(entry: Entry): Renderable {
  const content = readFileSync(entry.path, "utf-8").slice(0, MAX_BYTES);
  return JSONRenderable.fromString(content);
}
