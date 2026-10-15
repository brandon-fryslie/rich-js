/**
 * The wheel over a card app: a turn the program moves nothing with scrolls the
 * page, one that moves a viewport scrolls the viewport and not the page.
 *
 * The window is short so every demo page has room to scroll past its card.
 */
import { test, expect, type Page } from "@playwright/test";
import { card, cardRows } from "./card-screen.js";

const LOADED = { timeout: 20_000 };
const ROWS = 24;

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Put the pointer over the terminal's cell at `col`, `row`, the page scrolled to show the card. */
async function pointAt(page: Page, col: number, row: number): Promise<void> {
  await cardRows(page);
  const box = (await card(page).locator(".rich-live .xterm-screen").boundingBox())!;
  const cell = box.height / ROWS;
  await page.mouse.move(box.x + cell * col, box.y + cell * (row + 0.5));
}

test.use({ viewport: { width: 1280, height: 500 } });

for (const [name, drawn] of [
  ["claude-sessions", "home-demo-rich-js"],
  ["rich-config", "─ Preview ─"],
] as const) {
  test(`the wheel over ${name}, which scrolls nothing, scrolls the page`, async ({ page }) => {
    await page.goto(`demos/${name}.html`);
    await expect.poll(async () => (await cardRows(page)).join("\n"), LOADED).toContain(drawn);
    await pointAt(page, 10, 5);
    const before = await scrollY(page);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(before);
  });
}

test("the wheel over rich-viewport scrolls the list mid-content, and the page at its end", async ({ page }) => {
  await page.goto("demos/rich-viewport.html");
  const screen = async () => (await cardRows(page)).join("\n");
  await expect.poll(screen, LOADED).toContain("/api/items/0 ");
  await pointAt(page, 10, 3);
  const before = await scrollY(page);
  await page.mouse.wheel(0, 100);
  await expect.poll(screen).not.toContain("/api/items/0 ");
  expect(await scrollY(page)).toBe(before);

  await card(page).locator(".xterm-helper-textarea").focus();
  await page.keyboard.press("End");
  await expect.poll(screen).toContain("/api/items/507");
  await pointAt(page, 10, 3);
  const atEnd = await scrollY(page);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(atEnd);
});
