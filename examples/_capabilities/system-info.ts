/**
 * SystemInfo capability — the seam between demos and the host's OS-level
 * vitals (hostname, uptime, load, memory, platform, arch).
 *
 * [LAW:capabilities-over-context] Demos that display system stats take a
 * `SystemInfo` parameter, not ambient `node:os` access. The granted ability
 * is exactly the read-only metrics these demos display — no process control,
 * no environment access, no FS introspection.
 *
 * [LAW:dataflow-not-control-flow] A demo body never branches on "am I in
 * node or browser"; the `SystemInfo` value passed in *is* the variability.
 * Same call sites, different value.
 *
 * [LAW:one-source-of-truth] There is exactly one SystemInfo interface; the
 * node and memory implementations are derived from it. A demo that imports
 * `node:os` directly is a leak — fix the demo, not the type.
 *
 * [LAW:one-way-deps] Demos depend on `_capabilities/`; the capability has
 * no knowledge of any specific demo.
 */

/**
 * Read-only snapshot of system vitals. Each accessor returns a fresh value
 * on every call — implementations decide whether that means re-reading the
 * kernel (node) or returning a constant from a fixture (memory).
 *
 * The surface is intentionally narrow: every method here has a real caller.
 * Add methods when a real caller appears, not before.
 */
export interface SystemInfo {
  /** Host name (e.g. node's `os.hostname()`). */
  hostname(): string;

  /** Platform identifier (e.g. "darwin", "linux", "win32"). */
  platform(): string;

  /** CPU architecture (e.g. "arm64", "x64"). */
  arch(): string;

  /** Seconds since the host booted (production: `os.uptime()`). */
  uptimeSeconds(): number;

  /** 1/5/15-minute load averages. The browser has no real loadavg, so the
   *  memory impl returns its fixture values verbatim. */
  loadAverage(): readonly [number, number, number];

  /** Total physical memory, in bytes. */
  totalMemoryBytes(): number;

  /** Free physical memory, in bytes. */
  freeMemoryBytes(): number;
}
