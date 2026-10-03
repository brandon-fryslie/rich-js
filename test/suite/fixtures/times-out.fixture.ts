// For test/suite/timeout-report.test.ts: one test that runs out its time
// waiting, one that records a failure and then runs out its time, and one that
// fails on its own well inside it.
import { expect, it } from "vitest";

it("waits for ever", async () => {
  await new Promise(() => {});
});

it("fails softly, then waits for ever", async () => {
  expect.soft(3).toBe(4);
  await new Promise(() => {});
});

it("fails at once", () => {
  expect(1).toBe(2);
});
