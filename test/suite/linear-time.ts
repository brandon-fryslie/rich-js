/**
 * Whether a piece of work grows linearly with its input, asked so that how
 * busy the machine is cannot answer it.
 *
 * [LAW:verifiable-goals] A test that times one run against a wall-clock budget
 * measures the runner's load as much as the code: a linear parse that takes
 * 0.9 s alone took over 2 s inside a loaded full suite and failed. What sets
 * linear apart from quadratic is how the time grows, so this times the same
 * work at two sizes and compares them — a load that slows both runs cancels.
 * Each size keeps its fastest of several runs, taken in turn, because load
 * and a first run's compiling only ever add time: a stall that lands on one
 * run is dropped rather than read as growth.
 *
 * Four times the input takes four times as long when the work is linear and
 * sixteen when it is quadratic; the bar sits between them, at eight. A size
 * small enough that fixed costs swamp the work reads as no growth at all, so
 * the size a test passes is one the quadratic version is already slow at.
 */
import { expect } from "vitest";

/** How many times the larger input is the smaller. */
const FACTOR = 4;
/** The most the larger input may take, as a multiple of the smaller's time. */
const BAR = 8;
/** Runs at each size; each size keeps its fastest. */
const RUNS = 3;

function timed(work: () => void): number {
  const started = performance.now();
  work();
  return performance.now() - started;
}

/** Fails unless `run(FACTOR * size)` takes less than `BAR` times as long as `run(size)`. */
export function expectLinearTime(run: (size: number) => void, size: number): void {
  let small = Infinity;
  let large = Infinity;
  for (let i = 0; i < RUNS; i++) {
    small = Math.min(small, timed(() => run(size)));
    large = Math.min(large, timed(() => run(FACTOR * size)));
  }
  expect(large / small, `${size}: ${small.toFixed(1)} ms; ${FACTOR * size}: ${large.toFixed(1)} ms`).toBeLessThan(BAR);
}
