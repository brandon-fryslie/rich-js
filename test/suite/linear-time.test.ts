import { describe, it, expect } from "vitest";
import { expectLinearTime } from "./linear-time.js";

/** Work of `steps` steps the compiler cannot drop. */
function spin(steps: number): number {
  let sum = 0;
  for (let i = 0; i < steps; i++) sum = (sum + i) | 0;
  return sum;
}

describe("expectLinearTime", () => {
  it("fails work that grows with the square of its input", () => {
    expect(() => expectLinearTime((n) => spin(n * n), 5_000)).toThrow(/^5000 vs 20000: /);
  });

  it("fails quadratic work when a run at the smaller size stalls", () => {
    let calls = 0;
    expect(() =>
      expectLinearTime((n) => {
        // The first run, at the smaller size, waits out a busy machine.
        if (++calls === 1) spin(1e8);
        spin(n * n);
      }, 5_000),
    ).toThrow(/^5000 vs 20000: /);
  });

  it("passes linear work when the machine turns busy partway through", () => {
    let calls = 0;
    expectLinearTime((n) => {
      // From the first run at the larger size on, every run takes three times as long.
      spin(++calls === 1 ? n : 3 * n);
    }, 20_000_000);
  });

  it("fails work too small to measure its growth", () => {
    expect(() => expectLinearTime((n) => spin(n * n), 10)).toThrow(/too fast to measure growth/);
  });
});
