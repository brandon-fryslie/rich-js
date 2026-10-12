/**
 * The claude-sessions demo in its card on the demo page: the sidebar lists the
 * fixture's project, its session opens in the viewer, and `q` ends it.
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
  await expect.poll(() => screen(page), LOADED).toContain("home-demo-rich-js");
});

test("the fixture's session opens in the viewer", async ({ page }) => {
  await press(page, "Enter"); // into the project
  await press(page, "Enter"); // open its session
  await expect.poll(() => screen(page), LOADED).toContain("Welcome to the claude-sessions demo");
});

test("q ends the program", async ({ page }) => {
  await press(page, "q");
  await expect.poll(() => screen(page), LOADED).toContain("claude-sessions has quit.");
});
