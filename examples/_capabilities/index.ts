/**
 * Shared demo capabilities barrel — browser-safe re-exports.
 *
 * [LAW:one-source-of-truth] One barrel for the `FileSystem` interface and
 * its browser-side implementation. Node-only implementations
 * (`NodeFileSystem`) are NOT re-exported here — node entries import them
 * directly from their own file. Keeping the barrel browser-safe means a
 * browser bundle that goes through `_capabilities/index.js` cannot
 * transitively pull in `node:fs`/`node:path`/`node:os` and fail to bundle.
 *
 * [LAW:types-are-the-program] The split is the type system carrying the
 * environment constraint: a demo's wire.ts can import from this barrel
 * with the static guarantee that nothing it pulls in evaluates a node-only
 * module at import time.
 */

export type { FileStat, FileSystem } from "./file-system.js";
export {
  MemoryFileSystem,
  type MemoryDirectory,
  type MemoryFile,
  type MemoryNode,
  type MemoryTree,
} from "./memory-file-system.js";
