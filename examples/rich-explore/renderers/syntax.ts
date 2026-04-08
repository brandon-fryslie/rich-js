import { readFileSync } from "node:fs";
import { Syntax } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { Entry } from "../fs/walk.js";

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".java": "java",
  ".rb": "ruby",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".css": "css",
  ".scss": "css",
  ".html": "html",
  ".xml": "xml",
  ".sql": "sql",
};

const MAX_BYTES = 256 * 1024;

export function renderSyntax(entry: Entry): Renderable {
  const code = readFileSync(entry.path, "utf-8").slice(0, MAX_BYTES);
  const dot = entry.name.lastIndexOf(".");
  const ext = dot >= 0 ? entry.name.slice(dot).toLowerCase() : "";
  const lang = EXT_TO_LANG[ext] ?? "text";
  return new Syntax(code, lang, { lineNumbers: true });
}
