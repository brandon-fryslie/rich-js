/**
 * The rich-template-bindings demo in its card on the demo page, driven
 * through the card's xterm.js by the keyboard: a template typed into renders
 * beside it on the next frame, and Ctrl+PageDown moves to the next section.
 * The keys are xterm's own, produced from DOM events.
 *
 * `test/template-bindings/demo-reactivity.test.ts` checks the same
 * reactivity over streams it writes itself.
 */
import { test, expect, type Page } from "@playwright/test";
import { card, cardRows } from "./card-screen.js";

const screen = async (page: Page) => (await cardRows(page)).join("\n");
const LOADED = { timeout: 20_000 };

test.beforeEach(async ({ page }) => {
  await page.goto("demos/rich-template-bindings.html");
  await expect.poll(() => screen(page), LOADED).toContain("Push — pipes");
  // Keys reach the program once its terminal has focus.
  await card(page).locator(".xterm-helper-textarea").focus();
});

test("text typed into a template shows in the template and in its output", async ({ page }) => {
  await page.keyboard.type("QZX");
  // Plain text outside a tag renders as itself: once in the editor, once in the output.
  await expect.poll(async () => (await screen(page)).split("QZX").length - 1, LOADED).toBeGreaterThanOrEqual(2);
});

test("Ctrl+PageDown moves to the next section", async ({ page }) => {
  await page.keyboard.press("Control+PageDown");
  await expect.poll(() => screen(page), LOADED).toContain("Theme matrix");
  await expect.poll(() => screen(page), LOADED).not.toContain("Push — pipes");
});
