/// <reference lib="dom" />
/**
 * An HTML fragment and a host page with its own styles leave each other alone:
 * the host's `body`, `pre` and `a` compute the same before and after the
 * fragment and its once-per-page CSS go in, and the fragment computes the same
 * in that host as in a blank page. The fragment's own shape is pinned in
 * test/core/export-html.test.ts; this is the property only a browser can show.
 * So is the other: blink blinks, and holds still for a reader who asked for
 * reduced motion.
 */
import { test, expect, type Page } from "@playwright/test";
import { encodeHtml, encodeHtmlFragment, HTML_FRAGMENT_CSS } from "../src/core/export-html.js";
import { Segment } from "../src/core/segment.js";
import { Style } from "../src/core/style.js";
import { SOLARIZED_LIGHT } from "../src/themes/terminalThemes.js";

// Every rule here is one a docs theme plausibly sets, and each would reach the
// fragment's rows by inheritance or by matching its `pre` or `a`.
const HOST = `
<style>
  body { background: rgb(1, 2, 3); color: rgb(4, 5, 6); font-family: serif; padding: 7px; margin: 3px;
         line-height: 3; font-weight: 300; letter-spacing: 2px; text-align: center; direction: rtl }
  pre { margin: 13px; font-family: cursive; white-space: pre-wrap; border: 5px solid red; font-size: 30px }
  a { color: rgb(9, 9, 9); text-decoration: underline; font-weight: 900; text-underline-offset: 4px }
</style>
<a id="host-link" href="#">host</a><pre id="host-pre">host</pre><div id="slot"></div>
`;

const BLANK = `<div id="slot"></div>`;

const PROPERTIES = [
  "background-color", "color", "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "text-align", "padding-top", "padding-left", "margin-top", "margin-left", "border-top-width", "white-space", "text-decoration-line",
  "text-underline-offset", "direction", "unicode-bidi",
];

type Computed = Record<string, string[]>;

function hostStyles(page: Page): Promise<Computed> {
  return page.evaluate((properties) => {
    const read = (el: Element) => properties.map((p) => getComputedStyle(el).getPropertyValue(p));
    const byId = (id: string) => {
      const el = document.getElementById(id);
      if (el === null) throw new Error(`host page has no #${id}`);
      return el;
    };
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

test("--rich-fragment-font on an ancestor reaches the rows through all:initial", async ({ page }) => {
  await page.setContent(HOST.replace('<div id="slot">', '<div id="slot" style="--rich-fragment-font: 14px / 1.25 fantasy">'));
  await embed(page, FRAGMENT);
  const fonts = await fragmentStyles(page);
  const at = (element: string, property: string) => fonts[element]![PROPERTIES.indexOf(property)];
  for (const element of ["pre", "run"]) {
    expect(at(element, "font-family")).toBe("fantasy");
    expect(at(element, "font-size")).toBe("14px");
    expect(at(element, "line-height")).toBe("17.5px");
  }
});

// A blinking run, read with whatever animates it held halfway through its
// first cycle: the one instant the keyframes make the glyph transparent. With
// no keyframes a browser runs nothing at all, so the run is found by its
// style, not by an animation.
async function inkAtHalfCycle(page: Page, cycleMs: number): Promise<string> {
  return page.evaluate((half) => {
    const run = document.querySelector('pre span[style*="animation"]');
    if (run === null) throw new Error("no blinking run");
    for (const animation of run.getAnimations()) {
      animation.pause();
      animation.currentTime = half;
    }
    return getComputedStyle(run).color;
  }, cycleMs / 2);
}

const HIDDEN = "rgba(0, 0, 0, 0)";
const { red, green, blue } = SOLARIZED_LIGHT.foregroundColor;
const INK = `rgb(${red}, ${green}, ${blue})`;

for (const [attribute, cycleMs] of [["blink", 1000], ["blink2", 500]] as const) {
  const segments = [new Segment(attribute, Style.parse(attribute))];
  for (const [where, load] of [
    ["a fragment", async (page: Page) => { await page.setContent(BLANK); await embed(page, encodeHtmlFragment(segments, SOLARIZED_LIGHT)); }],
    ["a document", (page: Page) => page.setContent(encodeHtml(segments, SOLARIZED_LIGHT))],
  ] as const) {
    test(`${attribute} in ${where} blinks, and holds still once the reader asks for reduced motion`, async ({ page }) => {
      await load(page);
      expect(await inkAtHalfCycle(page, cycleMs)).toBe(HIDDEN);

      // Asked while the page is open, then on a page loaded after asking.
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await inkAtHalfCycle(page, cycleMs)).toBe(INK);
      await load(page);
      expect(await inkAtHalfCycle(page, cycleMs)).toBe(INK);
    });
  }
}

test("a column after wide glyphs lines up with the same column after narrow ones", async ({ page }) => {
  await page.setContent(BLANK);
  await embed(page, encodeHtmlFragment(
    [new Segment("東京|\n"), new Segment("abcd|\n"), new Segment("서울|\n"), new Segment("👨‍👩‍👧xy|\n")],
    SOLARIZED_LIGHT,
  ));
  const bars = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector("#slot pre")!, NodeFilter.SHOW_TEXT);
    const xs: number[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (let i = text.indexOf("|"); i !== -1; i = text.indexOf("|", i + 1)) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        xs.push(range.getBoundingClientRect().left);
      }
    }
    return xs;
  });
  expect(bars).toHaveLength(4);
  for (const x of bars) expect(x).toBeCloseTo(bars[1]!, 0);
});
