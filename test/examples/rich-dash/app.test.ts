/**
 * Pins how the dashboard's widgets move: on the frame time its `App` hands the
 * view, once a frame period, on the clock it is given — so a fake clock drives
 * it, a repaint inside a period does not move it, and a suspended dashboard
 * stands still. The sysinfo widget snapshots its capability once per tick, so
 * counting the snapshots counts the ticks.
 */
import { describe, expect, it } from "vitest";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import type { SystemInfo } from "../../../examples/_capabilities/system-info.js";
import { run } from "../../../examples/rich-dash/app.js";
import { fakeClock } from "../../core/fake-clock.js";
import { scriptedHost } from "../../host/scripted-host.js";

const later = () => new Promise((resolve) => setTimeout(resolve));

function dashboard() {
  const clock = fakeClock();
  const host = scriptedHost({ cols: 120, rows: 30 });
  let snapshots = 0;
  const sysinfo: SystemInfo = {
    hostname: () => (snapshots++, "test-host"),
    platform: () => "linux",
    arch: () => "x64",
    uptimeSeconds: () => 0,
    loadAverage: () => [0, 0, 0],
    totalMemoryBytes: () => 1024 ** 3,
    freeMemoryBytes: () => 1024 ** 3,
  };
  const fs = new MemoryFileSystem({ home: "/home/test", root: { kind: "directory", children: { "README.md": { kind: "file", content: "# hi" } } } });
  const running = run(host, { clock, fs, sysinfo, readmePath: "/home/test/README.md" });
  return { clock, host, running, ticks: () => snapshots - 1 };
}

describe("rich-dash", () => {
  it("advances its widgets once a frame period of the clock it is given", async () => {
    const { clock, running, ticks } = dashboard();
    await later();
    expect(ticks()).toBe(0);

    clock.advance(1);
    expect(ticks()).toBe(8);

    running.stop();
    await running.done;
    expect(clock.timers()).toBe(0);
  });

  it("does not advance on a repaint inside a period it already drew", async () => {
    const { clock, host, running, ticks } = dashboard();
    await later();
    clock.advance(1 / 8);
    expect(ticks()).toBe(1);

    host.resize({ cols: 100, rows: 30 });
    await later();
    expect(ticks()).toBe(1);

    running.stop();
    await running.done;
  });

  it("stands still while suspended, and moves again on resume", async () => {
    const { clock, host, running, ticks } = dashboard();
    await later();

    host.type("\x1a"); // ctrl+z
    await later();
    expect(host.suspends()).toBe(1);
    clock.advance(10);
    expect(ticks()).toBe(0);

    host.resume();
    await later();
    // The repaint on resume lands in a new period: one step, not ten seconds' worth.
    expect(ticks()).toBe(1);
    clock.advance(1);
    expect(ticks()).toBe(1 + 8);

    running.stop();
    await running.done;
  });
});
