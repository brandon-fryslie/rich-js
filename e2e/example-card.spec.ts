/// <reference lib="dom" />
/**
 * A static docs example is an editable card (docs/.vitepress/theme/RichExample.ts),
 * in the built site: at rest it is the page's highlighted code over the output
 * the build printed, and hydrating it moves nothing; clicking into the code
 * and typing re-renders the output from the edit; reset puts the page's code
 * and output back; and a program that never ends leaves the page responsive
 * while the card says it was stopped. A silent or throws block is the same
 * card; a shape or node block is too, read-only.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
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
  expect((await decodeProgram(new URL(page.url()).hash.slice(1))).files[0].code).toContain("An Edited Row");
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

test("a click above a card's code opens it folded, and an error's line is counted in the setup it shows", async ({ page }) => {
  const errors = await open(page, "tables.html");
  const card = page.locator(".rich-example-card").filter({ hasText: "const scores" });
  await expect(card).toHaveClass(/rich-example-editable/, { timeout: 10_000 });
  // The fence's top padding, above its first line.
  await card.locator("pre.shiki").click({ position: { x: 40, y: 5 } });
  await expect(card.locator(".cm-content")).toBeFocused({ timeout: 10_000 });
  await expect(card.locator(".rich-setup-strip")).toBeVisible();
  await page.keyboard.type("throw new RangeError(\"edited\");\n");
  // Two lines of setup, each with the blank line under it: the block's first line is the program's fifth.
  await expect(card.locator(".rich-example-failure")).toHaveText(/RangeError: edited \(line 5\)$/, { timeout: 15_000 });
  await expect(card.locator(".rich-setup-label")).toHaveCount(2);
  expect(errors).toEqual([]);
});

/**
 * The card around the block whose code holds `text`, on the page open: pinned
 * by its place on the page, so it stays this card once an edit takes the text out.
 */
async function cardWith(page: Page, text: string): Promise<Locator> {
  const cards = page.locator(".rich-example-card");
  const at = await cards.evaluateAll((all, text) => all.findIndex((card) => card.textContent!.includes(text)), text);
  expect(at, `a card holding ${JSON.stringify(text)}`).not.toBe(-1);
  return cards.nth(at);
}

/** Put the editor in `card` and its cursor at the start of the block's last line. */
async function editLastLine(page: Page, card: Locator): Promise<void> {
  await expect(card).toHaveClass(/rich-example-editable/, { timeout: 10_000 });
  await card.locator("pre.shiki").click();
  await expect(card.locator(".cm-content")).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Home");
}

test("a silent block says it prints nothing until an edit prints something", async ({ page }) => {
  const errors = await open(page, "console.html");
  const card = await cardWith(page, "const console = new Console();");
  await expect(card.locator(".rich-example-note")).toHaveText("This example prints nothing when it runs.");
  await expect(card.locator(".rich-example-light")).toHaveCount(0);
  await editLastLine(page, card);
  await page.keyboard.press("End");
  await page.keyboard.type('\nconsole.print("now it prints");');
  await expect(card.locator(".rich-example-light pre")).toContainText("now it prints", { timeout: 15_000 });
  await expect(card.locator(".rich-example-note")).toHaveCount(0);
  await card.getByRole("button", { name: "reset" }).click();
  await expect(card.locator(".rich-example-note")).toHaveText("This example prints nothing when it runs.");
  expect(errors).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test(`a throws block shows its error as the page does, and an edit that stops it throwing shows its output (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const errors = await open(page, "markup.html");
    const card = await cardWith(page, "[bold]Hello[/red]");
    const output = card.locator(`.rich-example-${scheme} pre`);
    await expect(output).toBeVisible();
    await expect(output).toContainText("MarkupSyntaxError");
    await expect(card.locator(".rich-example-caption")).toHaveText("produced by running the code above, which throws");
    await editLastLine(page, card);
    await page.keyboard.press("Shift+End");
    await page.keyboard.type('console.print("[bold]Hello[/bold]");');
    await expect(output).toHaveText(/^\s*Hello\s*$/, { timeout: 15_000 });
    await expect(card.locator(".rich-example-caption")).toHaveText("produced by running the code above");
    await expect(card.locator(".rich-example-failure")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const [marker, path, code, note] of [
  ["shape", "effects.html", "type Effect =", "This is a shape to implement, not a complete program."],
  ["node", "console.html", "nodeAsk);", "It needs a real Node process"],
] as const) {
  test(`a ${marker} block is the same card, read-only, with its note`, async ({ page }) => {
    const errors = await open(page, path);
    const card = await cardWith(page, code);
    await expect(card.locator(".rich-example-name")).toHaveText("Not run");
    await expect(card.locator(".rich-example-note")).toContainText(note);
    await expect(card.getByRole("link", { name: "Try it" })).toHaveCount(0);
    // The page is hydrated once an editable card says so; this card never does.
    const editable = page.locator(".rich-example-editable").first();
    await expect(editable).toBeVisible({ timeout: 10_000 });
    await expect(card).not.toHaveClass(/rich-example-editable/);
    await card.locator("pre.shiki").click();
    // An editor opened after the click proves one would have opened here by now.
    await editable.locator("pre.shiki").click();
    await expect(editable.locator(".cm-content")).toBeFocused({ timeout: 10_000 });
    await expect(card.locator(".cm-editor")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
