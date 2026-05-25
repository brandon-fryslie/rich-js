import { JSONRenderable } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { FileSystem } from "../../_capabilities/index.js";
import type { Entry } from "../fs/walk.js";

const MAX_BYTES = 256 * 1024;

export function renderJson(fs: FileSystem, entry: Entry): Renderable {
  const content = fs.readFile(entry.path).slice(0, MAX_BYTES);
  return JSONRenderable.fromString(content);
}
