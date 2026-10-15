/**
 * The claude-sessions demo in its card on the demo page: the sidebar lists the
 * staged projects, a real session opens in the viewer, and `q` ends it.
 */
import { test, expect, type Page } from "@playwright/test";
import { card, cardRows } from "./card-screen.js";

const screen = async (page: Page) => (await cardRows(page)).join("\n");
const LOADED = { timeout: 20_000 };

const press = async (page: Page, key: string) => {
  await card(page).locator(".xterm-helper-textarea").focus();
  await page.keyboard.press(key);
};

test.beforeEach(async ({ page }) => {
  await page.goto("demos/claude-sessions.html");
  await expect.poll(() => screen(page), LOADED).toContain("home-demo-code-rich-js");
});

test("a staged session opens in the viewer", async ({ page }) => {
  await press(page, "Enter"); // into the project
  await press(page, "Enter"); // open its session
  await expect.poll(() => screen(page), LOADED).toMatch(/Loaded \d+ blocks/);
  expect(await screen(page)).toContain("🧑 user");
});

test("q ends the program", async ({ page }) => {
  await press(page, "q");
  await expect.poll(() => screen(page), LOADED).toContain("claude-sessions has quit.");
});

// Its link carries every staged session, the largest program a link carries
// (MAX_PROGRAM_BYTES, playground-hash.ts): the playground opens and runs it.
test("Open in playground runs the demo there", async ({ page }) => {
  const link = page.getByRole("link", { name: "Open in playground" });
  expect((await link.getAttribute("href"))!.length, "the link carries the program").toBeGreaterThan(100_000);
  await link.click();
  await expect(page).toHaveURL(/\/playground#program\..+/);
  await expect.poll(() => screen(page), LOADED).toContain("home-demo-code-rich-js");
});
