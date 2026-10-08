/// <reference lib="dom" />
/**
 * A static docs example is an editable card (docs/.vitepress/theme/RichExample.ts),
 * in the built site: at rest it is the page's highlighted code over the output
 * the build printed, and hydrating it moves nothing; clicking into the code
 * and typing re-renders the output from the edit; reset puts the page's code
 * and output back; and a program that never ends leaves the page responsive
 * while the card says it was stopped.
 */
import { test, expect, type Page } from "@playwright/test";
import { decodeProgram } from "../docs/.vitepress/playground-hash.js";

async function open(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  return errors;
}

/** The first table on docs/tables.md, the one its "Basic usage" builds. */
const firstCard = (page: Page) => page.locator(".rich-example-card").first();

/** What the card's output shows, as text, in the light colour mode. */
const shown = (page: Page) => firstCard(page).locator(".rich-example-light pre").innerText();

/** Put the editor in the card, its cursor where the page's code is clicked. */
async function edit(page: Page): Promise<void> {
  // Until the card is hydrated a click reaches nothing; the card says when it can be edited.
  await expect(firstCard(page)).toHaveClass(/rich-example-editable/, { timeout: 10_000 });
  await firstCard(page).locator("pre.shiki").click();
  await expect(firstCard(page).locator(".cm-content")).toBeFocused({ timeout: 10_000 });
}

test("at rest, the card is the page's highlighted code over the build's output, and hydrating it moves nothing", async ({ browser }) => {
  // The page as the server wrote it, with no script to hydrate it.
  const still = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  await still.goto("tables.html");
  const served = await firstCard(still).boundingBox();
  const servedText = await shown(still);
  await still.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = await open(page, "tables.html");
  await page.waitForLoadState("networkidle");
  const card = firstCard(page);
  await expect(card.locator("pre.shiki")).toBeVisible();
  await expect(card.locator(".cm-editor")).toHaveCount(0);
  await expect(card.locator(".rich-example-name")).toHaveText("Output");
  await expect(card.getByRole("link", { name: "Try it" })).toHaveAttribute("href", /playground#/);
  expect(await card.boundingBox()).toEqual(served);
  expect(await shown(page)).toBe(servedText);
  expect(servedText).toContain("Star Wars Box Office");
  expect(errors).toEqual([]);
  await page.close();
});

test("editing the first table's rows re-renders it, and reset puts the page's back", async ({ page }) => {
  const errors = await open(page, "tables.html");
  const before = await shown(page);
  const tryIt = firstCard(page).getByRole("link", { name: "Try it" });
  const original = (await tryIt.getAttribute("href"))!;
  await edit(page);
  // The page's last line prints the table; a row added above it is in what it prints.
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
  await page.keyboard.type('table.addRow("Oct 8, 2026", "An Edited Row", "$1", "$2");\n');
  await expect.poll(() => shown(page), { timeout: 15_000 }).toContain("An Edited Row");
  await expect(firstCard(page).locator(".rich-example-edited")).toContainText("edited");
  await expect(firstCard(page).locator(".rich-example-failure")).toHaveCount(0);
  await expect(tryIt).not.toHaveAttribute("href", original);

  await firstCard(page).getByRole("button", { name: "reset" }).click();
  await expect.poll(() => shown(page)).toBe(before);
  await expect(tryIt).toHaveAttribute("href", original);
  await expect(firstCard(page).locator(".rich-example-edited")).toHaveCount(0);
  await expect(firstCard(page).locator(".cm-content")).toContainText("Star Wars Box Office");
  expect(errors).toEqual([]);
});

test("a program that never ends leaves the page responsive, and the card says it was stopped", async ({ page }) => {
  const errors = await open(page, "tables.html");
  await edit(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
  await page.keyboard.type("while (true) {}\n");
  // The loop runs in the card's worker: the page answers while it spins.
  await page.waitForTimeout(1_000);
  const answered = await Promise.race([
    page.evaluate(() => "answered"),
    new Promise<string>((resolve) => setTimeout(() => resolve("frozen"), 1_000)),
  ]);
  expect(answered).toBe("answered");
  await expect(firstCard(page).locator(".rich-example-failure")).toContainText("Stopped after 5 s", { timeout: 15_000 });
  // The last good output stays, dimmed.
  await expect(firstCard(page).locator(".rich-example-output")).toHaveClass(/rich-example-stale/);
  expect(await shown(page)).toContain("Star Wars Box Office");
  expect(errors).toEqual([]);
});

test("a program that prints without end is stopped in its worker, and the page stays responsive", async ({ page }) => {
  const errors = await open(page, "tables.html");
  await edit(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
  await page.keyboard.type('for (;;) console.print("flood");\n');
  await expect(firstCard(page).locator(".rich-example-failure")).toContainText("it was still printing", { timeout: 15_000 });
  expect(await page.evaluate(() => "answered")).toBe("answered");
  await expect(firstCard(page).locator(".rich-example-output")).toHaveClass(/rich-example-stale/);
  expect(await shown(page)).toContain("Star Wars Box Office");
  expect(errors).toEqual([]);
});

test("a program that exits 0 is drawn as one that finished", async ({ page }) => {
  const errors = await open(page, "tables.html");
  await edit(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
  await page.keyboard.type('table.addRow("Oct 8, 2026", "An Exiting Row", "$1", "$2");\n');
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nprocess.exit(0);");
  // Output is no longer stale only once it is drawn from the code with the exit in it.
  await expect(firstCard(page).locator(".rich-example-output")).not.toHaveClass(/rich-example-stale/, { timeout: 15_000 });
  expect(await shown(page)).toContain("An Exiting Row");
  await expect(firstCard(page).locator(".rich-example-failure")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Try it opens the card's edit", async ({ page }) => {
  const errors = await open(page, "tables.html");
  await edit(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
  await page.keyboard.type('table.addRow("Oct 8, 2026", "An Edited Row", "$1", "$2");\n');
  await expect.poll(() => shown(page), { timeout: 15_000 }).toContain("An Edited Row");
  await firstCard(page).getByRole("link", { name: "Try it" }).click();
  await page.waitForURL(/playground/);
  // The editor draws only the lines in view, so the program is read from the link.
  expect(await decodeProgram(new URL(page.url()).hash.slice(1))).toContain("An Edited Row");
  await expect(page.locator(".rich-playground .cm-content")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an error names the card's own line, under the last good output", async ({ page }) => {
  const errors = await open(page, "tables.html");
  await edit(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
  await page.keyboard.type('throw new RangeError("edited");\n');
  // The page's block is 21 lines, the last printing the table; the throw is now line 21.
  await expect(firstCard(page).locator(".rich-example-failure")).toHaveText(/RangeError: edited \(line 21\)$/, { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("a card's setup is one strip while it has focus, the code does not move for it, and the keyboard unfolds it", async ({ page }) => {
  const errors = await open(page, "tables.html");
  // docs/tables.md's "Adding columns" card runs on setup the page gives it.
  const card = page.locator(".rich-example-card").filter({ hasText: "const scores" });
  await expect(card).toHaveClass(/rich-example-editable/, { timeout: 10_000 });
  await card.locator("pre.shiki").click();
  await expect(card.locator(".cm-content")).toBeFocused({ timeout: 10_000 });
  const strip = card.locator(".rich-setup-strip");
  await expect(strip).toHaveText("▸ 2 lines of setup");
  await expect(strip).toBeVisible();
  const code = card.locator(".cm-line").first();
  const focusedAt = await code.boundingBox();
  // The strip stands in the space above the code and takes no line: the first
  // line sits under the fence's 20px of padding, as in a card with no setup.
  expect(focusedAt!.y).toBeCloseTo((await card.locator(".cm-content").boundingBox())!.y + 20, 0);
  // Leaving the editor hides the strip and moves nothing, so a press on reset lands where it was aimed.
  await card.locator(".cm-content").blur();
  await expect(strip).toBeHidden();
  expect(await code.boundingBox()).toEqual(focusedAt);

  await code.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowUp");
  await expect(card.locator(".rich-setup-label")).not.toHaveCount(0);
  await expect(strip).toHaveCount(0);
  // A key typed in the setup changes nothing.
  await page.keyboard.type("x");
  await expect(card.locator(".rich-example-edited")).toHaveCount(0);
  expect(errors).toEqual([]);
});
