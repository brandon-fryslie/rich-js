/**
 * The `test` every spec runs under: Playwright's, with the site's xterm.js
 * served from node_modules instead of jsDelivr.
 *
 * A browser here may stall fetching the CDN, with no failed request and no
 * error: every live terminal then stays at its Run button, which reads exactly
 * like a regression in the page. Served from disk, the suite answers about the
 * page and not the network (rich-unfiled-791c.5v4l).
 *
 * [LAW:one-source-of-truth] The version is XTERM's, in the URLs it names; a
 * file's path is its URL with the package prefix taken off. The pinned
 * `@xterm/xterm` devDependency is held to it by the browser itself, which checks
 * every served file against XTERM's integrity hash and refuses one that differs.
 *
 * [LAW:no-silent-failure] Any other jsDelivr request is aborted, so a new CDN
 * dependency fails at its request instead of riding the network.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test as base } from "@playwright/test";
import { XTERM } from "../docs/.vitepress/theme/xterm.js";

const PACKAGE_URL = XTERM.script.src.slice(0, XTERM.script.src.indexOf("/lib/") + 1);
const PACKAGE_DIR = dirname(createRequire(import.meta.url).resolve("@xterm/xterm/package.json"));
const CONTENT_TYPES = { ".js": "text/javascript", ".css": "text/css" } as const;

export const test = base.extend<{ cdn: void }>({
  cdn: [
    async ({ page }, use) => {
      await page.route("https://cdn.jsdelivr.net/**", async (route) => {
        const url = route.request().url();
        const type = Object.entries(CONTENT_TYPES).find(([extension]) => url.endsWith(extension))?.[1];
        if (!url.startsWith(PACKAGE_URL) || type === undefined) return route.abort("blockedbyclient");
        // jsDelivr sends this; without it a crossorigin load is refused.
        await route.fulfill({
          body: await readFile(join(PACKAGE_DIR, url.slice(PACKAGE_URL.length))),
          contentType: type,
          headers: { "access-control-allow-origin": "*" },
        });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
