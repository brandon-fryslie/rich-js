/// <reference lib="dom" />
/**
 * An HTML fragment placed in a page with its own styles leaves them as they
 * were: the host's `body`, `pre` and `a` compute the same before and after the
 * fragment and its once-per-page CSS go in. The fragment's own shape is pinned
 * in test/core/export-html.test.ts; this is the property only a browser can
 * show.
 */
import { test, expect, type Page } from "@playwright/test";
import { encodeHtmlFragment, HTML_FRAGMENT_CSS } from "../src/core/export-html.js";
import { Segment } from "../src/core/segment.js";
import { Style } from "../src/core/style.js";
import { SOLARIZED_LIGHT } from "../src/themes/terminalThemes.js";

const HOST = `
<style>
  body { background: rgb(1, 2, 3); color: rgb(4, 5, 6); font-family: serif; padding: 7px; margin: 3px }
  pre { margin: 13px; font-family: cursive; white-space: pre-wrap }
  a { color: rgb(9, 9, 9); text-decoration: underline }
</style>
<a id="host-link" href="#">host</a><pre id="host-pre">host</pre><div id="slot"></div>
`;

const PROPERTIES = ["background-color", "color", "font-family", "padding", "margin", "white-space", "text-decoration-line"];

function hostStyles(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate((properties) => {
    const read = (el: Element) => properties.map((p) => getComputedStyle(el).getPropertyValue(p));
    const byId = (id: string) => document.getElementById(id) ?? document.body;
    return { body: read(document.body), a: read(byId("host-link")), pre: read(byId("host-pre")) };
  }, PROPERTIES);
}

test("a fragment leaves the host page's body, pre and a styles untouched", async ({ page }) => {
  const fragment = encodeHtmlFragment(
    [new Segment("linked", new Style({ link: "https://example.com", bold: true }))],
    SOLARIZED_LIGHT,
  );
  await page.setContent(HOST);
  const before = await hostStyles(page);

  await page.evaluate(
    ({ html, css }) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
      const slot = document.getElementById("slot");
      if (slot === null) throw new Error("host page has no #slot");
      slot.innerHTML = html;
    },
    { html: fragment, css: HTML_FRAGMENT_CSS },
  );

  expect(await hostStyles(page)).toEqual(before);
  // The fragment drew its own canvas, and its link took the run's look.
  const drawn = await page.evaluate(() => {
    const pre = document.querySelector("#slot pre");
    const link = document.querySelector("#slot a");
    if (pre === null || link === null) throw new Error("fragment did not render a pre with a link");
    return { pre: getComputedStyle(pre).backgroundColor, link: getComputedStyle(link).color };
  });
  const { red, green, blue } = SOLARIZED_LIGHT.backgroundColor;
  expect(drawn.pre).toBe(`rgb(${red}, ${green}, ${blue})`);
  expect(drawn.link).not.toBe("rgb(9, 9, 9)");
});
