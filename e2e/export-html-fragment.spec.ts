/// <reference lib="dom" />
/**
 * An HTML fragment and a host page with its own styles leave each other alone:
 * the host's `body`, `pre` and `a` compute the same before and after the
 * fragment and its once-per-page CSS go in, and the fragment computes the same
 * in that host as in a blank page. The fragment's own shape is pinned in
 * test/core/export-html.test.ts; this is the property only a browser can show.
 */
import { test, expect, type Page } from "@playwright/test";
import { encodeHtmlFragment, HTML_FRAGMENT_CSS } from "../src/core/export-html.js";
import { Segment } from "../src/core/segment.js";
import { Style } from "../src/core/style.js";
import { SOLARIZED_LIGHT } from "../src/themes/terminalThemes.js";

// Every rule here is one a docs theme plausibly sets, and each would reach the
// fragment's rows by inheritance or by matching its `pre` or `a`.
const HOST = `
<style>
  body { background: rgb(1, 2, 3); color: rgb(4, 5, 6); font-family: serif; padding: 7px; margin: 3px;
         line-height: 3; font-weight: 300; letter-spacing: 2px; text-align: center }
  pre { margin: 13px; font-family: cursive; white-space: pre-wrap; border: 5px solid red; font-size: 30px }
  a { color: rgb(9, 9, 9); text-decoration: underline; font-weight: 900; text-underline-offset: 4px }
</style>
<a id="host-link" href="#">host</a><pre id="host-pre">host</pre><div id="slot"></div>
`;

const BLANK = `<div id="slot"></div>`;

const PROPERTIES = [
  "background-color", "color", "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "text-align", "padding", "margin", "border-top-width", "white-space", "text-decoration-line",
  "text-underline-offset",
];

type Computed = Record<string, string[]>;

function hostStyles(page: Page): Promise<Computed> {
  return page.evaluate((properties) => {
    const read = (el: Element) => properties.map((p) => getComputedStyle(el).getPropertyValue(p));
    const byId = (id: string) => document.getElementById(id) ?? document.body;
    return { body: read(document.body), a: read(byId("host-link")), pre: read(byId("host-pre")) };
  }, PROPERTIES);
}

function fragmentStyles(page: Page): Promise<Computed> {
  return page.evaluate((properties) => {
    const read = (selector: string) => {
      const el = document.querySelector(`#slot ${selector}`);
      if (el === null) throw new Error(`fragment has no ${selector}`);
      return properties.map((p) => getComputedStyle(el).getPropertyValue(p));
    };
    return { pre: read("pre"), a: read("a"), run: read("a span") };
  }, PROPERTIES);
}

function embed(page: Page, fragment: string): Promise<void> {
  return page.evaluate(
    ({ html, css }) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
      const slot = document.getElementById("slot");
      if (slot === null) throw new Error("page has no #slot");
      slot.innerHTML = html;
    },
    { html: fragment, css: HTML_FRAGMENT_CSS },
  );
}

const FRAGMENT = encodeHtmlFragment(
  [new Segment("linked", new Style({ link: "https://example.com" }))],
  SOLARIZED_LIGHT,
);

test("a fragment leaves the host page's body, pre and a styles untouched", async ({ page }) => {
  await page.setContent(HOST);
  const before = await hostStyles(page);
  await embed(page, FRAGMENT);
  expect(await hostStyles(page)).toEqual(before);
});

test("a fragment computes the same in a styled host as in a blank page", async ({ page }) => {
  await page.setContent(BLANK);
  await embed(page, FRAGMENT);
  const alone = await fragmentStyles(page);

  await page.setContent(HOST);
  await embed(page, FRAGMENT);
  expect(await fragmentStyles(page)).toEqual(alone);

  // And what it computes is the theme's canvas, with the link in the run's ink.
  const rgb = ({ red, green, blue }: { red: number; green: number; blue: number }) => `rgb(${red}, ${green}, ${blue})`;
  const at = (element: string, property: string) => alone[element]![PROPERTIES.indexOf(property)];
  expect(at("pre", "background-color")).toBe(rgb(SOLARIZED_LIGHT.backgroundColor));
  expect(at("run", "color")).toBe(rgb(SOLARIZED_LIGHT.foregroundColor));
});
