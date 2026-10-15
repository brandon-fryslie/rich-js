/**
 * The rich-dash demo in its card on the demo page: every panel draws from its
 * staging, the dashboard keeps repainting, and `q` ends it.
 */
import { test, expect, type Page } from "@playwright/test";
import { card, cardRows } from "./card-screen.js";

const screen = async (page: Page) => (await cardRows(page)).join("\n");
const LOADED = { timeout: 20_000 };

test.beforeEach(async ({ page }) => {
  await page.goto("demos/rich-dash.html");
  await expect.poll(() => screen(page), LOADED).toContain("ci-runner-07");
});

test("every panel draws from the staging", async ({ page }) => {
  const shown = await screen(page);
  expect(shown).toContain("ci-runner-07"); // sysinfo: the staged runner
  expect(shown).toContain("docs:build"); // build: this repository's pipeline
  expect(shown).toContain("A TypeScript port"); // README: this repository's
});

test("the dashboard keeps repainting", async ({ page }) => {
  const first = await screen(page);
  await expect.poll(() => screen(page), LOADED).not.toBe(first);
});

test("q ends the program", async ({ page }) => {
  await card(page).locator(".xterm-helper-textarea").focus();
  await page.keyboard.press("q");
  await expect.poll(() => screen(page), LOADED).toContain("rich-dash has quit.");
});
