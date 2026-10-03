/**
 * [LAW:locality-or-seam] Make the seam between unit tests and the
 * headless-browser e2e gate explicit. Without this config, vitest's default
 * glob matches `**\/*.spec.ts` anywhere in the repo and would attempt to run
 * the Playwright suite in `e2e/` as if it were vitest — vitest discovers it,
 * doesn't recognise the `@playwright/test` API, and the file fails to load.
 *
 * [LAW:single-enforcer] One runner per concern: vitest owns unit-level
 * contract tests under `test/`; Playwright owns the headless-browser demo
 * gate under `e2e/`. Configuration encodes the partition rather than relying
 * on filename coincidence.
 */
import { defineConfig } from "vitest/config";
import { tscTransform } from "./scripts/tsc-transform.js";

// [LAW:single-enforcer] A timeout is a hang detector, not a speed budget, so it
// has one home, and a hook is as much a place a run can hang as a test. Tests
// that spawn git, npm, node or a vite build pass in 1–3s alone and cross
// vitest's 5s default under a full suite's load, and the per-file allowances
// that chased them missed each new file until it flaked. A hang still fails, at
// 30s. A test whose work is a different size by nature — a whole docs page run
// through the examples plugin, a complexity guard that must finish in 2s —
// states its own budget beside it. A test that runs out its time says, on its
// failure, whether it was waiting or the machine was slow: test/suite/timeout-report.ts.
const HANG_MS = 30_000;

export default defineConfig({
  plugins: [tscTransform(import.meta.dirname)],
  test: {
    include: ["test/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", "dist-demo", "e2e"],
    testTimeout: HANG_MS,
    hookTimeout: HANG_MS,
    setupFiles: ["test/suite/timeout-report.ts"],
  },
});
