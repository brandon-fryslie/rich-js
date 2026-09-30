/// <reference lib="dom" />
/**
 * "Try it" on a docs example, in the built site: it opens the playground on
 * that example's code, and running it there shows what the page shows under
 * the example: a static example's output, and a live example's last frame.
 * What a terminal shows is read from xterm's rows.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

async function open(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  return errors;
}

/** The card of the example whose code contains `code`. */
const card = (page: Page, code: string) => page.locator(".rich-example", { hasText: code });

// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
const text = async (rows: Locator) => (await rows.innerText()).replaceAll(" ", " ");

/** A screen's lines as a reader sees them: no trailing spaces, no blank lines at either end. */
const lines = (screen: string) =>
  screen
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
    .split("\n");

const playgroundRows = (page: Page) => page.locator(".rich-playground .xterm-rows");
const editor = (page: Page) => page.locator(".rich-playground .cm-content");

// The editor and the terminal appear together, once xterm.js has come from its CDN.
const OPENING = { timeout: 15_000 };

test("a static example opens with its code and prints what the page shows", async ({ page }) => {
  const errors = await open(page, "panel.html");
  const example = card(page, "Short content[/spring_green3]\", { expand: false }");
  const shown = lines(await example.locator(".rich-example-light pre").innerText());
  await example.getByRole("link", { name: "Try it" }).click();

  await expect(page).toHaveURL(/\/playground#.+/);
  await expect(editor(page)).toContainText("const console = new Console();", OPENING);
  await expect(editor(page)).toContainText('{ expand: false }');
  await expect.poll(async () => lines(await text(playgroundRows(page))), OPENING).toEqual(shown);
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
  await expect.poll(async () => lines(await text(playgroundRows(page))), OPENING).toEqual(shown);
  expect(errors).toEqual([]);
});
