/// <reference lib="dom" />
/**
 * What a browser does with exported right-to-left text. The bytes are pinned in
 * test/core/bidi-order.test.ts; whether a browser reverses a sealed row, and
 * leaves a visual row's cells where they stand, only a browser can show.
 * Measured by glyph position, so no font and no ligature enters the check.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { encodeHtmlFragment } from "../src/core/export-html.js";
import { Segment } from "../src/core/segment.js";
import { RichText } from "../src/core/text.js";
import type { TextOrder } from "../src/core/text-order.js";
import { createRequire } from "node:module";

/** A file of the `@xterm/xterm` the site bundles, from disk. */
const XTERM_FILE = (file: string): string => createRequire(import.meta.url).resolve(`@xterm/xterm/${file}`);

const FIRST = "א";
const LAST = "ה";
const HEBREW = "אבגדה";

const fragment = (order: TextOrder): string =>
  encodeHtmlFragment(new RichText(HEBREW, { end: "" }).render({ maxWidth: 40, textOrder: order }));

/** Whether the first letter of the sentence stands right of its last on the page as it is. */
const standsRightToLeft = (page: Page): Promise<boolean> =>
  page.evaluate(
    ({ first, last }) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const left = (letter: string): number => {
        walker.currentNode = document.body;
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const at = node.textContent!.indexOf(letter);
          if (at < 0) continue;
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + letter.length);
          return range.getBoundingClientRect().left;
        }
        throw new Error(`no ${letter} on the page`);
      };
      return left(first) > left(last);
    },
    { first: FIRST, last: LAST },
  );

async function readsRightToLeft(page: Page, html: string): Promise<boolean> {
  await page.setContent(`<!doctype html><meta charset="utf-8">${html}`);
  return standsRightToLeft(page);
}

test("a sealed logical row reverses in the browser", async ({ page }) => {
  expect(await readsRightToLeft(page, fragment("logical"))).toBe(true);
});

test("a visual row keeps its cells: the browser does not reverse it again", async ({ page }) => {
  expect(await readsRightToLeft(page, fragment("visual"))).toBe(true);
});

test("raw unstamped text is the browser's to order", async ({ page }) => {
  expect(await readsRightToLeft(page, encodeHtmlFragment([new Segment(HEBREW)]))).toBe(true);
});

// The site's terminal is xterm.js's DOM renderer, which lays a row out through
// the browser, so the browser reorders it: why `detectTextOrder` lists neither
// xterm.js nor VS Code as `visual`, where this would reverse twice.
test("xterm.js's DOM renderer reorders a right-to-left row itself", async ({ page }) => {
  await page.setContent(`<!doctype html><meta charset="utf-8"><div id="host"></div>`);
  await page.addStyleTag({ path: XTERM_FILE("css/xterm.css") });
  await page.addScriptTag({ path: XTERM_FILE("lib/xterm.js") });
  await page.evaluate(async (text) => {
    const terminal = new (globalThis as unknown as { Terminal: new (options: object) => { open(el: Element): void; write(data: string, done: () => void): void } }).Terminal({ cols: 40, rows: 4 });
    terminal.open(document.querySelector("#host")!);
    await new Promise<void>((resolve) => terminal.write(text, resolve));
  }, HEBREW);
  await expect.poll(() => page.locator(".xterm-rows").innerText()).toContain(FIRST);
  expect(await standsRightToLeft(page)).toBe(true);
});
