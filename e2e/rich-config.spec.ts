/**
 * The acceptance test of rich-runtime-fna under the browser host: the
 * rich-config demo, its widgets in a `Panel` in one pane of a `Layout` split,
 * driven through a real xterm.js by the keyboard and the mouse — the bytes for
 * both are xterm's own, produced from DOM events, not written by this test.
 *
 * `test/examples/rich-config/union.test.ts` runs the same demo under the node
 * host; the demo has no path of its own for either.
 */
import { test, expect, type Page } from "@playwright/test";
import { cellLen } from "../src/core/cells.js";
import { DEMO_TERMINAL } from "../examples/_browser-shell/demo-terminal.js";

/** The terminal's rows as the user reads them. */
async function screen(page: Page): Promise<string[]> {
  const rows = await page.locator(".xterm-rows > div").allTextContents();
  return rows.map((row) => row.replace(/\u00a0/g, " "));
}

async function shows(page: Page, text: string): Promise<void> {
  await expect.poll(async () => (await screen(page)).join("\n")).toContain(text);
}

/** Click the cell where `text` first appears on screen, at its first character. */
async function clickOn(page: Page, text: string): Promise<void> {
  const rows = await screen(page);
  const y = rows.findIndex((row) => row.includes(text));
  expect(y, `"${text}" is on screen:\n${rows.join("\n")}`).toBeGreaterThanOrEqual(0);
  // A string index counts code units; the terminal counts cells.
  const x = cellLen(rows[y]!.slice(0, rows[y]!.indexOf(text)));
  const box = await page.locator(".xterm-screen").boundingBox();
  if (box === null) throw new Error("the terminal's screen is not laid out");
  const cell = { width: box.width / DEMO_TERMINAL.cols, height: box.height / DEMO_TERMINAL.rows };
  await page.mouse.click(
    box.x + (x + 0.5) * cell.width,
    box.y + (y + 0.5) * cell.height,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("demos-app/rich-config/");
  await expect(page.locator("#status")).toContainText("ready");
  await shows(page, "─ Widgets ─");
});

test("draws the widgets in a panel beside the preview", async ({ page }) => {
  const rows = await screen(page);
  const titles = rows.find((row) => row.includes("─ Widgets ─"));
  expect(titles).toContain("─ Preview ─");
  const muted = rows.find((row) => row.includes("Muted"));
  expect(muted?.startsWith("│")).toBe(true);
});

test("moves focus through the panel by Tab, and hands the focused widget its key", async ({ page }) => {
  await shows(page, "▸ dd-theme ");
  await page.keyboard.press("Tab");
  await shows(page, "▸ in-search ");
  await page.keyboard.press("Tab");
  await shows(page, "▸ cb-muted ");
  await page.keyboard.press("Space");
  await shows(page, "Muted swatches → hidden");
});

test("gives a click to the widget drawn under it, and focuses it", async ({ page }) => {
  await clickOn(page, "[✓] Progress");
  await shows(page, "Progress bars → hidden");
  await shows(page, "▸ cb-progress ");
  await shows(page, "[ ] Progress");
});

test("opens the dropdown's list over the panel, and a click on an option picks it", async ({ page }) => {
  await clickOn(page, "▾]");
  await shows(page, "Nord");
  await clickOn(page, "Nord");
  await shows(page, "Switched to Nord theme");
  await shows(page, "│ Nord ");
});
