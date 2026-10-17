import { afterEach, describe, expect, it, vi } from "vitest";
import { frameRate, systemClock } from "../../src/core/clock.js";

describe("frameRate", () => {
  it.each([30, 1, 0.5, 12.5])("takes %s frames a second, with the interval between them", (perSecond) => {
    const rate = frameRate(perSecond);
    expect(rate.perSecond).toBe(perSecond);
    expect(rate.interval).toBe(1 / perSecond);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e-7, Number.MIN_VALUE])("refuses %s", (perSecond) => {
    expect(() => frameRate(perSecond)).toThrow(RangeError);
  });

  it("takes the slowest rate a platform timer can wait out, and nothing slower", () => {
    const longest = (2 ** 31 - 1) / 1000;
    expect(frameRate(1.001 / longest).interval).toBeCloseTo(longest / 1.001);
    expect(() => frameRate(1 / (longest * 1.01))).toThrow(RangeError);
  });
});

// rich-animation-xi28.6rs: the one-shot a host waits on until its frame next changes.
describe("systemClock().at", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks once when the clock reads the time, and not before", () => {
    vi.useFakeTimers();
    const clock = systemClock();
    const ticks: number[] = [];
    clock.at(clock.now() + 0.5, () => ticks.push(clock.now()));
    vi.advanceTimersByTime(499);
    expect(ticks).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(ticks).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(ticks).toHaveLength(1);
  });

  it("ticks as soon as it can for a time already past", () => {
    vi.useFakeTimers();
    const clock = systemClock();
    let ticked = 0;
    clock.at(clock.now() - 10, () => ticked++);
    vi.advanceTimersByTime(0);
    expect(ticked).toBe(1);
  });

  it("does not tick once the returned function is called", () => {
    vi.useFakeTimers();
    const clock = systemClock();
    let ticked = 0;
    const stop = clock.at(clock.now() + 0.1, () => ticked++);
    stop();
    vi.advanceTimersByTime(1000);
    expect(ticked).toBe(0);
  });

  it("refuses a time further off than a timer can wait, and one that is not a time", () => {
    const clock = systemClock();
    expect(() => clock.at(clock.now() + 2 ** 31 / 1000 + 1, () => {})).toThrow(RangeError);
    expect(() => clock.at(Number.NaN, () => {})).toThrow(RangeError);
  });
});
