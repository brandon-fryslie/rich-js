/**
 * NodeSystemInfo — the production `SystemInfo` implementation backed by
 * `node:os`.
 *
 * [LAW:single-enforcer] This module is the only place demo code touches
 * `node:os` for vitals. Every other demo file consumes a `SystemInfo` value
 * and stays environment-agnostic. The browser bundle pipeline does not
 * import this file (the barrel omits it), so a leak would surface as a
 * bundling error rather than a runtime mystery.
 *
 * [LAW:no-shared-mutable-globals] Constructors take no shared state; each
 * instance is a thin wrapper around stateless node primitives.
 */

import { arch, freemem, hostname, loadavg, platform, totalmem, uptime } from "node:os";

import type { SystemInfo } from "./system-info.js";

export class NodeSystemInfo implements SystemInfo {
  hostname(): string {
    return hostname();
  }

  platform(): string {
    return platform();
  }

  arch(): string {
    return arch();
  }

  uptimeSeconds(): number {
    return Math.floor(uptime());
  }

  loadAverage(): readonly [number, number, number] {
    const [one = 0, five = 0, fifteen = 0] = loadavg();
    return [one, five, fifteen];
  }

  totalMemoryBytes(): number {
    return totalmem();
  }

  freeMemoryBytes(): number {
    return freemem();
  }
}
