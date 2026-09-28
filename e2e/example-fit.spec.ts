/// <reference lib="dom" />
/**
 * Where the docs content column is narrower than an example's output, the
 * output's font shrinks to fit it rather than scroll: at 1280px wide, with the
 * aside open, the full-width outputs on the panel and table pages show every
 * column, in both colour modes, while an output narrow enough to fit keeps the
 * code size. A live terminal made at a wider window is refitted when the window
 * narrows. custom.css's `.rich-example-output` owns the rule.
 */
import { test, expect, type Page } from "@playwright/test";

/** Every shown output on the page: its width, its drawn width, its font size; and the code blocks' font size. */
async function measure(page: Page) {
  return page.evaluate(() => ({
    code: parseFloat(getComputedStyle(document.querySelector(".vp-doc div[class*='language-'] code")!).fontSize),
    outputs: [...document.querySelectorAll<HTMLElement>(".rich-example-output pre")]
      .filter((pre) => pre.offsetParent !== null)
      .map((pre) => ({ shown: pre.clientWidth, drawn: pre.scrollWidth, size: parseFloat(getComputedStyle(pre).fontSize) })),
  }));
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const path of ["panel.html", "tables.html"]) {
    test(`at 1280px, ${path}'s example outputs fit their column (${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const { code, outputs } = await measure(page);
      expect(outputs.filter((o) => o.drawn > o.shown)).toEqual([]);
      // A full-width output fits because it shrank; a short one did not need to.
      expect(outputs.some((o) => o.size < code)).toBe(true);
      expect(outputs.some((o) => o.size === code)).toBe(true);
    });
  }
}

test("a live terminal made in a wide window is refitted when the window narrows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("layout.html");
  const live = page.locator(".rich-example", { hasText: "while (running)" }).locator(".rich-live");
  await expect
    .poll(async () => {
      await live.scrollIntoViewIfNeeded();
      return live.locator(".xterm").count();
    }, { timeout: 15_000 })
    .toBe(1);
  const fits = () =>
    live.locator(".rich-live-screen").evaluate((screen) => screen.scrollWidth <= screen.clientWidth);
  await expect.poll(fits).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(fits).toBe(true);
});
