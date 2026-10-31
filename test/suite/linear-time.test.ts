import { describe, it, expect } from "vitest";
import { expectLinearTime } from "./linear-time.js";

/** Work of `steps` steps the compiler cannot drop. */
function spin(steps: number): number {
  let sum = 0;
  for (let i = 0; i < steps; i++) sum = (sum + i) | 0;
  return sum;
}

/**
 * A stopwatch that reads only what work says it spent, so a verdict is arithmetic
 * and no runner's speed enters it. Real work here would make each size a claim
 * about a machine.
 */
function simulated() {
  let elapsed = 0;
  return {
    spend(ms: number): void {
      elapsed += ms;
    },
    stopwatch(work: () => void): number {
      const started = elapsed;
      work();
      return elapsed - started;
    },
  };
}

/** What a run of size `n` costs: 64 ms at 8000, and 4 ms, under the helper's floor, at 2000. */
const quadratic = (n: number): number => (n * n) / 1_000_000;
/** What a run of size `n` costs: 10 ms at 1000. */
const linear = (n: number): number => n / 100;

describe("expectLinearTime", () => {
  it("fails work that grows with the square of its input", () => {
    const { spend, stopwatch } = simulated();
    expect(() => expectLinearTime((n) => spend(quadratic(n)), 8_000, stopwatch)).toThrow(/^8000 vs 32000: /);
  });

  it("fails quadratic work when a run at the smaller size stalls", () => {
    const { spend, stopwatch } = simulated();
    let calls = 0;
    expect(() =>
      expectLinearTime(
        (n) => {
          // The first run, at the smaller size, waits out a busy machine four times its own length.
          spend(quadratic(n) * (++calls === 1 ? 5 : 1));
        },
        8_000,
        stopwatch,
      ),
    ).toThrow(/^8000 vs 32000: /);
  });

  it("passes linear work when the machine turns busy partway through", () => {
    const { spend, stopwatch } = simulated();
    let calls = 0;
    const measured = expectLinearTime(
      (n) => {
        // From the first run at the larger size on, every run takes three times as long.
        spend(linear(n) * (++calls === 1 ? 1 : 3));
      },
      1_000,
      stopwatch,
    );
    expect(measured).toBe(1_000);
  });

  // The one test on the real stopwatch, because that it counts CPU time and not
  // wall time is the fact a simulated one cannot say. 60_000_000 steps keep the
  // smaller run about three times over the helper's floor on the fastest runner
  // seen, where a spin step took ~0.25 ns and 20_000_000 once came in under it
  // (CI run 39060726759); a run under it costs a larger size and fails nothing.
  it("passes linear work when every run at the larger size waits off the CPU", () => {
    const blocked = new Int32Array(new SharedArrayBuffer(4));
    expectLinearTime((n) => {
      const started = performance.now();
      spin(n);
      // Each larger run then waits twice its own length without running, as a thread preempted on a busy machine does;
      // in wall time every pair reads twelve, and the work would fail.
      if (n > 60_000_000) Atomics.wait(blocked, 0, 0, 2 * (performance.now() - started));
    }, 60_000_000);
  });

  it("passes linear work when a run at the larger size stalls", () => {
    const { spend, stopwatch } = simulated();
    let calls = 0;
    const measured = expectLinearTime(
      (n) => {
        // The first run at the larger size waits out a busy machine six times its own length:
        // its pair reads 28, enough to fail the work if the verdict were the pairs' mean.
        spend(linear(n) * (++calls === 2 ? 7 : 1));
      },
      1_000,
      stopwatch,
    );
    expect(measured).toBe(1_000);
  });

  it("fails quadratic work given a size too small to measure, at a size four times larger each time until it is", () => {
    const { spend, stopwatch } = simulated();
    const sizes = new Set<number>();
    expect(() =>
      expectLinearTime(
        (n) => {
          sizes.add(n);
          spend(quadratic(n));
        },
        500,
        stopwatch,
      ),
    ).toThrow(/^8000 vs 32000: /);
    expect([...sizes]).toEqual([500, 2_000, 8_000, 32_000]);
  });

  it("fails work that does not grow with its size as unmeasurable, after three sizes each four times larger", () => {
    const { spend, stopwatch } = simulated();
    const sizes = new Set<number>();
    expect(() =>
      expectLinearTime(
        (n) => {
          sizes.add(n);
          spend(1);
        },
        10,
        stopwatch,
      ),
    ).toThrow(/too fast to measure growth even 64 times larger, pass a larger size/);
    expect([...sizes]).toEqual([10, 40, 160, 640, 2560]);
  });
});
