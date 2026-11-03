/**
 * Every e2e page loads xterm.js from disk only if it comes from a context
 * `e2e/test.ts` routed: specs take `test` from there, never from
 * `@playwright/test`, and a context a spec makes itself goes through `cdn`,
 * spelled `cdn(await browser.newContext(…))` — one spelling, so it can be read.
 * A page outside that reaches jsDelivr, and a stalled CDN reads as a page
 * regression again — with no refusal, because no route ever saw the request.
 *
 * What is served is the `@xterm/xterm` devDependency, so it must pin the version
 * every URL in XTERM names.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { XTERM } from "../../docs/.vitepress/theme/xterm.js";

const ROOT = join(import.meta.dirname, "../..");
const E2E = join(ROOT, "e2e");
// Playwright's testDir is e2e/, read recursively, so this is too.
const files = readdirSync(E2E, { recursive: true, encoding: "utf8" }).filter(
  (name) => name.endsWith(".ts") && name !== "test.ts",
);

const CHECKS = [
  { what: "value import from @playwright/test", pattern: /^import\s+(?!type\s)[^;]*?from\s+"@playwright\/test"/gm },
  { what: "dynamic import of @playwright/test", pattern: /import\(\s*"@playwright\/test"\s*\)/g },
  { what: "unrouted page", pattern: /\bbrowser\s*\.\s*newPage\s*\(/g },
  { what: "unrouted context", pattern: /(?<!cdn\(await\s+)\bbrowser\s*\.\s*newContext\s*\(/g },
] as const;

describe("e2e pages come from routed contexts", () => {
  it.each(files)("%s", (name) => {
    const source = readFileSync(join(E2E, name), "utf8");
    const found = CHECKS.flatMap(({ what, pattern }) =>
      [...source.matchAll(pattern)].map((match) => `${what}: ${name}:${source.slice(0, match.index).split("\n").length}`),
    );
    expect(found).toEqual([]);
  });

  it("the served @xterm/xterm is the version the site loads", () => {
    const pinned = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { devDependencies: Record<string, string> })
      .devDependencies["@xterm/xterm"];
    for (const url of [XTERM.script.src, XTERM.stylesheet.href]) expect(url).toContain(`/@xterm/xterm@${pinned}/`);
  });
});
