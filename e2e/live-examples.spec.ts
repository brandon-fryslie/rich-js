/// <reference lib="dom" />
/**
 * A docs page's live examples, in the built site: a progress example animates
 * under its code while it is on screen and stops when scrolled away; a reader
 * who asked for reduced motion gets a still frame; a widget example takes keys
 * while its terminal has focus, and the page's own shortcuts work when it does
 * not; a prompt is answered by what the reader types; a program that fails
 * to load says so and leaves no terminal behind.
 * What the terminal shows is read from xterm's rows.
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
  await expect.poll(() => percent(live)).not.toBeNaN();
  const still = await rows(live);
  await page.waitForTimeout(500);
  expect(await rows(live)).toBe(still);

  await button(live).click();
  await expect(button(live)).toHaveText("Restart");
  await expect.poll(() => percent(live)).toBeLessThan(100);
  expect(errors).toEqual([]);
});

// Each of these is blank if the frame waits for the body: the first loops until
// stopped, the second waits on an answer, and the third ends back on the main
// screen with the fullscreen view gone.
for (const [path, code, drawn] of [
  ["layout.html", "while (running)", "My App"],
  ["prompt.html", "What is your name?", "What is your name?"],
  ["live.html", "the terminal is in fullscreen", "back to the page in"],
] as const) {
  test(`with reduced motion, ${path}'s live example under \`${code}\` draws a frame before Play`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = await open(page, path);
    const live = liveUnder(page, code);

    await scrollTo(live);
    await expect(button(live)).toHaveText("Play", { timeout: 15_000 });
    await expect.poll(() => rows(live)).toContain(drawn);
    expect(errors).toEqual([]);
  });
}

test("a program that fails to load says so, and leaves no terminal to stack another on", async ({ page }) => {
  // A live program is its own chunk, named for its content hash.
  await page.route(/\/assets\/chunks\/[0-9a-f]{16}\.[^/]+\.js$/, (route) => route.abort());
  await open(page, "progress.html");
  const live = liveUnder(page, 'progress.addTask("Rendering..."');
  const failure = live.locator(".rich-live-failure");

  await expect
    .poll(async () => {
      await live.scrollIntoViewIfNeeded();
      return failure.count();
    }, { timeout: 15_000 })
    .toBe(1);
  await expect(live.locator(".xterm")).toHaveCount(0);

  // The button tries again, and fails again with nothing left behind.
  await button(live).click();
  await expect(failure).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(live.locator(".xterm")).toHaveCount(0);
});

test("a prompt example is answered by the line the reader types", async ({ page }) => {
  const errors = await open(page, "prompt.html");
  const live = liveUnder(page, "What is your name?");

  await scrollTo(live);
  await expect.poll(() => rows(live)).toContain("What is your name?");
  await live.locator(".xterm-screen").click();
  await page.keyboard.type("Adx");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("a");
  await page.keyboard.press("Enter");
  await expect.poll(() => rows(live)).toContain("Hello, Ada!");
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
