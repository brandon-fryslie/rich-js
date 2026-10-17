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
    expect(() => expectLinearTime((n) => spin(n * n), 2_000)).toThrow(/^2000: [\d.]+ ms; 8000: [\d.]+ ms/);
  });

  it("passes linear work that the machine stalls in the middle of", () => {
    let calls = 0;
    expectLinearTime((n) => {
      // The first run at the larger size waits out a busy machine.
      if (++calls === 2) spin(4e8);
      spin(n);
    }, 5_000_000);
  });
});
