/**
 * What a test that ran out its time was doing, written onto its failure.
 *
 * [LAW:nothing-unseen] vitest's timeout says only that the time ran out, and
 * that one sentence stands for different facts: the test was waiting on
 * something that never came, it was computing the whole time, or the machine
 * was too busy to run it. So the failure carries what tells them apart — how
 * much CPU this worker spent in the test's time, and how loaded the machine
 * was — and a red run says which it was without a rerun.
 *
 * The budget itself is `vitest.config.ts`'s; this only reports against it.
 */
import { availableParallelism, loadavg } from "node:os";
import { beforeEach } from "vitest";

/** The opening of the error vitest's runner makes when a test or hook runs out its budget. */
const VITEST_TIMEOUT = /^(Test|Hook) timed out in \d+ms/;

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

beforeEach(({ onTestFailed }) => {
  const started = performance.now();
  const cpu = process.cpuUsage();
  onTestFailed(({ task }) => {
    // [LAW:parse-dont-validate] The runner's own error is what says the time ran
    // out; every other failure says its own cause and is left as it is.
    const timeout = task.result!.errors!.find((error) => VITEST_TIMEOUT.test(error.message));
    if (timeout === undefined) return;
    const { user, system } = process.cpuUsage(cpu);
    timeout.message +=
      `\nIn ${seconds(performance.now() - started)} this worker used ${seconds((user + system) / 1000)} of CPU ` +
      `(not counting its child processes), at load average ${loadavg()[0]!.toFixed(1)} on ${availableParallelism()} cores. ` +
      `CPU near the elapsed time: it was computing the whole time. A load above the cores: the machine was too busy to run it. ` +
      `Neither: it was waiting, on an event, a child process or I/O.`;
  });
});
