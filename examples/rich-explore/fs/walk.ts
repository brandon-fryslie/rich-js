/**
 * Directory listing at the FS trust boundary. Per-entry stat failures
 * (permission denied, broken symlinks) are captured on the Entry so the
 * UI can render them explicitly rather than the whole listing crashing.
 *
 * [LAW:capabilities-over-context] The directory walk takes a `FileSystem`;
 * there is no `node:fs` import. The same code runs against `NodeFileSystem`
 * in the terminal entry and a `MemoryFileSystem` populated with a fixture
 * in the browser entry.
 */

import type { FileSystem } from "../../_capabilities/index.js";
import { kindForPath, type FileKind } from "./kinds.js";

export interface Entry {
  readonly name: string;
  readonly path: string;
  readonly kind: FileKind;
  readonly size: number;
  readonly mtime: Date;
  readonly error: string | null;
}

export function listDir(fs: FileSystem, path: string): Entry[] {
  // [LAW:single-enforcer] All filesystem variance flows through `fs`. The
  // FileSystem.readDir contract returns `[]` for unreadable directories
  // rather than throwing; a stat-each pass below classifies survivors and
  // produces per-entry errors for any individual stat failures.
  const names = fs.readDir(path);
  const result: Entry[] = names.map((name) => {
    const full = fs.join(path, name);
    const s = fs.stat(full);
    if (s === null) {
      // readdir surfaced the name, so the entry exists; the stat call itself
      // failed (permission, broken symlink, race with deletion). The
      // capability hides the underlying errno, but we can still classify by
      // extension so tree styling stays meaningful — `.png` reads as binary
      // even when we can't read its size — and surface the path so the user
      // can identify which entry failed.
      return {
        name,
        path: full,
        kind: kindForPath(name, false),
        size: 0,
        mtime: new Date(0),
        error: `stat failed: ${full}`,
      };
    }
    return {
      name,
      path: full,
      kind: kindForPath(name, s.isDirectory),
      size: s.size,
      mtime: s.mtime,
      error: null,
    };
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
