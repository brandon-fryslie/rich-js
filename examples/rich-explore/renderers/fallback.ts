import { readFileSync } from "node:fs";
import { RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { Entry } from "../fs/walk.js";

const MAX_BYTES = 64 * 1024;

export function renderFallback(entry: Entry): Renderable {
  const raw = readFileSync(entry.path, "utf-8");
  const truncated = raw.length > MAX_BYTES;
  const content = raw.slice(0, MAX_BYTES) + (truncated ? "\n\n… (truncated)" : "");
  return new RichText(content, { end: "" });
}
