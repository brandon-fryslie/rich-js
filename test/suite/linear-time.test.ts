import { beforeEach, describe, it, expect, vi } from "vitest";
import { expectLinearTime } from "./linear-time.js";

/**
 * `expectLinearTime` on a stopwatch that reads `cost(size, call)` milliseconds for
 * the `call`th run, counted from 1, so a verdict is arithmetic and no runner's
 * speed enters it.
 */
function judge(cost: (size: number, call: number) => number, size: number): number {
  let call = 0;
  let spent = 0;
  return expectLinearTime(
    (n) => {
      spent = cost(n, ++call);
    },
    size,
    (work) => {
      work();
      return spent;
    },
  );
}

/**
 * Spends `ms` of this thread's CPU time. Read here and not through the helper's
 * stopwatch, which is what the tests that burn are about, and stated in CPU time
 * and not in steps, so that a cost is a claim about no runner and cannot fall
 * under the helper's floor.
 */
function burn(ms: number): void {
  const started = process.threadCpuUsage();
  const spent = (): number => {
    const { user, system } = process.threadCpuUsage(started);
    return (user + system) / 1000;
  };
  while (spent() < ms);
}

/** What a run of size `n` costs: 64 ms at 8000, and 4 ms, under the helper's floor, at 2000. */
const quadratic = (n: number): number => (n * n) / 1_000_000;
/** What a run of size `n` costs: 10 ms at 1000. */
const linear = (n: number): number => n / 100;

describe("expectLinearTime", () => {
  beforeEach(() => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    return () => warn.mockRestore();
  });

  it("fails work that grows with the square of its input", () => {
    expect(() => judge(quadratic, 8_000)).toThrow(/^8000 vs 32000: /);
  });

  it("fails quadratic work when a run at the smaller size stalls", () => {
    // The first run, at the smaller size, waits out a busy machine four times its own length.
    expect(() => judge((n, call) => quadratic(n) * (call === 1 ? 5 : 1), 8_000)).toThrow(/^8000 vs 32000: /);
  });

  it("passes linear work when the machine turns busy partway through", () => {
    // From the first run at the larger size on, every run takes three times as long.
    expect(judge((n, call) => linear(n) * (call === 1 ? 1 : 3), 1_000)).toBe(1_000);
  });

  it("passes linear work when a run at the larger size stalls", () => {
    // The first run at the larger size waits out a busy machine six times its own length:
    // its pair reads 28, enough to fail the work if the verdict were the pairs' mean.
    expect(judge((n, call) => linear(n) * (call === 2 ? 7 : 1), 1_000)).toBe(1_000);
  });

  it("fails quadratic work given a size too small to measure, at a size four times larger each time until it is", () => {
    const sizes = new Set<number>();
    const cost = (n: number): number => {
      sizes.add(n);
      return quadratic(n);
    };
    expect(() => judge(cost, 500)).toThrow(/^8000 vs 32000: /);
    expect([...sizes]).toEqual([500, 2_000, 8_000, 32_000]);
    expect(vi.mocked(console.warn).mock.calls.map(([line]) => /(\d+) vs/.exec(String(line))?.[1])).toEqual(["500", "2000"]);
  });

  it("fails work that does not grow with its size as unmeasurable, after three sizes each four times larger", () => {
    const sizes = new Set<number>();
    const cost = (n: number): number => {
      sizes.add(n);
      return 1;
    };
    expect(() => judge(cost, 10)).toThrow(/too fast to measure growth even 64 times larger, pass a larger size/);
    expect([...sizes]).toEqual([10, 40, 160, 640, 2560]);
  });

  // Two tests on the real stopwatch, for what a simulated one cannot say: it
  // counts CPU time and not wall time, and each run's alone. Every other caller
  // of the helper trusts it to fail quadratic work and to pass linear work on a
  // busy machine.
  it("fails work on the real stopwatch that spends the square of its input in CPU time", () => {
    expect(() => expectLinearTime((n) => burn(n * n), 3)).toThrow(/^3 vs 12: /);
  });

  it("passes linear work on the real stopwatch when every run at the larger size waits off the CPU", () => {
    const blocked = new Int32Array(new SharedArrayBuffer(4));
    const measured = expectLinearTime((n) => {
      const started = performance.now();
      burn(n);
      // Each larger run then waits twice its own length without running, as a thread preempted on a busy machine does;
      // in wall time every pair reads twelve, and the work would fail.
      if (n > 6) Atomics.wait(blocked, 0, 0, 2 * (performance.now() - started));
    }, 6);
    expect(measured).toBe(6);
  });
});
