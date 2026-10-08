/// <reference lib="dom" />
/**
 * The effects playground page (docs/effects-playground.md): a card for every
 * effect, each running its program, with a slider over each named number in
 * its code (docs/.vitepress/tunables.ts).
 *
 * [LAW:verifiable-goals] A slider is a view of a literal, so what is checked
 * is the literal: moving one changes the number in the editor, the program
 * restarts on that code (its heading says the frame rate it plays at), and
 * reset puts the code, the slider and the output back.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { EFFECTS } from "../examples/effects-feel/vocabulary.js";
import { decodeProgram } from "../docs/.vitepress/playground-hash.js";

// The editor and the library load with the card; its terminal brings xterm.js from its CDN.
const LOADED = { timeout: 20_000 };

/** The page, and every error it raised. */
async function openPage(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("effects-playground.html");
  return errors;
}

/** The card under the heading that names `effect`. */
const cardOf = (page: Page, effect: string): Locator => page.locator(`h2#${effect} + .rich-example-card`);

/** What a card's terminal shows, scrolled into view first: a live terminal off screen is stopped. */
const shown = async (card: Locator): Promise<string> => {
  await card.locator(".rich-live").scrollIntoViewIfNeeded();
  return (await card.locator(".rich-live .xterm-rows").allInnerTexts()).join("").replaceAll(" ", " ");
};

const slider = (card: Locator, name: string): Locator => card.getByRole("slider", { name, exact: true });

/**
 * The code of a card's entry as the card holds it, read off its playground
 * link, which carries every edit: the editor draws only the lines in view.
 */
const code = async (card: Locator): Promise<string> =>
  (await decodeProgram((await card.getByRole("link", { name: "Open in playground" }).getAttribute("href"))!.split("#")[1]!)).files[0].code;

test("the page lists every effect, each card running its own program with its own sliders", async ({ page }) => {
  const errors = await openPage(page);
  await expect(page.locator(".vp-doc h2")).toHaveText([...EFFECTS]);
  for (const effect of EFFECTS) {
    const card = cardOf(page, effect);
    await expect(card.getByRole("tab").first()).toHaveText(`${effect}.ts`);
    await expect.poll(() => shown(card), LOADED).toContain("curve time");
    await expect(slider(card, "CURVE.seconds")).toBeVisible();
    await expect(card.locator(".rich-example-failure")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("a slider changes the literal in the code, the output follows, and reset restores both", async ({ page }) => {
  const errors = await openPage(page);
  const card = cardOf(page, "pulse");
  await expect(slider(card, "FPS")).toHaveValue("30", LOADED);
  expect(await code(card)).toContain("const FPS = 30;");
  await expect.poll(() => shown(card), LOADED).toContain("· 30 fps");

  await slider(card, "FPS").fill("12");
  await expect.poll(() => code(card)).toContain("const FPS = 12;");
  expect(await code(card)).not.toContain("const FPS = 30;");
  await expect.poll(() => shown(card), LOADED).toContain("· 12 fps");

  // An ease is a list of every curve the library names, and choosing one is an edit too.
  await card.getByRole("combobox").first().selectOption("ease-in");
  await expect.poll(() => code(card)).toContain('ease: EASES["ease-in"]');
  await expect(card.locator(".rich-example-edited")).toContainText("● edited");

  await card.locator(".rich-example-reset").click();
  await expect(card.locator(".rich-example-edited")).toContainText("unedited");
  await expect.poll(() => code(card)).toContain("const FPS = 30;");
  expect(await code(card)).not.toContain('ease: EASES["ease-in"]');
  await expect(slider(card, "FPS")).toHaveValue("30");
  await expect.poll(() => shown(card), LOADED).toContain("· 30 fps");
  expect(errors).toEqual([]);
});

test("typing a number in the code moves its slider", async ({ page }) => {
  await openPage(page);
  const card = cardOf(page, "shimmer");
  const editor = card.locator(".cm-content");
  await expect(editor).toContainText("const STEP = 0.25;", LOADED);
  await expect(slider(card, "STEP")).toHaveValue("0.25");
  await editor.getByText("const STEP = 0.25;").click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
  await page.keyboard.insertText("0.5");
  await expect(editor).toContainText("const STEP = 0.5;");
  await expect(slider(card, "STEP")).toHaveValue("0.5");
});
