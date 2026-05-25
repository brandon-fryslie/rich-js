import { RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { FileSystem } from "../../_capabilities/index.js";
import type { Entry } from "../fs/walk.js";

const MAX_BYTES = 64 * 1024;

export function renderFallback(fs: FileSystem, entry: Entry): Renderable {
  const raw = fs.readFile(entry.path);
  const truncated = raw.length > MAX_BYTES;
  const content = raw.slice(0, MAX_BYTES) + (truncated ? "\n\n… (truncated)" : "");
  return new RichText(content, { end: "" });
}
