/**
 * FileSystem capability — the seam between demos and their filesystem.
 *
 * [LAW:capabilities-over-context] Demos that need to read files take a
 * `FileSystem` parameter, not ambient `node:fs` access. The granted ability is
 * exactly the operations these demos perform — read a file, peek its first
 * bytes, list a directory, stat a path, ask whether it exists, plus the path
 * manipulation those calls require. No `writeFile`, no `mkdir`, no `chmod`.
 *
 * [LAW:dataflow-not-control-flow] A demo body never branches on "am I in
 * node or browser"; the FileSystem implementation passed in *is* the
 * variability. Same call sites, different value.
 *
 * [LAW:one-source-of-truth] There is exactly one FileSystem interface; the
 * node and memory implementations are derived from it. A demo that imports
 * `node:fs` directly is a leak — fix the demo, not the type.
 *
 * [LAW:one-way-deps] Demos depend on `_capabilities/`; the capability has
 * no knowledge of any specific demo.
 */

export interface FileStat {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly mtime: Date;
}

/**
 * The operations any demo in this repo currently performs against a
 * filesystem. The interface is intentionally narrow: every method here has
 * a real caller. Add methods when a real caller appears, not before.
 */
export interface FileSystem {
  /** Root directory for "home"; production: `os.homedir()`. */
  homeDir(): string;

  /** Concatenate path segments using the implementation's separator. */
  join(...parts: string[]): string;

  /** Resolve path segments to an absolute path. Walks right-to-left until an
   *  absolute segment appears; if none, prepends an implementation-defined
   *  base (`process.cwd()` for node, `homeDir()` for memory) so the result
   *  is always absolute. Empty segments are ignored. `.` and `..` collapse
   *  after the base is applied (so `resolve("..", "x")` is relative to the
   *  parent of the base, not the base). */
  resolve(...parts: string[]): string;

  /** Trailing component, with optional extension stripped. */
  basename(path: string, ext?: string): string;

  /** Parent directory (everything before the last separator). */
  dirname(path: string): string;

  /** True iff a node exists at `path` (file or directory). */
  exists(path: string): boolean;

  /** Children names (no leading path) of a directory. Empty array if the
   *  directory cannot be read. */
  readDir(path: string): string[];

  /** Stat info for `path`, or `null` if the path is missing or unreadable. */
  stat(path: string): FileStat | null;

  /** Full contents of a file, decoded as UTF-8. Throws if the file cannot
   *  be read (consumers are responsible for catching where appropriate). */
  readFile(path: string): string;

  /** Best-effort: read up to `maxBytes` from the start of a file and return
   *  the UTF-8 string. Returns `null` if the file cannot be opened or is
   *  empty. Implementations may read fewer bytes for short files. */
  readFirstBytes(path: string, maxBytes: number): string | null;
}
