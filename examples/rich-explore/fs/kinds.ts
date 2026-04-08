/**
 * File-kind classification. Extension point: add a row here + a matching
 * renderer in renderers/ to support a new file type.
 */

export type FileKind =
  | "markdown"
  | "source"
  | "json"
  | "directory"
  | "binary"
  | "fallback";

const EXT_TO_KIND: Record<string, FileKind> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".mdx": "markdown",
  ".json": "json",
  ".jsonl": "json",
  ".ts": "source",
  ".tsx": "source",
  ".js": "source",
  ".jsx": "source",
  ".mjs": "source",
  ".cjs": "source",
  ".py": "source",
  ".rs": "source",
  ".go": "source",
  ".c": "source",
  ".h": "source",
  ".cpp": "source",
  ".hpp": "source",
  ".java": "source",
  ".rb": "source",
  ".sh": "source",
  ".bash": "source",
  ".zsh": "source",
  ".yml": "source",
  ".yaml": "source",
  ".toml": "source",
  ".css": "source",
  ".scss": "source",
  ".html": "source",
  ".xml": "source",
  ".sql": "source",
};

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp",
  ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".wav", ".ogg", ".mov", ".avi",
]);

export function kindForPath(name: string, isDir: boolean): FileKind {
  if (isDir) return "directory";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "fallback";
  const ext = name.slice(dot).toLowerCase();
  const mapped = EXT_TO_KIND[ext];
  if (mapped) return mapped;
  if (BINARY_EXTS.has(ext)) return "binary";
  return "fallback";
}
