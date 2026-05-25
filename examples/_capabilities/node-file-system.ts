/**
 * NodeFileSystem — the production `FileSystem` implementation backed by
 * `node:fs` / `node:path` / `node:os`.
 *
 * [LAW:single-enforcer] This module is the only place demo code touches
 * those node-only imports. Every other demo file consumes a `FileSystem`
 * value and stays environment-agnostic. The browser bundle pipeline aliases
 * `node:fs` to a stub (examples/_browser-shell/node-stub.js) so any leak
 * elsewhere is caught loudly at runtime.
 *
 * [LAW:no-shared-mutable-globals] Constructors take no shared state; each
 * instance is a thin wrapper around stateless node primitives.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";

import type { FileStat, FileSystem } from "./file-system.js";

export class NodeFileSystem implements FileSystem {
  homeDir(): string {
    return homedir();
  }

  join(...parts: string[]): string {
    return join(...parts);
  }

  basename(path: string, ext?: string): string {
    return ext === undefined ? basename(path) : basename(path, ext);
  }

  dirname(path: string): string {
    return dirname(path);
  }

  exists(path: string): boolean {
    return existsSync(path);
  }

  readDir(path: string): string[] {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  }

  stat(path: string): FileStat | null {
    try {
      const s = statSync(path);
      return {
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
        size: s.size,
        mtime: s.mtime,
      };
    } catch {
      return null;
    }
  }

  readFile(path: string): string {
    return readFileSync(path, "utf-8");
  }

  readFirstBytes(path: string, maxBytes: number): string | null {
    let fd = -1;
    try {
      fd = openSync(path, "r");
      const buf = Buffer.alloc(maxBytes);
      const n = readSync(fd, buf, 0, buf.length, 0);
      if (n === 0) return null;
      return buf.toString("utf-8", 0, n);
    } catch {
      return null;
    } finally {
      if (fd >= 0) {
        try { closeSync(fd); } catch { /* ignore */ }
      }
    }
  }
}
