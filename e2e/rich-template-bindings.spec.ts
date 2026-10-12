/**
 * The rich-template-bindings demo in its card on the demo page, driven
 * through the card's xterm.js by the keyboard: a template typed into renders
 * beside it on the next frame, and PageDown moves to the next section. The
 * keys are xterm's own, produced from DOM events.
 */
import { test, expect, type Page } from "@playwright/test";
import { card, cardRows } from "./card-screen.js";

const screen = async (page: Page) => (await cardRows(page)).join("\n");
const LOADED = { timeout: 20_000 };
const SECTIONS = ["Push — pipes", "Theme matrix —", "Ramps —", "Colour values —"];

test.beforeEach(async ({ page }) => {
  await page.goto("demos/rich-template-bindings.html");
  await expect.poll(() => screen(page), LOADED).toContain(SECTIONS[0]);
  // Keys reach the program once its terminal has focus.
  await card(page).locator(".xterm-helper-textarea").focus();
});

test("text typed into a template shows in the template, its output, and the push panel", async ({ page }) => {
  await page.keyboard.type("QZX");
  // Plain text outside a tag renders as itself: in the editor, the output pane, and the push panel.
  await expect.poll(async () => (await screen(page)).split("QZX").length - 1, LOADED).toBe(3);
});

test("PageDown moves to the next section", async ({ page }) => {
  await page.keyboard.press("PageDown");
  await expect.poll(() => screen(page), LOADED).toContain("Theme matrix");
  await expect.poll(() => screen(page), LOADED).not.toContain(SECTIONS[0]);
});

// The card keeps no scrollback, so a section taller than the terminal loses
// its bottom with no way to reach it: every section must end above the last row.
test("every section fits in the card", async ({ page }) => {
  for (const [i, name] of SECTIONS.entries()) {
    if (i > 0) await page.keyboard.press("PageDown");
    await expect.poll(() => screen(page), LOADED).toContain(name);
    const rows = await cardRows(page);
    expect(rows.at(-1)!.trim(), `${name} reaches the card's last row`).toBe("");
  }
});
