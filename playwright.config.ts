/**
 * Headless-browser CI gate for the docs site demos (rich-demo-site-pek.5).
 *
 * [LAW:single-enforcer] The `webServer` block owns the test↔server lifecycle.
 * Playwright boots `vitepress preview docs` before any test runs and tears it
 * down at the end — there is no second place that starts/stops the preview
 * server for tests, and CI does not need a background-process recipe.
 *
 * [LAW:one-source-of-truth] The base URL is computed once from `VITEPRESS_BASE`
 * (default `/rich-js/`, matching docs/.vitepress/config.ts), and every test
 * navigates with relative paths against this `baseURL`. Tests cannot drift from
 * the deployed base path because they cannot construct it independently.
 *
 * [LAW:dataflow-not-control-flow] Same Playwright code runs locally and in CI;
 * the discriminator is the `CI` env value (used to pick reporters and retries),
 * not a separate config file.
 */
import { defineConfig, devices } from "@playwright/test";

const VITEPRESS_BASE = process.env["VITEPRESS_BASE"] ?? "/rich-js/";
const PREVIEW_PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] !== undefined ? 1 : 0,
  workers: process.env["CI"] !== undefined ? 2 : undefined,
  reporter: process.env["CI"] !== undefined
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}${VITEPRESS_BASE}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx vitepress preview docs --port ${PREVIEW_PORT}`,
    url: `http://localhost:${PREVIEW_PORT}${VITEPRESS_BASE}`,
    reuseExistingServer: process.env["CI"] === undefined,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
