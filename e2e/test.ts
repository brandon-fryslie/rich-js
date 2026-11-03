/**
 * The `test` every spec runs under: Playwright's, with the site's xterm.js
 * served from node_modules instead of jsDelivr.
 *
 * A browser here may stall fetching the CDN, with no failed request and no
 * error: every live terminal then stays at its Run button, which reads exactly
 * like a regression in the page. Served from disk, the suite answers about the
 * page and not the network (rich-unfiled-791c.5v4l).
 *
 * The route sits on a browser context, because that is where pages come from:
 * the `context` fixture is routed, and a spec that makes its own context passes
 * it through `cdn` first.
 *
 * [LAW:one-source-of-truth] The version is XTERM's, in the URLs it names; a
 * file's path is its URL with the package prefix taken off. The installed
 * `@xterm/xterm` must be that version, checked when this module loads.
 *
 * [LAW:no-silent-failure] Any other jsDelivr request, or one naming a file the
 * package lacks, is refused, and the test fails naming it.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test as base, expect, type BrowserContext } from "@playwright/test";
import { XTERM } from "../docs/.vitepress/theme/xterm.js";

const PACKAGE_URL = XTERM.script.src.slice(0, XTERM.script.src.indexOf("/lib/") + 1);
const PACKAGE_JSON = createRequire(import.meta.url).resolve("@xterm/xterm/package.json");
const PACKAGE_DIR = dirname(PACKAGE_JSON);
const CONTENT_TYPES = { ".js": "text/javascript", ".css": "text/css" } as const;

const installed = (JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string }).version;
if (!PACKAGE_URL.endsWith(`@${installed}/`)) {
  throw new Error(`@xterm/xterm ${installed} is installed, but the site loads ${PACKAGE_URL}`);
}

// The bytes are fixed for the run: one read per file per worker.
const files = new Map<string, Promise<Buffer | string>>();

/** The file a package URL names, or why it cannot be served. */
function served(url: string): Promise<Buffer | string> {
  if (!url.startsWith(PACKAGE_URL)) return Promise.resolve("not the pinned xterm package");
  const path = join(PACKAGE_DIR, url.slice(PACKAGE_URL.length));
  let file = files.get(path);
  if (file === undefined) {
    file = readFile(path).catch((error: NodeJS.ErrnoException) => `${error.code ?? error.message}: ${path}`);
    files.set(path, file);
  }
  return file;
}

export const test = base.extend<{ cdn: (context: BrowserContext) => Promise<BrowserContext> }>({
  cdn: async ({}, use) => {
    const refused: string[] = [];
    await use(async (context) => {
      await context.route("https://cdn.jsdelivr.net/**", async (route) => {
        const url = route.request().url();
        const type = Object.entries(CONTENT_TYPES).find(([extension]) => url.endsWith(extension))?.[1];
        const body = type === undefined ? "not a .js or .css file" : await served(url);
        if (typeof body === "string") {
          refused.push(`${url} (${body})`);
          return route.abort("blockedbyclient");
        }
        // jsDelivr sends this; without it a crossorigin load is refused.
        await route.fulfill({ body, contentType: type, headers: { "access-control-allow-origin": "*" } });
      });
      return context;
    });
    expect(refused, "jsDelivr requests the suite does not serve from disk").toEqual([]);
  },
  context: async ({ context, cdn }, use) => {
    await use(await cdn(context));
  },
});

export { expect };
