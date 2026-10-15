/**
 * Pins the staged runner's vitals as the card shows them: they never repeat
 * visibly, and memory is collected at irregular moments rather than swung.
 */
import { describe, expect, it } from "vitest";
import { vitalsAt } from "../../../examples/rich-dash/staging/vitals.js";

const seconds = (to: number, step: number) => Array.from({ length: Math.floor(to / step) }, (_, i) => i * step);

describe("vitalsAt", () => {
  it("does not come back to the same load at any period up to ten minutes", () => {
    const t = seconds(600, 0.5);
    const load = t.map((s) => vitalsAt(s).loadAverage[0]);
    for (let lag = 2; lag < load.length / 2; lag++) {
      const drift = load.slice(lag).reduce((sum, v, i) => sum + Math.abs(v - load[i]!), 0) / (load.length - lag);
      expect(drift, `load against itself ${lag / 2}s later`).toBeGreaterThan(0.05);
    }
  });

  it("collects memory at irregular intervals, each a drop after a climb", () => {
    const t = seconds(300, 0.25);
    const used = t.map((s) => vitalsAt(s).usedBytes);
    const drops = t.filter((_, i) => i > 0 && used[i]! < used[i - 1]! - 0.2 * 1024 ** 3);
    expect(drops.length).toBeGreaterThan(15);
    const gaps = new Set(drops.slice(1).map((s, i) => Math.round(s - drops[i]!)));
    expect(gaps.size, "the intervals between collections vary").toBeGreaterThan(5);
  });

  it("keeps every reading a machine could report", () => {
    for (const s of seconds(3600, 7)) {
      const { loadAverage, usedBytes } = vitalsAt(s);
      for (const load of loadAverage) expect(load).toBeGreaterThan(0);
      expect(usedBytes).toBeGreaterThan(8 * 1024 ** 3);
      expect(usedBytes).toBeLessThan(32 * 1024 ** 3);
    }
  });
});
