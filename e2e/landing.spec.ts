/// <reference lib="dom" />
/**
 * The landing page's hero, in the built site: its text and buttons are on the
 * page before the terminal under them has loaded; the showcase program then
 * moves in that terminal, or holds one still frame for a reader who asked for
 * reduced motion; it wears the site's colour mode; and at phone width it fits
 * the page whole. What the terminal shows is read from xterm's rows.
 */
import { test, expect, type Page } from "@playwright/test";
import { XTERM } from "../examples/_browser-shell/xterm.js";
import { EXAMPLE_THEMES } from "../docs/.vitepress/example-terminal.js";

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  return errors;
}

const showcase = (page: Page) => page.locator(".rich-showcase");
// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
const rows = async (page: Page) => (await showcase(page).locator(".xterm-rows").innerText()).replaceAll("\u00a0", " ");
const button = (page: Page) => showcase(page).locator(".rich-live-button");
/** The first job's percentage, which only moves while the program runs. */
const rendering = async (page: Page) => /Rendering frames\s.*?(\d+)%/.exec(await rows(page))?.[1];

test("the hero's text and buttons are on the page before its terminal has loaded", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(XTERM.script.src, async (route) => {
    await held;
    await route.continue();
  });
  const errors = await open(page);
  await expect(page.locator(".VPHero .text")).toHaveText("Beautiful terminal output");
  await expect(page.locator(".VPHero .actions")).toContainText("Get Started");
  await expect(showcase(page)).toBeVisible();
  await expect(showcase(page).locator(".xterm")).toHaveCount(0);

  release();
  await expect(showcase(page).locator(".xterm")).toHaveCount(1, { timeout: 15_000 });
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Services");
  expect(errors).toEqual([]);
});

test("the showcase moves, needing nothing from the reader", async ({ page }) => {
  const errors = await open(page);
  await showcase(page).scrollIntoViewIfNeeded();
  await expect.poll(() => rendering(page), { timeout: 15_000 }).toMatch(/^\d+$/);
  await expect(button(page)).toHaveText("Restart");
  const first = await rendering(page);
  await expect.poll(() => rendering(page)).not.toBe(first);
  expect(errors).toEqual([]);
});

test("with reduced motion, the showcase holds one full frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await open(page);
  await showcase(page).scrollIntoViewIfNeeded();
  await expect(button(page)).toHaveText("Play", { timeout: 15_000 });
  const still = await rows(page);
  expect(still).toContain("Services");
  expect(still).toContain("Rendering frames");
  await page.waitForTimeout(500);
  expect(await rows(page)).toBe(still);
  expect(errors).toEqual([]);
});

for (const mode of ["light", "dark"] as const) {
  test(`in ${mode} mode, the terminal is drawn in the ${mode} example theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: mode });
    const errors = await open(page);
    await showcase(page).scrollIntoViewIfNeeded();
    await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Services");
    const background = await showcase(page).locator(".rich-live-screen").evaluate((element) => getComputedStyle(element).backgroundColor);
    const { red, green, blue } = EXAMPLE_THEMES[mode].backgroundColor;
    expect(background).toBe(`rgb(${red}, ${green}, ${blue})`);
    expect(errors).toEqual([]);
  });
}

test("at phone width, the showcase fits the page whole", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page);
  await showcase(page).scrollIntoViewIfNeeded();
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Services");
  const fit = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>(".rich-showcase .rich-live-screen")!;
    return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, screen: screen.scrollWidth - screen.clientWidth };
  });
  expect(fit).toEqual({ page: 0, screen: 0 });
  expect(errors).toEqual([]);
});

// The card reserves its terminal's rows at the page's line height before xterm
// has loaded; xterm's rows are that line height, so the card keeps its height
// when the program first draws (rich-demos-z4hd). At a fractional device pixel
// ratio — a zoomed page, a 125%-scaled screen — xterm still sizes a row in
// whole device pixels, and layout snaps the line height to 1/64px, so there the
// two agree to a fraction of a pixel rather than exactly.
for (const deviceScaleFactor of [1, 1.25, 1.5]) {
  test.describe(`at a device pixel ratio of ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });
    for (const width of [1440, 390]) {
      test(`at ${width}px, the showcase's rows are the page's line height and its card keeps its height`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        let release!: () => void;
        const held = new Promise<void>((resolve) => (release = resolve));
        await page.route(XTERM.script.src, async (route) => {
          await held;
          await route.continue();
        });
        const errors = await open(page);
        const card = showcase(page).locator(".rich-live");
        await expect(card).toBeVisible();
        await expect(showcase(page).locator(".xterm")).toHaveCount(0);
        const before = await card.evaluate((element) => element.getBoundingClientRect().height);

        release();
        await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Services");
        const after = await card.evaluate((element) => element.getBoundingClientRect().height);
        const { row, line } = await showcase(page).evaluate((element) => ({
          row: element.querySelector<HTMLElement>(".xterm-rows > div")!.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(element.querySelector(".rich-live-screen")!).lineHeight),
        }));
        expect(Math.abs(row - line)).toBeLessThan(0.05);
        expect(Math.abs(after - before)).toBeLessThan(1);
        expect(errors).toEqual([]);
      });
    }
  });
}
