/**
 * Headless-browser gate: every demo in the docs manifest boots cleanly.
 * Ticket: rich-demo-site-pek.5.
 *
 * [LAW:dataflow-not-control-flow] One test body, parameterised by manifest
 * entries. Adding/removing a demo updates coverage with zero test edits — the
 * variability lives in `docs/.vitepress/demos.json`, not in the test source.
 *
 * [LAW:one-source-of-truth] The demo list is read from the same manifest the
 * VitePress config, the dynamic-route paths file, and the landing-page index
 * read. No second list of demos lives in the test repo.
 *
 * [LAW:verifiable-goals] The triple-assert below is the operational definition
 * of "this demo rendered for real": mount shell completed (#status.ok), xterm
 * initialised AND the demo wrote data (.xterm-screen rows > 0), no silent
 * throws on the boot path (zero console errors, zero uncaught exceptions).
 * Each assertion catches a distinct failure mode; any one alone would be
 * spoofable.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface DemoManifest {
  readonly demos: ReadonlyArray<{ readonly name: string }>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(
  __dirname,
  "..",
  "docs",
  ".vitepress",
  "demos.json",
);

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as DemoManifest;

if (manifest.demos.length === 0) {
  throw new Error(
    `e2e/demos.spec.ts: manifest at ${manifestPath} contains zero demos. ` +
      `Run \`npm run docs:build\` first.`,
  );
}

for (const { name } of manifest.demos) {
  test(`demo bundle boots cleanly: ${name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(`demos-app/${name}/`);

    const status = page.locator("#status.ok");
    await expect(status).toBeAttached();
    await expect(status).toContainText("ready");

    const screen = page.locator(".xterm-screen");
    await expect(screen).toBeAttached();
    const childCount = await screen.evaluate((el) => el.children.length);
    expect(
      childCount,
      "expected .xterm-screen to contain rendered rows",
    ).toBeGreaterThan(0);

    expect(
      consoleErrors,
      `unexpected console.error calls: ${consoleErrors.join(" | ")}`,
    ).toHaveLength(0);
    expect(
      pageErrors,
      `unexpected uncaught exceptions: ${pageErrors.join(" | ")}`,
    ).toHaveLength(0);
  });
}
