/**
 * A test that runs out its time says what it was doing.
 *
 * [LAW:behavior-not-structure] The fixture runs under a real vitest, through
 * the suite's own config, and only the printed failure is read.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import suite from "../../vitest.config.js";

const REPORT = /\nIn \d+\.\d s this worker used \d+\.\d s of CPU \(not counting its child processes\), at load average \d+\.\d on \d+ cores\./;

it("a timeout reports this worker's CPU and the machine's load on the timeout itself, and no other failure does", () => {
  const run = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, "node_modules", "vitest", "vitest.mjs"), "run", "--config", path.join(import.meta.dirname, "fixtures", "vitest.config.ts")],
    // spawnSync holds this worker's event loop, so vitest cannot time this test
    // out while it waits; the child is given the suite's budget instead.
    { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, timeout: suite.test!.testTimeout },
  );
  const output = run.stdout + run.stderr;

  expect(run.error).toBeUndefined();
  expect(run.status).toBe(1);
  expect(output).toMatch(new RegExp(/Test timed out in 1000ms\.[^\n]*\n[^\n]*/.source + REPORT.source));
  expect(output).toContain("expected 3 to be 4");
  expect(output).not.toMatch(new RegExp(/expected 3 to be 4[^\n]*/.source + REPORT.source));
  expect(output).toContain("expected 1 to be 2");
  expect(output.match(/this worker used/g)).toHaveLength(2);
});
