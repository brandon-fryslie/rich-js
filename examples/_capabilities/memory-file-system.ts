/**
 * MemoryFileSystem — an in-memory `FileSystem` for browser bundles.
 *
 * [LAW:types-are-the-program] The constructor takes a `MemoryTree` value;
 * the type forbids constructing a memory FS without an explicit fixture.
 * There is no implicit "empty filesystem" branch — if a demo wants nothing,
 * it passes an empty tree, and that is a representable, legal value.
 *
 * [LAW:dataflow-not-control-flow] Paths are slash-separated; both absolute
 * (starting with `/`) and relative forms are supported, mirroring the
 * input shapes node:path accepts. Lookup against the materialised tree
 * always works in terms of absolute paths under `home`; relative inputs
 * are useful primarily for `join`/`basename`/`dirname`. The implementation
 * does not branch on platform; the memory FS picks one convention and
 * applies it uniformly.
 *
 * [LAW:no-shared-mutable-globals] Each instance owns its own tree; mutating
 * the tree after construction is not part of the public surface (no write
 * methods). The browser demo treats fixtures as frozen at boot.
 */

import type { FileStat, FileSystem } from "./file-system.js";

export interface MemoryFile {
  readonly kind: "file";
  readonly content: string;
  /** Optional modification time; defaults to construction time. */
  readonly mtime?: Date;
}

export interface MemoryDirectory {
  readonly kind: "directory";
  readonly children: { readonly [name: string]: MemoryNode };
}

export type MemoryNode = MemoryFile | MemoryDirectory;

export interface MemoryTree {
  /** Absolute path returned from `homeDir()`. The tree's root represents
   *  whatever lives at this path; the demo addresses files relative to it. */
  readonly home: string;
  readonly root: MemoryDirectory;
}

const SEP = "/";

function normalise(path: string): string {
  // Collapse repeated slashes and strip a trailing slash (except for root).
  const collapsed = path.replace(/\/+/g, SEP);
  if (collapsed.length > 1 && collapsed.endsWith(SEP)) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

function splitSegments(path: string): string[] {
  const normalised = normalise(path);
  if (normalised === SEP || normalised === "") return [];
  const start = normalised.startsWith(SEP) ? 1 : 0;
  return normalised.slice(start).split(SEP).filter((s) => s.length > 0);
}

export class MemoryFileSystem implements FileSystem {
  private readonly tree: MemoryTree;
  private readonly homeSegments: string[];
  private readonly defaultMtime: Date;

  constructor(tree: MemoryTree) {
    this.tree = tree;
    this.homeSegments = splitSegments(tree.home);
    this.defaultMtime = new Date();
  }

  homeDir(): string {
    return this.tree.home;
  }

  join(...parts: string[]): string {
    // Mirror node:path.join's semantics enough for these demos: an absolute
    // path mid-list resets the result. Empty segments are ignored.
    let segments: string[] = [];
    let absolute = false;
    for (const part of parts) {
      if (part.length === 0) continue;
      if (part.startsWith(SEP)) {
        segments = [];
        absolute = true;
      }
      for (const piece of part.split(SEP)) {
        if (piece.length === 0) continue;
        if (piece === ".") continue;
        if (piece === "..") {
          if (segments.length > 0) segments.pop();
          continue;
        }
        segments.push(piece);
      }
    }
    const body = segments.join(SEP);
    return absolute ? SEP + body : body;
  }

  basename(path: string, ext?: string): string {
    const segments = splitSegments(path);
    const last = segments.length === 0 ? "" : segments[segments.length - 1]!;
    if (ext !== undefined && last.endsWith(ext)) {
      return last.slice(0, last.length - ext.length);
    }
    return last;
  }

  dirname(path: string): string {
    const normalised = normalise(path);
    if (normalised === SEP) return SEP;
    if (normalised === "") return ".";
    const idx = normalised.lastIndexOf(SEP);
    if (idx < 0) return ".";        // relative path with no parent ("a")
    if (idx === 0) return SEP;      // immediate child of root ("/a")
    return normalised.slice(0, idx);
  }

  exists(path: string): boolean {
    return this.lookup(path) !== null;
  }

  readDir(path: string): string[] {
    const node = this.lookup(path);
    if (node === null || node.kind !== "directory") return [];
    return Object.keys(node.children);
  }

  stat(path: string): FileStat | null {
    const node = this.lookup(path);
    if (node === null) return null;
    if (node.kind === "file") {
      return {
        isFile: true,
        isDirectory: false,
        size: byteLength(node.content),
        mtime: node.mtime ?? this.defaultMtime,
      };
    }
    return {
      isFile: false,
      isDirectory: true,
      size: 0,
      mtime: this.defaultMtime,
    };
  }

  readFile(path: string): string {
    const node = this.lookup(path);
    if (node === null) {
      throw new Error(`MemoryFileSystem: ENOENT: ${path}`);
    }
    if (node.kind !== "file") {
      throw new Error(`MemoryFileSystem: EISDIR: ${path}`);
    }
    return node.content;
  }

  readFirstBytes(path: string, maxBytes: number): string | null {
    const node = this.lookup(path);
    if (node === null || node.kind !== "file") return null;
    if (node.content.length === 0) return null;
    // Encode to bytes, slice to the maxBytes cap, decode with a non-fatal
    // decoder — matches NodeFileSystem precisely: the *read* is capped at
    // maxBytes, and a multibyte codepoint split at the boundary decodes to
    // U+FFFD in both impls. Note the returned text's byte length is *not*
    // strictly ≤ maxBytes when truncation produces replacement chars
    // (U+FFFD encodes to 3 bytes), matching node's Buffer.toString.
    const encoded = new TextEncoder().encode(node.content);
    const slice = encoded.subarray(0, Math.min(maxBytes, encoded.length));
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  }

  // ---- Internals ----------------------------------------------------------

  private lookup(path: string): MemoryNode | null {
    const segments = splitSegments(path);
    // Resolution rules:
    //   - Paths at `home` or below resolve against the materialised tree.
    //   - The filesystem root `/` (when home is non-root) is missing — the
    //     memory FS does not model a wider filesystem.
    //   - Non-empty partial prefixes of `home` (e.g. `/Users` when home is
    //     `/Users/x`) resolve to synthetic empty directories so that a
    //     prefix `exists()` check returns true; demos never list above
    //     `home`, so the synthetic node's empty children are never observed.
    //   - Anything not matching the home prefix is missing.
    if (segments.length < this.homeSegments.length) {
      if (segments.length === 0 && this.homeSegments.length === 0) {
        return this.tree.root;
      }
      if (segments.length === 0) {
        return null;
      }
      for (let i = 0; i < segments.length; i++) {
        if (segments[i] !== this.homeSegments[i]) return null;
      }
      return { kind: "directory", children: {} };
    }
    for (let i = 0; i < this.homeSegments.length; i++) {
      if (segments[i] !== this.homeSegments[i]) return null;
    }
    let node: MemoryNode = this.tree.root;
    for (let i = this.homeSegments.length; i < segments.length; i++) {
      if (node.kind !== "directory") return null;
      const next: MemoryNode | undefined = node.children[segments[i]!];
      if (next === undefined) return null;
      node = next;
    }
    return node;
  }
}

function byteLength(s: string): number {
  // TextEncoder is universally available in modern browsers and Node ≥ 12.
  return new TextEncoder().encode(s).length;
}
