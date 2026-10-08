/// <reference lib="dom" />
/**
 * Headless-browser gate: every demo in the docs manifest boots cleanly.
 * Ticket: rich-demo-site-pek.5.
 *
 * A demo runs one of two ways (vite.config.demos.ts): in a card on its page
 * (docs/.vitepress/demo-card.ts), or in the iframe of its own bundle. A card
 * demo is driven through the card: its terminal draws, and nothing on the
 * page reports a failure. A bundled demo is driven through its bundle.
 *
 * [LAW:dataflow-not-control-flow] One test body per way a demo runs,
 * parameterised by manifest entries. Adding/removing a demo updates coverage
 * with zero test edits — the variability lives in
 * `docs/.vitepress/demos.json`, not in the test source.
 *
 * [LAW:one-source-of-truth] The demo list is read from the same manifest the
 * VitePress config, the dynamic-route paths file, and the landing-page index
 * read. No second list of demos lives in the test repo.
 *
 * [LAW:verifiable-goals] "This demo rendered for real" is its terminal's rows
 * holding a non-whitespace character, with no failure said and no error
 * raised. We assert on `.xterm-rows` text rather than `.xterm-screen`
 * structure because xterm.js populates the screen's layer children during
 * `term.open()` *before* any write — so a structural child-count check passes
 * even if the demo crashes before its first write. The row textContent is the
 * only DOM signal that survives that distinction.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeProgram } from "../docs/.vitepress/playground-hash.js";

interface DemoManifest {
  readonly demos: ReadonlyArray<{ readonly name: string; readonly runs: "card" | "iframe" }>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(
  __dirname,
  "..",
  "docs",
  ".vitepress",
  "demos.json",
);

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as DemoManifest;

if (manifest.demos.length === 0) {
  throw new Error(
    `e2e/demos.spec.ts: manifest at ${manifestPath} contains zero demos. ` +
      `Run \`npm run docs:build\` first.`,
  );
}

// The editor and the library load with the card; its terminal brings xterm.js from its CDN.
const LOADED = { timeout: 20_000 };

/** A demo's page, and every error the page raised. */
async function openDemo(page: Page, name: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(`demos/${name}.html`);
  return errors;
}

const card = (page: Page) => page.locator(".rich-example-card");
const terminalRows = (page: Page) => card(page).locator(".rich-live .xterm-rows");
// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
/**
 * What the card's terminal shows, scrolled into view first: a long file's tab
 * pushes it below the fold, and a live terminal off screen is stopped
 * (theme/LiveScreen.ts), its rows blank. It reads without waiting for the
 * rows, so a poll scrolls again each time: the editor opening under a first
 * scroll pushes the terminal back off screen before it starts.
 */
const shown = async (page: Page) => {
  await card(page).locator(".rich-live").scrollIntoViewIfNeeded();
  return (await terminalRows(page).allInnerTexts()).join("").replaceAll("\u00a0", " ");
};
const tab = (page: Page, name: string) => card(page).getByRole("tab", { name });
const editor = (page: Page) => card(page).locator(".cm-content");

for (const { name } of manifest.demos.filter((demo) => demo.runs === "card")) {
  test(`demo card runs cleanly: ${name}`, async ({ page }) => {
    const errors = await openDemo(page, name);
    await expect.poll(() => shown(page), LOADED).toMatch(/\S/);
    await expect(card(page).locator(".rich-example-failure")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const { name } of manifest.demos.filter((demo) => demo.runs === "iframe")) {
  test(`demo bundle boots cleanly: ${name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(`demos-app/${name}/`);

    // Locate #status by id only, then assert class and text separately.
    // On boot failure mount.ts.tmpl sets class="err" with a "boot error: ..."
    // message — using the composite selector `#status.ok` would time out
    // without surfacing that text, so the failure output reduces to
    // "selector timeout" instead of the real error.
    const status = page.locator("#status");
    await expect(status).toBeAttached();
    await expect(status).toHaveClass("ok");
    await expect(status).toContainText("ready");

    const rows = page.locator(".xterm-rows");
    await expect(rows).toBeAttached();
    // Polls until the demo's first frame contains at least one non-whitespace
    // character. An empty 30-row terminal still has 30 row divs (just with
    // whitespace textContent), so `/\S/` is what distinguishes "demo wrote"
    // from "demo crashed before writing".
    await expect(rows).toContainText(/\S/);

    expect(
      consoleErrors,
      `unexpected console.error calls: ${consoleErrors.join(" | ")}`,
    ).toHaveLength(0);
    expect(
      pageErrors,
      `unexpected uncaught exceptions: ${pageErrors.join(" | ")}`,
    ).toHaveLength(0);
  });
}

// "Drew something" passes a frame whose rows each start where the last one
// ended: every demo drew as a staircase while the gate above stayed green,
// because nothing returned the carriage before a newline. A Panel's rows all
// start at its left border, so any row that does not has been pushed along.
test("a demo's rows start at the left edge: rich-viewport", async ({ page }) => {
  await page.goto("demos-app/rich-viewport/");
  // A boot failure should read as its own message, not a missing "╭".
  await expect(page.locator("#status")).toContainText("ready");
  const rows = page.locator(".xterm-rows > div");
  await expect(rows.first()).toContainText("╭");
  const drawn = (await rows.allTextContents()).filter((row) => row.trim() !== "");
  expect(drawn.length, "the panel drew no rows").toBeGreaterThan(2);
  for (const row of drawn) {
    expect(row, `a row does not start at the panel's left border: ${JSON.stringify(drawn)}`).toMatch(/^[╭│╰]/);
  }
});

// A row can hold the right code point and still draw a missing-glyph box: the
// terminal's own fonts have nothing in the Powerline private-use range. Only
// the browser knows which face drew a glyph, so this asks it — the fonts
// Chromium actually used for the row that carries the arrow.
test("a demo's Powerline glyphs draw in the Powerline face: rich-strip", async ({ page }) => {
  await openDemo(page, "rich-strip");
  const arrow = terminalRows(page).locator("span", { hasText: "" }).first();
  await expect(arrow).toBeAttached(LOADED);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  // The face loads when a glyph in its range first needs it, so poll — and
  // find the span afresh each time, since xterm replaces a row's spans when it
  // repaints it. The Powerline face is the page's only web font covering the
  // range, so a web font drawing this span is that face; the face names
  // itself by the font it was cut from, not "Rich Powerline".
  await expect
    .poll(async () => {
      await arrow.evaluate((span) => span.setAttribute("data-powerline-probe", ""));
      const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-powerline-probe]" });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      return fonts.map((font) => ({ family: font.familyName, web: font.isCustomFont }));
    })
    .toContainEqual(expect.objectContaining({ web: true }));
});

// A printed demo writes many lines at once, and a terminal's viewport follows
// the last row written — so a visitor would land on the end of the tour and
// never see where it starts. The first row on screen has to be the first row
// printed. `first` matches the whole first row: rich-strip's first label
// recurs further down, and a row that merely contains it would pass scrolled
// to the bottom. rich-strip fits its card's terminal for this; a bundled demo's
// shell scrolls back to the top.
test("a printed demo opens on its first line: rich-strip", async ({ page }) => {
  await openDemo(page, "rich-strip");
  await expect(terminalRows(page).locator("> div").first()).toHaveText(/^PowerlineJoiner\s*$/, LOADED);
});

test("a printed demo opens on its first line: themes-and-color-studio", async ({ page }) => {
  await page.goto("demos-app/themes-and-color-studio/");
  await expect(page.locator("#status")).toContainText("ready");
  await expect(page.locator(".xterm-rows > div").first()).toHaveText(/^themes-and-color-studio\b/);
});

test("a demo's card shows its files as tabs; an edit to any re-runs it, reset puts every file back, and the playground opens them all", async ({ page }) => {
  const errors = await openDemo(page, "rich-strip");
  await expect(card(page).getByRole("tab")).toHaveText(["main.ts", "app.ts"]);
  await expect(tab(page, "main.ts")).toHaveAttribute("aria-selected", "true");
  await expect(editor(page)).toContainText("new NodeTerminalHost()", LOADED);
  await expect.poll(() => shown(page), LOADED).toContain("PowerlineJoiner");

  // The tabs are the WAI-ARIA tabs pattern: one Tab stop, the arrow keys move
  // the choice and focus with it, and the editor is the chosen tab's panel.
  await expect(tab(page, "app.ts")).toHaveAttribute("tabindex", "-1");
  await tab(page, "main.ts").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "app.ts")).toBeFocused();
  await expect(tab(page, "app.ts")).toHaveAttribute("aria-selected", "true");
  await expect(card(page).getByRole("tabpanel", { name: "app.ts" })).toContainText("export function runDemo");
  await page.keyboard.press("Home");
  await expect(tab(page, "main.ts")).toHaveAttribute("aria-selected", "true");

  // An edit in a file that is not the entry reaches the program it imports it
  // into: the tour, a screen long, replaced by one line.
  await tab(page, "app.ts").click();
  await expect(tab(page, "app.ts")).toHaveAttribute("aria-selected", "true");
  await expect(editor(page)).toContainText("export function runDemo");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText('export function runDemo(): void {\n  process.stdout.write("EDITED IN APP\\n");\n}');
  await expect.poll(() => shown(page), LOADED).toContain("EDITED IN APP");
  await expect.poll(() => shown(page)).not.toContain("PowerlineJoiner");

  // The entry's edit joins it, and the first file's survives the switch back.
  await tab(page, "main.ts").click();
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText('\nprocess.stdout.write("EDITED IN MAIN\\n");');
  await expect.poll(() => shown(page), LOADED).toContain("EDITED IN MAIN");
  await expect.poll(() => shown(page)).toContain("EDITED IN APP");

  // "Open in playground" carries every file as the card holds it.
  const link = card(page).getByRole("link", { name: "Open in playground" });
  await expect
    .poll(async () => (await decodeProgram((await link.getAttribute("href"))!.split("#")[1]!)).files.map((file) => [file.name, file.code.includes("EDITED IN")]))
    .toEqual([["main.ts", true], ["app.ts", true]]);

  await card(page).locator(".rich-example-reset").click();
  await expect(card(page).locator(".rich-example-edited")).toContainText("unedited");
  await expect(editor(page)).not.toContainText("EDITED IN MAIN");
  await tab(page, "app.ts").click();
  await expect(editor(page)).not.toContainText("EDITED IN APP");
  await expect.poll(async () => (await shown(page)).split("\n")[0], LOADED).toMatch(/^PowerlineJoiner\s*$/);
  expect(await shown(page)).not.toContain("EDITED IN");

  await link.click();
  await page.waitForURL(/playground#program\./);
  await expect(page.locator(".rich-playground").getByRole("tab")).toHaveText(["main.ts", "app.ts"], LOADED);
  await expect(page.locator(".rich-playground .cm-content")).toContainText("new NodeTerminalHost()");
  await expect.poll(async () => (await page.locator(".rich-playground .rich-example-output").innerText()).replaceAll("\u00a0", " "), LOADED).toContain("PowerlineJoiner");
  expect(errors).toEqual([]);
});

// The first interactive demo on a card: keys typed while its terminal has
// focus are the program's, Tab and Escape included, and Escape then Tab is
// the way out (docs/.vitepress/theme/live-terminal.ts).
test("an interactive demo's card takes keys while focused, says so, lets focus leave, and fits its own terminal: dropdown-demo", async ({ page }) => {
  const errors = await openDemo(page, "dropdown-demo");
  const screen = card(page).locator(".rich-live-screen");
  const hint = card(page).locator(".rich-live-hint");
  const focusedInScreen = () => screen.evaluate((element) => element.contains(document.activeElement));
  await expect.poll(() => shown(page), LOADED).toContain("Dropdown demo");

  // Its terminal is its card.json's size, every row drawn and in view: the
  // status rows the layout holds at the bottom are the last of thirty.
  const rowsOnScreen = card(page).locator(".xterm-rows > div");
  await expect(rowsOnScreen).toHaveCount(30);
  await expect(rowsOnScreen.last()).toHaveText(/esc=cancel\s*$/);
  const lastRowInView = await screen.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const rows = element.querySelectorAll(".xterm-rows > div");
    const last = rows[rows.length - 1]!.getBoundingClientRect();
    return last.bottom <= box.bottom && last.right <= box.right;
  });
  expect(lastRowInView).toBe(true);

  await expect(hint).toHaveCount(0);
  await screen.locator(".xterm-screen").click();
  expect(await focusedInScreen()).toBe(true);
  await expect(hint).toContainText("Esc then Tab leaves");

  // The first dropdown has focus: Enter opens it, an arrow moves, Enter selects.
  await page.keyboard.press("Enter");
  await expect.poll(() => shown(page)).toContain("short: sel=0 exp=true hl=0");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => shown(page)).toContain("short: sel=0 exp=true hl=1");
  await page.keyboard.press("Enter");
  await expect.poll(() => shown(page)).toContain("short: sel=1 exp=false");

  // Tab is the demo's: it moves the demo's focus, and the page's stays put.
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  await expect.poll(() => shown(page)).toContain("custom widget (focused)");
  expect(await focusedInScreen()).toBe(true);

  // A Tab long after an Escape is still the program's: the way out lasts as
  // long as CodeMirror's (`LEAVE_WITHIN_MS`), 2 s.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2_500);
  await page.keyboard.press("Tab");
  await expect.poll(() => shown(page)).not.toContain("custom widget (focused)");
  expect(await focusedInScreen()).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => shown(page)).toContain("custom widget (focused)");

  // Escape reaches the program; the Tab right after it leaves the card's terminal.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  expect(await focusedInScreen()).toBe(false);
  await expect(hint).toHaveCount(0);
  await expect.poll(() => shown(page)).toContain("key=escape");

  // An edit restarts it on the edited program.
  await tab(page, "app.ts").click();
  const app = readFileSync(resolve(__dirname, "..", "examples", "dropdown-demo", "app.ts"), "utf-8");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(app.replace('"Dropdown demo"', '"Dropdown EDITED"'));
  await expect.poll(() => shown(page), LOADED).toContain("Dropdown EDITED");
  expect(errors).toEqual([]);
});
