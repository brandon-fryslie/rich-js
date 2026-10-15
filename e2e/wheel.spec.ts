/**
 * The wheel over a card app: a turn the program moves nothing with scrolls the
 * page, one that moves a viewport scrolls the viewport and not the page.
 *
 * The window is short so every demo page has room to scroll past its card,
 * and a notch passed outward scrolls the page as far as it would anywhere else.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { card, cardRows } from "./card-screen.js";

const LOADED = { timeout: 20_000 };

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Where one notch of 100px from `from` leaves the page, which stops at its bottom. */
const notchFrom = (page: Page, from: number) =>
  page.evaluate((from) => Math.min(from + 100, document.documentElement.scrollHeight - innerHeight), from);

/** The terminal `demo`'s card runs in, as its `card.json` sizes it. */
const size = (demo: string): { columns: number; rows: number } =>
  JSON.parse(readFileSync(`examples/${demo}/card.json`, "utf8")).terminal;

/** Put the pointer over the middle of `demo`'s cell at `col`, `row`, the page scrolled to show the card. */
async function pointAt(page: Page, demo: string, col: number, row: number): Promise<void> {
  const { columns, rows } = size(demo);
  await cardRows(page);
  const box = (await card(page).locator(".rich-live .xterm-screen").boundingBox())!;
  await page.mouse.move(box.x + (box.width / columns) * (col + 0.5), box.y + (box.height / rows) * (row + 0.5));
}

test.use({ viewport: { width: 1280, height: 500 } });

for (const [name, drawn] of [
  ["claude-sessions", "home-demo-code-rich-js"],
  ["rich-config", "─ Preview ─"],
  // A program that has ended asked for no pointer reports: the page scrolls past it natively.
  ["rich-strip", "PowerlineJoiner"],
] as const) {
  test(`the wheel over ${name}, which scrolls nothing, scrolls the page`, async ({ page }) => {
    await page.goto(`demos/${name}.html`);
    await expect.poll(async () => (await cardRows(page)).join("\n"), LOADED).toContain(drawn);
    await pointAt(page, name, 10, 5);
    const before = await scrollY(page);
    await page.mouse.wheel(0, 100);
    // The whole notch, as far as the same wheel scrolls the page anywhere else.
    await expect.poll(() => scrollY(page)).toBe(await notchFrom(page, before));
  });
}

test("the wheel over rich-viewport scrolls the list mid-content, and the page at its end", async ({ page }) => {
  await page.goto("demos/rich-viewport.html");
  const screen = async () => (await cardRows(page)).join("\n");
  await expect.poll(screen, LOADED).toContain("/api/items/0 ");
  await pointAt(page, "rich-viewport", 10, 3);
  const before = await scrollY(page);
  await page.mouse.wheel(0, 100);
  await expect.poll(screen).not.toContain("/api/items/0 ");
  expect(await scrollY(page)).toBe(before);

  await card(page).locator(".xterm-helper-textarea").focus();
  await page.keyboard.press("End");
  await expect.poll(screen).toContain("/api/items/507");
  await pointAt(page, "rich-viewport", 10, 3);
  const atEnd = await scrollY(page);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => scrollY(page)).toBe(await notchFrom(page, atEnd));
});
