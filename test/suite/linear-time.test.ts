import { describe, it, expect } from "vitest";
import { expectLinearTime } from "./linear-time.js";

/** Work of `steps` steps the compiler cannot drop. */
function spin(steps: number): number {
  let sum = 0;
  for (let i = 0; i < steps; i++) sum = (sum + i) | 0;
  return sum;
}

describe("expectLinearTime", () => {
  // Every size that measures growth keeps its smaller run's fastest time about
  // three times over the helper's floor on the fastest runner seen: a spin step
  // took ~0.25 ns on GitHub's, where 20_000_000 steps once came in under it
  // (CI run 39060726759).
  it("fails work that grows with the square of its input", () => {
    expect(() => expectLinearTime((n) => spin(n * n), 8_000)).toThrow(/^8000 vs 32000: /);
  });

  it("fails quadratic work when a run at the smaller size stalls", () => {
    let calls = 0;
    expect(() =>
      expectLinearTime((n) => {
        // The first run, at the smaller size, waits out a busy machine four times its own length.
        if (++calls === 1) spin(4 * n * n);
        spin(n * n);
      }, 8_000),
    ).toThrow(/^8000 vs 32000: /);
  });

  it("passes linear work when the machine turns busy partway through", () => {
    let calls = 0;
    const measured = expectLinearTime((n) => {
      // From the first run at the larger size on, every run takes three times as long.
      spin(++calls === 1 ? n : 3 * n);
    }, 60_000_000);
    expect(measured).toBe(60_000_000);
  });

  it("passes linear work when every run at the larger size waits off the CPU", () => {
    const blocked = new Int32Array(new SharedArrayBuffer(4));
    const measured = expectLinearTime((n) => {
      const started = performance.now();
      spin(n);
      // Each larger run then waits twice its own length without running, as a thread preempted on a busy machine does;
      // in wall time every pair reads twelve, and the work would fail.
      if (n > 60_000_000) Atomics.wait(blocked, 0, 0, 2 * (performance.now() - started));
    }, 60_000_000);
    expect(measured).toBe(60_000_000);
  });

  it("passes linear work when a run at the larger size stalls", () => {
    let calls = 0;
    const measured = expectLinearTime((n) => {
      // The first run at the larger size waits out a busy machine six times its own length:
      // its pair reads 28, enough to fail the work if the verdict were the pairs' mean.
      if (++calls === 2) spin(6 * n);
      spin(n);
    }, 60_000_000);
    expect(measured).toBe(60_000_000);
  });

  it("fails quadratic work given a size too small to measure, at a size four times larger each time until it is", () => {
    const sizes = new Set<number>();
    let message = "";
    try {
      expectLinearTime((n) => {
        sizes.add(n);
        spin(n * n);
      }, 500);
    } catch (error) {
      message = (error as Error).message;
    }
    const tried = [...sizes];
    expect(tried.length).toBeGreaterThan(2);
    expect(tried).toEqual(tried.map((_, i) => 500 * 4 ** i));
    expect(message).toMatch(new RegExp(`^${tried.at(-2)} vs ${tried.at(-1)}: `));
  });

  it("fails work that does not grow with its size as unmeasurable, after three sizes each four times larger", () => {
    const sizes = new Set<number>();
    expect(() =>
      expectLinearTime((n) => {
        sizes.add(n);
        spin(1000);
      }, 10),
    ).toThrow(/too fast to measure growth even 64 times larger, pass a larger size/);
    expect([...sizes]).toEqual([10, 40, 160, 640, 2560]);
  });
});
