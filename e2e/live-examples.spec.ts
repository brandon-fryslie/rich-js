/// <reference lib="dom" />
/**
 * A docs page's live examples, in the built site: a progress example animates
 * under its code while it is on screen and stops when scrolled away; a reader
 * who asked for reduced motion gets a still frame; a widget example takes keys
 * while its terminal has focus, and the page's own shortcuts work when it does
 * not. What the terminal shows is read from xterm's rows.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

async function open(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  return errors;
}

/**
 * Scroll `live` into view until its terminal exists. Nothing runs before Vue
 * has taken the page over, and taking it over can put the page back at the
 * top, so one scroll made too early is not a scroll the terminal saw.
 */
async function scrollTo(live: Locator): Promise<void> {
  await expect
    .poll(async () => {
      await live.scrollIntoViewIfNeeded();
      return live.locator(".xterm").count();
    }, { timeout: 15_000 })
    .toBe(1);
}

/** The live terminal under the example whose code contains `code`. */
function liveUnder(page: Page, code: string): Locator {
  return page.locator(".rich-example", { hasText: code }).locator(".rich-live");
}

// xterm's DOM renderer draws some of a row's spaces as no-break spaces; they
// were spaces when the program wrote them.
const rows = async (live: Locator) => (await live.locator(".xterm-rows").innerText()).replaceAll("\u00a0", " ");
const button = (live: Locator) => live.locator(".rich-live-button");
const percent = async (live: Locator) => Number(/(\d+)%/.exec(await rows(live))?.[1] ?? NaN);

test("a progress example animates while on screen and stops when scrolled away", async ({ page }) => {
  const errors = await open(page, "progress.html");
  const live = liveUnder(page, 'progress.addTask("Rendering..."');

  await scrollTo(live);
  // A row is read between frames now and then; a poll reads it again.
  let early = NaN;
  await expect.poll(async () => (early = await percent(live))).toBeLessThan(100);
  await expect.poll(() => percent(live)).toBeGreaterThan(early);
  await expect(button(live)).toHaveText("Restart");

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(button(live)).toHaveText("Run");
  const stopped = await rows(live);
  await page.waitForTimeout(500);
  expect(await rows(live)).toBe(stopped);

  // Back in view, it runs again from the start.
  await live.scrollIntoViewIfNeeded();
  await expect(button(live)).toHaveText("Restart");
  await expect.poll(() => percent(live)).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test("with reduced motion, a progress example shows one still frame until asked to play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await open(page, "progress.html");
  const live = liveUnder(page, 'progress.addTask("Downloading..."');

  await scrollTo(live);
  await expect(button(live)).toHaveText("Play", { timeout: 15_000 });
  // The frame is the screen once the program's body has run: the task done.
  expect(await percent(live)).toBe(100);
  const still = await rows(live);
  await page.waitForTimeout(500);
  expect(await rows(live)).toBe(still);

  await button(live).click();
  await expect(button(live)).toHaveText("Restart");
  await expect.poll(() => percent(live)).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test("a widget example takes keys while focused, and the page's shortcuts work when it is not", async ({ page }) => {
  const errors = await open(page, "widgets.html");
  const live = liveUnder(page, "new NodeTerminalHost()");
  const search = page.locator(".VPLocalSearchBox");

  await scrollTo(live);
  await expect.poll(() => rows(live)).toContain("Subscribe to updates");

  await live.locator(".xterm-screen").click();
  await page.keyboard.type("ada");
  await expect.poll(() => rows(live)).toContain("ada");
  // Focusing the terminal scrolls whatever can scroll to show its input
  // field; the drawn rows stay where the reader sees them.
  const firstRowShown = await live.evaluate((el) => {
    const box = el.querySelector(".rich-live-screen")!.getBoundingClientRect();
    const row = el.querySelector(".xterm-rows > div")!.getBoundingClientRect();
    return row.top >= box.top && row.bottom <= box.bottom;
  });
  expect(firstRowShown).toBe(true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect.poll(() => rows(live)).toContain("[✓] Subscribe to updates");

  // Focused, the search shortcuts are the program's keys.
  await page.keyboard.press("/");
  await page.keyboard.press("Control+k");
  await expect.poll(() => rows(live)).toContain("[✓] Subscribe to updates");
  await expect(search).toHaveCount(0);

  // Unfocused, they are the page's.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("/");
  await expect(search).toHaveCount(1);
  expect(errors).toEqual([]);
});
