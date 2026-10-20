/**
 * Pins how the dashboard's widgets move: once a frame of its `App`'s timer, on
 * the clock it is given — so a fake clock drives it, a repaint between frames
 * does not move it, and a suspended dashboard stands still. Uptime is the
 * vital that changes between any two snapshots, so the sysinfo widget reads it
 * once per tick, and counting the reads counts the ticks.
 */
import { describe, expect, it, vi } from "vitest";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import type { SystemInfo } from "../../../examples/_capabilities/system-info.js";
import { run } from "../../../examples/rich-dash/app.js";
import { fakeClock } from "../../core/fake-clock.js";
import { scriptedHost } from "../../host/scripted-host.js";

const later = () => new Promise((resolve) => setTimeout(resolve));

function dashboard(start?: number) {
  const clock = fakeClock(start);
  const host = scriptedHost({ cols: 120, rows: 30 });
  let snapshots = 0;
  const sysinfo: SystemInfo = {
    hostname: () => "test-host",
    platform: () => "linux",
    arch: () => "x64",
    uptimeSeconds: () => snapshots++,
    loadAverage: () => [0, 0, 0],
    totalMemoryBytes: () => 1024 ** 3,
    freeMemoryBytes: () => 1024 ** 3,
  };
  const fs = new MemoryFileSystem({ home: "/home/test", root: { kind: "directory", children: { "README.md": { kind: "file", content: "# hi" } } } });
  const running = run(host, { clock, fs, sysinfo, readmePath: "/home/test/README.md" });
  return { clock, host, running, ticks: () => snapshots - 1 };
}

describe("rich-dash", () => {
  it("advances its widgets once a frame of the clock it is given, wherever that clock starts", async () => {
    const { clock, running, ticks } = dashboard(1 / 3);
    await later();
    expect(ticks()).toBe(0);

    clock.advance(1);
    expect(ticks()).toBe(8);

    running.stop();
    await running.done;
    expect(clock.timers()).toBe(0);
  });

  it("does not advance on a repaint between frames", async () => {
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
    // The repaint on resume is not a frame of the timer: no step, not ten seconds' worth.
    expect(ticks()).toBe(0);
    clock.advance(1);
    expect(ticks()).toBe(8);

    running.stop();
    await running.done;
  });

  // The build pane's Progress is drawn by the app, so its tasks are timed on
  // the app's frames: elapsed is seconds of playback, wherever the clock the
  // dashboard is given starts.
  it("shows the build's elapsed time in seconds of frames played", async () => {
    // The longest run, then the shortest advance: the first stage is still
    // running after three seconds, and it is the only one started.
    const random = vi.spyOn(Math, "random").mockReturnValue(0.999);
    const { clock, host, running } = dashboard(5000);
    random.mockReturnValue(0);
    await later();
    clock.advance(3);
    const elapsed = [...host.output().replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").matchAll(/\d+:\d\d:\d\d/g)].map(([face]) => face);
    expect(elapsed.at(-1)).toBe("0:00:03");

    running.stop();
    await running.done;
    random.mockRestore();
  });
});
