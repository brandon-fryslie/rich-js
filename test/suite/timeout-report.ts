/**
 * What a test that ran out its time was doing, written onto its failure.
 *
 * [LAW:nothing-unseen] vitest's timeout says only that the time ran out, and
 * that one sentence stands for two different facts: the test was waiting on
 * something that never came, or it was working and the machine was too busy
 * to finish it in time. The first is a bug; the second is the machine. So the
 * failure carries what tells them apart — how much CPU this worker spent in
 * the test's time, and how loaded the machine was — and a red run says which
 * it was without a rerun.
 *
 * The budget itself is `vitest.config.ts`'s; this only reports against it.
 */
import { availableParallelism, loadavg } from "node:os";
import { beforeEach } from "vitest";

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

beforeEach(({ onTestFailed }) => {
  const started = performance.now();
  const cpu = process.cpuUsage();
  onTestFailed(({ task }) => {
    const elapsed = performance.now() - started;
    // Only a test that ran its whole budget timed out; any other failure says its own cause.
    if (elapsed < task.timeout) return;
    const { user, system } = process.cpuUsage(cpu);
    const error = task.result!.errors![0]!;
    error.message +=
      `\nIn ${seconds(elapsed)} this worker used ${seconds((user + system) / 1000)} of CPU, ` +
      `at load average ${loadavg()[0]!.toFixed(1)} on ${availableParallelism()} cores. ` +
      `CPU near its time, or a load above the cores, means the machine was slow; neither means the test was waiting.`;
  });
});
