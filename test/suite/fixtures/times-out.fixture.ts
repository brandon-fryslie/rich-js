// For test/suite/timeout-report.test.ts: one test that runs out its time
// waiting, one that fails on its own well inside it.
import { expect, it } from "vitest";

it("waits for ever", async () => {
  await new Promise(() => {});
});

it("fails at once", () => {
  expect(1).toBe(2);
});
