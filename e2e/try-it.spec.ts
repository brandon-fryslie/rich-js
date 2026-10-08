/// <reference lib="dom" />
/**
 * "Try it" on a docs example, in the built site: it opens the playground on
 * that example's card program, the setup still locked and labelled where it
 * came from, and the playground shows what the page shows under the example:
 * a static example's output drawn the same, and a live example's last frame.
 * An edit there is the link, so a reload restores it.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { decodeProgram } from "../docs/.vitepress/playground-hash.js";

async function open(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  return errors;
}

/** The card of the example whose code contains `code`. */
const card = (page: Page, code: string) => page.locator(".rich-example", { hasText: code });

// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
const text = async (rows: Locator) => (await rows.innerText()).replaceAll(" ", " ");

/** A screen's lines as a reader sees them: no trailing spaces, no blank lines at either end. */
const lines = (screen: string) =>
  screen
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
    .split("\n");

const playground = (page: Page) => page.locator(".rich-playground");
const editor = (page: Page) => playground(page).locator(".cm-content");
const drawnLines = async (output: Locator) => lines(await text(output.locator(".rich-example-light pre")));

// The editor and the library load with the first card that runs; a live terminal brings xterm.js from its CDN.
const OPENING = { timeout: 20_000 };

test("the scores table opens with its setup locked, labelled and unfolded, printing what the page shows; an edit is the link", async ({ page }) => {
  const errors = await open(page, "tables.html");
  const example = card(page, "const scores = new Table(");
  const shown = await drawnLines(example.locator(".rich-example-output"));
  const link = example.getByRole("link", { name: "Try it" });
  const { setup } = await decodeProgram((await link.getAttribute("href"))!.split("#")[1]!);
  expect(setup.before.length).toBe(2);
  await link.click();

  await expect(page).toHaveURL(/\/playground#card\..+/);
  await expect(editor(page)).toContainText("const scores = new Table(", OPENING);
  // Unfolded: every group's label and locked line is drawn, no strip folds them.
  await expect(playground(page).locator(".rich-setup-label")).toHaveText(setup.before.map((group) => `🔒︎ ${group.origin}`));
  await expect(playground(page).locator(".rich-setup-strip")).toHaveCount(0);
  await expect(playground(page).locator(".rich-setup-line")).toHaveCount(setup.before.flatMap((group) => group.lines).length);
  await expect.poll(() => drawnLines(playground(page).locator(".rich-example-output")), OPENING).toEqual(shown);

  // A locked line takes no typing: select-all and type replaces the block alone.
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText('console.print("[bold]edited scores[/]");');
  await expect.poll(async () => (await decodeProgram(new URL(page.url()).hash.slice(1))).code).toBe('console.print("[bold]edited scores[/]");');
  expect((await decodeProgram(new URL(page.url()).hash.slice(1))).setup).toEqual(setup);
  await expect.poll(() => drawnLines(playground(page).locator(".rich-example-output"))).toEqual(["edited scores"]);

  await page.reload();
  await expect(editor(page)).toContainText("edited scores", OPENING);
  await expect(playground(page).locator(".rich-setup-label")).toHaveText(setup.before.map((group) => `🔒︎ ${group.origin}`));
  await expect.poll(() => drawnLines(playground(page).locator(".rich-example-output")), OPENING).toEqual(["edited scores"]);
  expect(errors).toEqual([]);
});

test("a static example opens with its code and prints what the page shows", async ({ page }) => {
  const errors = await open(page, "panel.html");
  const example = card(page, "Short content[/spring_green3]\", { expand: false }");
  const shown = await drawnLines(example.locator(".rich-example-output"));
  await example.getByRole("link", { name: "Try it" }).click();

  await expect(page).toHaveURL(/\/playground#.+/);
  await expect(editor(page)).toContainText("const console = new Console();", OPENING);
  await expect(editor(page)).toContainText("{ expand: false }");
  await expect.poll(() => drawnLines(playground(page).locator(".rich-example-output")), OPENING).toEqual(shown);
  expect(errors).toEqual([]);
});

test("a live example opens with what it needs from the page, and ends where the page's terminal ends", async ({ page }) => {
  const errors = await open(page, "progress.html");
  const example = card(page, 'description: "Processing..."');
  const live = example.locator(".rich-live");
  const screen = async () => lines(await text(live.locator(".xterm-rows")));
  // The bar at 100% is the last frame it draws.
  await expect
    .poll(async () => {
      await live.scrollIntoViewIfNeeded();
      return (await screen()).join("\n");
    }, OPENING)
    .toMatch(/Processing\.\.\. .* 100%/);
  const shown = await screen();
  await example.getByRole("link", { name: "Try it" }).click();

  await expect(page).toHaveURL(/\/playground#.+/);
  // `doStep` is the page's own context, which the block names.
  await expect(editor(page)).toContainText("const doStep = ", OPENING);
  await expect(editor(page)).toContainText('description: "Processing..."');
  // It redraws, so the playground runs it in a live terminal.
  await expect.poll(async () => lines(await text(playground(page).locator(".xterm-rows"))), OPENING).toEqual(shown);
  expect(errors).toEqual([]);
});
