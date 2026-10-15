/**
 * The host the card's dashboard reports on: a build runner whose vitals move
 * like a real machine's and never visibly repeat.
 *
 * [LAW:effects-at-boundaries] `vitalsAt` is a pure function of seconds since
 * the card started; `StagedSystemInfo` is the one place that reads a clock.
 *
 * Load is a sum of slow sines with incommensurate periods (7 s, 11 s, 23 s —
 * primes, so the sum's period is their product, ~30 minutes) plus smooth
 * value noise, and the 5- and 15-minute averages are the same shape slower
 * and flatter, as a kernel's damped averages are. Memory is a resident set
 * that drifts, plus a heap that grows at a varying rate and is collected at
 * irregular intervals — the sawtooth of a garbage-collected workload, not a
 * sine.
 */
import type { SystemInfo } from "../../_capabilities/system-info.js";

const GIB = 1024 ** 3;
const TOTAL_BYTES = 32 * GIB;

/** A repeatable pseudo-random number in [0, 1) for integer `i` on channel `seed`. */
function hash(i: number, seed: number): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Value noise in [-1, 1]: `hash` at the integers, eased between them. */
function noise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const eased = f * f * (3 - 2 * f);
  return 2 * (hash(i, seed) + (hash(i + 1, seed) - hash(i, seed)) * eased) - 1;
}

const wave = (t: number, period: number, phase: number) => Math.sin((2 * Math.PI * t) / period + phase);

/** The heap's size at `t`: within each collection cycle it grows from a floor; at the cycle's end it is collected. */
function heapBytes(t: number): number {
  let start = 0;
  for (let cycle = 0; ; cycle++) {
    const length = 4 + 13 * hash(cycle, 2);
    if (t < start + length) {
      const floor = (0.3 + 0.5 * hash(cycle, 3)) * GIB;
      const rate = (0.12 + 0.3 * hash(cycle, 4)) * GIB;
      const age = t - start;
      return floor + rate * age + 0.05 * GIB * noise(t * 2, 5);
    }
    start += length;
  }
}

export interface Vitals {
  readonly loadAverage: readonly [number, number, number];
  readonly usedBytes: number;
}

/** The runner's vitals `t` seconds after the card started. */
export function vitalsAt(t: number): Vitals {
  const load1 = 2.1 + 0.6 * wave(t, 7, 0.3) + 0.4 * wave(t, 11, 1.7) + 0.5 * wave(t, 23, 4.1) + 0.5 * noise(t / 3, 1);
  const load5 = 2.1 + 0.25 * wave(t, 31, 2.2) + 0.3 * noise(t / 17, 6);
  const load15 = 2.0 + 0.1 * wave(t, 53, 0.9) + 0.15 * noise(t / 41, 7);
  const resident = (11.5 + 1.2 * noise(t / 37, 8)) * GIB;
  return {
    loadAverage: [Math.max(0.05, load1), Math.max(0.05, load5), Math.max(0.05, load15)],
    usedBytes: resident + heapBytes(t),
  };
}

/** Nine days up when the card opened. */
const UPTIME_AT_START_SEC = 9 * 86400 + 4 * 3600 + 17 * 60;

export class StagedSystemInfo implements SystemInfo {
  private readonly startedMs: number;

  constructor(private readonly nowMs: () => number) {
    this.startedMs = nowMs();
  }

  private seconds(): number {
    return (this.nowMs() - this.startedMs) / 1000;
  }

  hostname(): string {
    return "ci-runner-07";
  }

  platform(): string {
    return "linux";
  }

  arch(): string {
    return "x64";
  }

  uptimeSeconds(): number {
    return UPTIME_AT_START_SEC + Math.floor(this.seconds());
  }

  loadAverage(): readonly [number, number, number] {
    return vitalsAt(this.seconds()).loadAverage;
  }

  totalMemoryBytes(): number {
    return TOTAL_BYTES;
  }

  freeMemoryBytes(): number {
    return TOTAL_BYTES - vitalsAt(this.seconds()).usedBytes;
  }
}
