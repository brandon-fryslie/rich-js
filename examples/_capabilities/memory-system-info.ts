/**
 * MemorySystemInfo — an in-memory `SystemInfo` for browser bundles.
 *
 * [LAW:types-are-the-program] The constructor takes a `SystemInfoSnapshot`
 * value; the type forbids constructing a memory SystemInfo without an
 * explicit fixture. There is no implicit "default vitals" path — if a demo
 * wants placeholder values, it spells them out, and that is a representable,
 * legal value.
 *
 * [LAW:dataflow-not-control-flow] Each accessor reads from the snapshot.
 * `uptimeSeconds()` is a pure function of (snapshot.uptimeAtBootSec, now,
 * bootInstant) — wall-clock advance is data flowing through the call, not a
 * branch on "is time enabled."
 *
 * [LAW:no-shared-mutable-globals] Each instance owns its own snapshot;
 * mutating the snapshot after construction is not part of the public
 * surface. The browser demo treats vitals as frozen at boot.
 */

import type { SystemInfo } from "./system-info.js";

export interface SystemInfoSnapshot {
  readonly hostname: string;
  readonly platform: string;
  readonly arch: string;
  /** Uptime in seconds at the moment this snapshot was captured. The memory
   *  impl advances this with wall-clock time so the dashboard shows a
   *  ticking uptime in the browser, not a frozen value. */
  readonly uptimeAtBootSec: number;
  readonly loadAverage: readonly [number, number, number];
  readonly totalMemoryBytes: number;
  readonly freeMemoryBytes: number;
}

export class MemorySystemInfo implements SystemInfo {
  private readonly snapshot: SystemInfoSnapshot;
  private readonly bootInstantMs: number;

  constructor(snapshot: SystemInfoSnapshot) {
    this.snapshot = snapshot;
    this.bootInstantMs = Date.now();
  }

  hostname(): string {
    return this.snapshot.hostname;
  }

  platform(): string {
    return this.snapshot.platform;
  }

  arch(): string {
    return this.snapshot.arch;
  }

  uptimeSeconds(): number {
    const elapsedMs = Date.now() - this.bootInstantMs;
    return this.snapshot.uptimeAtBootSec + Math.floor(elapsedMs / 1000);
  }

  loadAverage(): readonly [number, number, number] {
    return this.snapshot.loadAverage;
  }

  totalMemoryBytes(): number {
    return this.snapshot.totalMemoryBytes;
  }

  freeMemoryBytes(): number {
    return this.snapshot.freeMemoryBytes;
  }
}
