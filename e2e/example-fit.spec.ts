/// <reference lib="dom" />
/**
 * Where the docs content column is narrower than the example terminal, a
 * generated output's font shrinks to fit it rather than scroll: at 1280px wide,
 * with the aside open, the full-width outputs on the panel and table pages show
 * every column, in both colour modes. custom.css's `.rich-example` owns the rule.
 */
import { test, expect } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  for (const path of ["panel.html", "tables.html"]) {
    test(`at 1280px, ${path}'s example output fits its column (${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const outputs = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".rich-example-output pre")]
          .filter((pre) => pre.offsetParent !== null)
          .map((pre) => ({ shown: pre.clientWidth, drawn: pre.scrollWidth })),
      );
      expect(outputs.length).toBeGreaterThan(0);
      // The widest output is a full-width one, drawn exactly to the column.
      expect(Math.max(...outputs.map((o) => o.drawn))).toBe(outputs[0]!.shown);
      expect(outputs.filter((o) => o.drawn > o.shown)).toEqual([]);
    });
  }
}
