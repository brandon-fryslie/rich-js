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

it("a timeout reports this worker's CPU and the machine's load, and no other failure does", () => {
  const run = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, "node_modules", "vitest", "vitest.mjs"), "run", "--config", path.join(import.meta.dirname, "fixtures", "vitest.config.ts")],
    { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
  );
  const output = run.stdout + run.stderr;

  expect(run.status).toBe(1);
  expect(output).toMatch(
    /Test timed out in 1000ms\.[^\n]*\n[^\n]*\nIn \d+\.\d s this worker used \d+\.\d s of CPU, at load average \d+\.\d on \d+ cores\./,
  );
  expect(output).toContain("expected 1 to be 2");
  expect(output.match(/this worker used/g)).toHaveLength(1);
});
