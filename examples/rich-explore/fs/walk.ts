/**
 * Directory listing at the FS trust boundary. Per-entry stat failures
 * (permission denied, broken symlinks) are captured on the Entry so the
 * UI can render them explicitly rather than the whole listing crashing.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { kindForPath, type FileKind } from "./kinds.js";

export interface Entry {
  readonly name: string;
  readonly path: string;
  readonly kind: FileKind;
  readonly size: number;
  readonly mtime: Date;
  readonly error: string | null;
}

export function listDir(path: string): Entry[] {
  const dirents = readdirSync(path, { withFileTypes: true });
  const result: Entry[] = dirents.map((d) => {
    const full = join(path, d.name);
    try {
      const s = statSync(full);
      return {
        name: d.name,
        path: full,
        kind: kindForPath(d.name, d.isDirectory()),
        size: s.size,
        mtime: s.mtime,
        error: null,
      };
    } catch (err) {
      return {
        name: d.name,
        path: full,
        kind: d.isDirectory() ? "directory" : "fallback",
        size: 0,
        mtime: new Date(0),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
  result.sort((a, b) => {
    if (a.kind === "directory" && b.kind !== "directory") return -1;
    if (a.kind !== "directory" && b.kind === "directory") return 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
