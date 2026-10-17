/**
 * Whether a piece of work grows linearly with its input, asked so that how
 * busy the machine is cannot answer it.
 *
 * [LAW:verifiable-goals] A test that times one run against a wall-clock budget
 * measures the runner's load as much as the code: a linear parse that takes
 * 0.9 s alone took over 2 s inside a loaded full suite and failed. What sets
 * linear apart from quadratic is how the time grows, so this times the same
 * work at two sizes, back to back, and reads the ratio of each pair.
 *
 * The time is the CPU time of the thread running the work, not wall time. On
 * a machine with more runnable threads than cores, a run that fits in one
 * scheduler slice gets a whole core while a longer one is preempted for its
 * whole length, so the wall-clock ratio grows with the load and does not
 * cancel: inside the full suite a linear highlighter's larger run took two to
 * three times as long as alone and its smaller run no longer, which read as
 * ten times for four times the input. CPU time counts only what the thread
 * ran. What load still does to it — a cache shared with other work, a clock
 * that changes speed, collection the thread does itself while the
 * collector's helper threads wait for a core — slows both runs of a pair, and
 * a stall, or a load that starts or stops partway, lands across at most one
 * pair; the median of the pairs' ratios drops that pair in either direction:
 * a small run that stalled cannot pass quadratic work, and a large one cannot
 * fail linear work.
 *
 * Four times the input takes four times as long when the work is linear and
 * sixteen when it is quadratic; the bar sits between them, at eight. A size
 * small enough that fixed costs swamp the work reads as no growth at all and
 * would pass quadratic work silently, so a smaller run that finishes under a
 * floor fails as unmeasurable. Load only lengthens a run, so it cannot trip
 * the floor; a faster machine can, and the fix is a larger size.
 */
import { expect } from "vitest";

/** How many times the larger input is the smaller. */
const FACTOR = 4;
/** The most the larger input may take, as a multiple of the smaller's time. */
const BAR = 8;
/** Pairs of runs timed; the verdict is their median ratio. */
const PAIRS = 5;
/** The least time the smaller input's fastest run may take to count as a measurement. */
const FLOOR_MS = 5;

/**
 * The milliseconds of CPU time this thread spends on `work`. Node has had
 * `process.threadCpuUsage` since 22.19 and 23.9, which is why
 * `package.json#devEngines` asks for those.
 */
function timed(work: () => void): number {
  const started = process.threadCpuUsage();
  work();
  const { user, system } = process.threadCpuUsage(started);
  return (user + system) / 1000;
}

/** Fails unless `run(FACTOR * size)` takes less than `BAR` times as long as `run(size)`. */
export function expectLinearTime(run: (size: number) => void, size: number): void {
  const pairs = Array.from({ length: PAIRS }, () => {
    const small = timed(() => run(size));
    return { small, large: timed(() => run(FACTOR * size)) };
  });
  const timings = `${size} vs ${FACTOR * size}: ${pairs.map((p) => `${p.small.toFixed(1)}/${p.large.toFixed(1)} ms`).join(", ")}`;
  expect(Math.min(...pairs.map((p) => p.small)), `too fast to measure growth, pass a larger size; ${timings}`).toBeGreaterThanOrEqual(FLOOR_MS);
  const ratios = pairs.map((p) => p.large / p.small).sort((a, b) => a - b);
  expect(ratios[Math.floor(PAIRS / 2)], timings).toBeLessThan(BAR);
}
