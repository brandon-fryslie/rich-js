/**
 * Behavioural tests for MemorySystemInfo — the browser-side SystemInfo
 * implementation backed by a fixed snapshot. Pins the contract the
 * rich-dash sysinfo widget (and downstream demos) depends on.
 *
 * [LAW:behavior-not-structure] Tests assert what calling each accessor
 * yields under known inputs (snapshot + clock), not how the class lays
 * out its private fields.
 *
 * [LAW:dataflow-not-control-flow] Time-based behavior is pinned by
 * advancing the wall-clock via vitest fake timers — the variability is
 * data (the elapsed ms), not a branch on "is time enabled."
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemorySystemInfo,
  type SystemInfoSnapshot,
} from "../../../examples/_capabilities/memory-system-info.js";

const FIXTURE: SystemInfoSnapshot = {
  hostname: "test.browser",
  platform: "browser",
  arch: "wasm32",
  uptimeAtBootSec: 1000,
  loadAverage: [0.5, 0.75, 1.25],
  totalMemoryBytes: 16 * 1024 ** 3,
  freeMemoryBytes: 7 * 1024 ** 3,
};

describe("MemorySystemInfo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("snapshot passthroughs", () => {
    it("returns the snapshot's hostname", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      expect(sysinfo.hostname()).toBe("test.browser");
    });

    it("returns the snapshot's platform and arch", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      expect(sysinfo.platform()).toBe("browser");
      expect(sysinfo.arch()).toBe("wasm32");
    });

    it("returns the snapshot's loadAverage as a 3-tuple", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      const load = sysinfo.loadAverage();
      expect(load).toEqual([0.5, 0.75, 1.25]);
      expect(load).toHaveLength(3);
    });

    it("returns the snapshot's memory totals", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      expect(sysinfo.totalMemoryBytes()).toBe(16 * 1024 ** 3);
      expect(sysinfo.freeMemoryBytes()).toBe(7 * 1024 ** 3);
    });
  });

  describe("uptimeSeconds()", () => {
    it("returns uptimeAtBootSec at construction time", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      expect(sysinfo.uptimeSeconds()).toBe(1000);
    });

    it("advances by whole seconds with wall-clock", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      vi.advanceTimersByTime(5_000);
      expect(sysinfo.uptimeSeconds()).toBe(1005);
    });

    it("floors sub-second advances", () => {
      const sysinfo = new MemorySystemInfo(FIXTURE);
      vi.advanceTimersByTime(999);
      expect(sysinfo.uptimeSeconds()).toBe(1000);
      vi.advanceTimersByTime(1);
      expect(sysinfo.uptimeSeconds()).toBe(1001);
    });

    it("survives a long advance (multi-day)", () => {
      const sysinfo = new MemorySystemInfo({ ...FIXTURE, uptimeAtBootSec: 0 });
      vi.advanceTimersByTime(86_400 * 3 * 1000); // 3 days
      expect(sysinfo.uptimeSeconds()).toBe(86_400 * 3);
    });
  });

  describe("instance isolation", () => {
    it("instances do not share boot instants", () => {
      const first = new MemorySystemInfo(FIXTURE);
      vi.advanceTimersByTime(10_000);
      const second = new MemorySystemInfo(FIXTURE);
      expect(first.uptimeSeconds()).toBe(1010);
      expect(second.uptimeSeconds()).toBe(1000);
    });
  });
});
