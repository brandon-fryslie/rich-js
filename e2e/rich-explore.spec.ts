/**
 * The rich-explore demo in its card on the demo page, driven by the keyboard
 * through the card's xterm.js: it browses part of this repository, a key moves the
 * selection and the preview follows, and `c` opens the coverage page.
 */
import { test, expect, type Page } from "@playwright/test";
import { card, cardRows } from "./card-screen.js";

const screen = async (page: Page) => (await cardRows(page)).join("\n");
const LOADED = { timeout: 20_000 };

test.beforeEach(async ({ page }) => {
  await page.goto("demos/rich-explore.html");
  await expect.poll(() => screen(page), LOADED).toContain("README.md");
  await card(page).locator(".xterm-helper-textarea").focus();
});

test("the selection moves with the arrow keys and the preview follows it", async ({ page }) => {
  await expect.poll(() => screen(page), LOADED).toContain("/home/demo/rich-js/.github");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => screen(page), LOADED).toContain("/home/demo/rich-js/docs");
  // Past src, test, .gitignore and LICENSE to package.json, previewed as JSON.
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
  await expect.poll(() => screen(page), LOADED).toContain('"@promptctl/rich-js"');
});

test("c swaps the preview for the coverage page and back", async ({ page }) => {
  await page.keyboard.press("c");
  await expect.poll(() => screen(page), LOADED).toContain("Coverage — all rich-js exports");
  await page.keyboard.press("c");
  await expect.poll(() => screen(page), LOADED).not.toContain("Coverage — all rich-js exports");
  await expect.poll(() => screen(page), LOADED).toContain("workflows");
});

// Escape is the first half of the card's way out (Escape then Tab), so it
// must not end the program on the way.
test("Escape then Tab leaves the card with the explorer still running", async ({ page }) => {
  const input = card(page).locator(".xterm-helper-textarea");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(input).not.toBeFocused();
  // Only a running program can move the selection, so ask it to: G, to the last
  // entry.
  await input.focus();
  await page.keyboard.press("G");
  await expect.poll(() => screen(page), LOADED).toContain("/home/demo/rich-js/tsconfig.json");
});

// The card keeps no scrollback: the status bar is the frame's last row.
test("the frame fits the card", async ({ page }) => {
  const rows = await cardRows(page);
  expect(rows.at(-1)!, "the status bar is the last row").toMatch(/quit/);
});
