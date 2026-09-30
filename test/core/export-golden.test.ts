/*
 * The exact bytes `Console.exportHtml` and `Console.exportSvg` write, pinned for
 * one recording under two themes.
 *
 * [LAW:behavior-not-structure] The unit suites next door assert what each
 * encoding means, one property at a time. This pins what nobody thought to
 * assert: the old exporters dropped `reverse`, `blink` and `link` and every
 * test stayed green, because no test held the output that lost them. Here any
 * change to what an export draws is a diff in a file a reviewer reads.
 *
 * Unlike the Python-derived goldens beside it, these are this port's own
 * output — the SVG anchors every chunk to its cell and the HTML is themed,
 * where Rich does neither, so there is no reference to derive them from. That
 * makes regenerating one a claim that the new picture is right, and it is
 * reviewed as one. After an intended change to the exporters:
 *
 *     npx vitest run test/core/export-golden.test.ts -u
 *
 * then read the diff of every `export-*.golden.*` file before committing it.
 * They are real `.html` and `.svg` files, so the other way to read them is to
 * open one in a browser.
 */
import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import type { TerminalTheme } from "../../src/core/color.js";
import { ATTRIBUTE_NAMES } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { DEFAULT_TERMINAL_THEME, SOLARIZED_LIGHT } from "../../src/themes/terminalThemes.js";

// A named ANSI colour on another, so the theme's ANSI table decides both, and
// `reverse`, `dim` and `conceal` each have two different colours to act on.
const PAINT = "red on blue";

/**
 * One row per `Style` attribute, read from the list `Style` itself is built
 * on: an attribute added there appears here, and changes the goldens, without
 * anyone remembering to list it. Each is shown twice — alone, over the theme's
 * canvas and in its ink, and on `PAINT`.
 */
const attributeRows = ATTRIBUTE_NAMES.map((name) =>
  RichText.assemble([name.padEnd(12), [name, name], " ", [name, `${name} ${PAINT}`]]),
);

const otherRows = [
  RichText.assemble([
    "colour".padEnd(12),
    ["ansi", "green"],
    " ",
    ["bright", "bright_magenta"],
    " ",
    ["256", "color(208)"],
    " ",
    ["rgb", "#8844cc on #e0e0a0"],
    " ",
    ["canvas", "default on default"],
  ]),
  RichText.assemble(["link".padEnd(12), ["allowed", "link https://example.com/a?b=1&c=2 underline"]]),
  RichText.assemble(["refused".padEnd(12), ["script", "link javascript:alert(1) bold"]]),
  // The pairs resolved together rather than one after the other: `reverse`
  // decides which colour `dim` fades and `conceal` paints, and HTML gives a
  // double underline its own span so a strike beside it stays single.
  RichText.assemble([
    "combined".padEnd(12),
    ["rev+dim", `reverse dim ${PAINT}`],
    " ",
    ["rev+conceal", `reverse conceal ${PAINT}`],
    " ",
    ["u2+strike", "underline2 strike"],
  ]),
  // ASCII, CJK, an emoji, and `e` carrying two combining marks: one cell each
  // for the first and last, two for the others.
  RichText.assemble(["wide".padEnd(12), ["ab漢字cd😀ef e\u0301\u0302x", "cyan"]]),
  RichText.assemble(["escaped".padEnd(12), ['<a href="x">&amp;</a>', "italic"]]),
];

function recording(): Console {
  const terminal = new Console({
    record: true,
    width: 48,
    highlight: false,
    environment: { env: {} },
    file: { write: () => true },
  });
  for (const row of [...attributeRows, ...otherRows]) terminal.print(row);
  return terminal;
}

const THEMES: readonly (readonly [string, TerminalTheme])[] = [
  ["default", DEFAULT_TERMINAL_THEME],
  ["solarized-light", SOLARIZED_LIGHT],
];

describe.each(THEMES)("exports under the %s theme", (name, theme) => {
  it("writes the golden HTML", async () => {
    await expect(recording().exportHtml({ theme })).toMatchFileSnapshot(`./export-${name}.golden.html`);
  });

  it("writes the golden SVG", async () => {
    await expect(recording().exportSvg({ theme, title: "export golden" }))
      .toMatchFileSnapshot(`./export-${name}.golden.svg`);
  });
});
