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
 * of "this demo rendered for real": mount shell completed (#status.ok), the
 * demo's first frame produced visible characters (.xterm-rows textContent has
 * non-whitespace), no silent throws on the boot path (zero console errors,
 * zero uncaught exceptions). Each assertion catches a distinct failure mode;
 * any one alone would be spoofable. We assert on `.xterm-rows` text rather
 * than `.xterm-screen` structure because xterm.js populates the screen's
 * layer children during `term.open()` *before* any write — so a structural
 * child-count check passes even if the demo crashes before its first write.
 * The row textContent is the only DOM signal that survives that distinction.
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

    // Locate #status by id only, then assert class and text separately.
    // On boot failure mount.ts.tmpl sets class="err" with a "boot error: ..."
    // message — using the composite selector `#status.ok` would time out
    // without surfacing that text, so the failure output reduces to
    // "selector timeout" instead of the real error.
    const status = page.locator("#status");
    await expect(status).toBeAttached();
    await expect(status).toHaveClass("ok");
    await expect(status).toContainText("ready");

    const rows = page.locator(".xterm-rows");
    await expect(rows).toBeAttached();
    // Polls until the demo's first frame contains at least one non-whitespace
    // character. An empty 30-row terminal still has 30 row divs (just with
    // whitespace textContent), so `/\S/` is what distinguishes "demo wrote"
    // from "demo crashed before writing".
    await expect(rows).toContainText(/\S/);

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
