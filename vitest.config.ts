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

export default defineConfig({
  test: {
    include: ["test/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", "dist-demo", "e2e"],
  },
});
