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

export default defineConfig({
  plugins: [tscTransform(import.meta.dirname)],
  test: {
    include: ["test/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", "dist-demo", "e2e"],
    // [LAW:single-enforcer] A test's timeout is a hang detector, not a speed
    // budget, so it has one home. Tests that spawn git, npm, node or a vite
    // build pass in 1–3s alone and cross vitest's 5s default under a full
    // suite's load, and the per-file allowances that chased them missed each
    // new file until it flaked. A hang still fails, at 30s. A test asserting
    // speed states its own budget beside the work it times.
    testTimeout: 30_000,
  },
});
