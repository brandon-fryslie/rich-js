/**
 * Vitest's global setup: the demos' staging taken from this repository,
 * written before any test file is collected, since tests import the demos'
 * card entries that import it (scripts/repo-staging.ts). Run as the script
 * the `pre` scripts run, under Node's own type stripping, which is what that
 * script's `.ts` imports are written for.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../scripts/stage-repo-files.ts", import.meta.url))], { stdio: "inherit" });
}
