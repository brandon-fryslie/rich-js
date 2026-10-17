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
    expectLinearTime((n) => {
      // From the first run at the larger size on, every run takes three times as long.
      spin(++calls === 1 ? n : 3 * n);
    }, 60_000_000);
  });

  it("passes linear work when a run at the larger size stalls", () => {
    let calls = 0;
    expectLinearTime((n) => {
      // The first run at the larger size waits out a busy machine six times its own length:
      // its pair reads 28, enough to fail the work if the verdict were the pairs' mean.
      if (++calls === 2) spin(6 * n);
      spin(n);
    }, 60_000_000);
  });

  it("fails work too small to measure its growth", () => {
    expect(() => expectLinearTime((n) => spin(n * n), 10)).toThrow(/too fast to measure growth/);
  });
});
