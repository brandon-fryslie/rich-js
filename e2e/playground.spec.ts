/// <reference lib="dom" />
/**
 * The playground page, in the built site: the example card at the page's
 * full width. Reached from the nav it opens on the start example and draws its
 * output as a docs card does; an edit, once typing pauses or by the shortcut,
 * replaces the output; the program is in the URL, so a reload or a fresh
 * browser opens it again, and a link in the format before it still opens; a
 * program that moves the cursor, runs on, reads input or never ends moves to a live terminal,
 * and the page stays usable; reset puts the opened program back; at phone
 * width the card fits the screen; output wears the site's colour mode.
 */
import { test, expect, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { ATOM_ONE_DARK, ATOM_ONE_LIGHT } from "../src/themes/terminalThemes.js";
import { NO_SETUP, oneFile } from "../docs/.vitepress/example-card.js";
import { decodeProgram } from "../docs/.vitepress/playground-hash.js";

async function open(page: Page, path = "playground.html"): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  return errors;
}

const editor = (page: Page) => page.locator(".rich-playground .cm-content");
const output = (page: Page) => page.locator(".rich-playground .rich-example-output");
/** What the output shows as drawn HTML, the fragment of the colour mode in view. */
const drawn = async (page: Page) => (await page.locator(".rich-playground .rich-example-output").innerText()).replaceAll("\u00a0", " ");
// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
const rows = async (page: Page) => (await page.locator(".rich-playground .xterm-rows").innerText()).replaceAll("\u00a0", " ");
const alert = (page: Page) => page.locator(".rich-playground [role=alert]");
const hashProgram = async (page: Page) => decodeProgram(new URL(page.url()).hash.slice(1));

/** Replace the editor's code with `source`, as a reader selecting all and typing would. */
async function write(page: Page, source: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);
}

// The editor and the library load with the first card that runs.
const OPENING = { timeout: 15_000 };
// A live terminal brings xterm.js from its CDN.
const LIVE = { timeout: 20_000 };

const HELLO_AGAIN = ['import { Console } from "@promptctl/rich-js";', 'new Console().print("[bold]Hello again[/]");'].join("\n");

test("the nav reaches it, and it opens on the start example, drawn as a docs card draws it", async ({ page }) => {
  const errors = await open(page, "introduction.html");
  await page.locator(".VPNavBar a", { hasText: "Playground" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  await expect(editor(page)).toContainText('console.print("[bold magenta]Hello[/bold magenta]', OPENING);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await expect(output(page).locator(".rich-example-name")).toHaveText("Output");
  await expect(page.locator(".rich-playground .xterm")).toHaveCount(0);
  // Line numbers on, and the line offering the opened program back, with nothing yet to put back.
  await expect(page.locator(".rich-playground .cm-gutters")).toBeVisible();
  await expect(page.locator(".rich-playground .rich-example-edited")).toContainText("unedited");
  await expect(page.locator(".rich-playground .rich-example-reset")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("an edit replaces the output once typing pauses, or at once by the shortcut", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");

  await write(page, HELLO_AGAIN);
  await expect.poll(() => drawn(page)).toContain("Hello again");
  expect(await drawn(page)).not.toContain("Hello, World!");

  await write(page, HELLO_AGAIN.replace("Hello again", "By the shortcut"));
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect.poll(() => drawn(page)).toContain("By the shortcut");
  // The shortcut ran the program and left the editor's text alone: no line was added.
  await expect(page.locator(".rich-playground .cm-line")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("reset puts the opened program back", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await write(page, HELLO_AGAIN);
  await expect(page.locator(".rich-playground .rich-example-edited")).toContainText("● edited");
  await expect.poll(() => drawn(page)).toContain("Hello again");
  await page.locator(".rich-playground .rich-example-reset").click();
  await expect(editor(page)).toContainText("[bold magenta]Hello[/bold magenta]");
  await expect.poll(() => drawn(page)).toContain("Hello, World!");
  await expect(page.locator(".rich-playground .rich-example-edited")).toContainText("unedited");
  expect(errors).toEqual([]);
});

test("the program is the URL: a reload and a fresh browser both open it", async ({ page, browser }) => {
  const errors = await open(page);
  await expect(editor(page)).toContainText("Hello", OPENING);
  await write(page, HELLO_AGAIN);
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");
  const link = page.url();

  await page.reload();
  await expect(editor(page)).toContainText("Hello again", OPENING);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello again");

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(link);
  await expect(editor(other)).toContainText("Hello again", OPENING);
  await expect.poll(() => drawn(other), OPENING).toContain("Hello again");
  await fresh.close();
  expect(errors).toEqual([]);
});

test("a link in the format before this one opens, every line of it editable", async ({ page }) => {
  const errors = await open(page, `playground.html#${deflateSync(HELLO_AGAIN).toString("base64url")}`);
  await expect(editor(page)).toContainText("Hello again", OPENING);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello again");
  await expect(page.locator(".rich-playground .rich-setup-line")).toHaveCount(0);
  await expect(page.locator(".rich-playground .rich-setup-label")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a link it cannot read says so and opens the start example, until an edit makes a link again", async ({ page }) => {
  const errors = await open(page, "playground.html#not-a-program");
  await expect(alert(page)).toContainText("could not be read");
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await write(page, HELLO_AGAIN);
  await expect(alert(page)).toHaveCount(0);
  expect(await hashProgram(page)).toEqual(oneFile(NO_SETUP, HELLO_AGAIN));
  expect(errors).toEqual([]);
});

test("the link keeps up with fast typing and ends on what the editor holds", async ({ page }) => {
  const errors = await open(page);
  await expect(editor(page)).toContainText("Hello", OPENING);
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  // Past the history writes Safari and Firefox take in ten seconds, were each keystroke one. Playwright's
  // Chromium runs with that cap lifted (--disable-ipc-flooding-protection), so this holds the link to the
  // editor and cannot see the cap itself.
  const typed = "x".repeat(250);
  await page.keyboard.type(typed);
  await expect.poll(() => hashProgram(page).then(({ files }) => files[0].code, () => "")).toBe(typed);
  await expect(alert(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a link the browser refuses to write says so", async ({ page }) => {
  const errors = await open(page);
  await expect(editor(page)).toContainText("Hello", OPENING);
  // As a browser refuses a URL past its length cap.
  await page.evaluate(() => {
    history.replaceState = () => {
      throw new DOMException("The URL is too long", "DataError");
    };
  });
  await write(page, HELLO_AGAIN);
  await expect(alert(page)).toContainText("The link could not be updated: The URL is too long");
  expect(errors).toEqual([]);
});

test("the global console writes to the output, as Node's writes to stdout and stderr", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await write(page, 'console.log("out", { n: 1 });\nconsole.error("err");');
  await expect.poll(() => drawn(page)).toContain("out { n: 1 }\nerr");
  expect(errors).toEqual([]);
});

test("a program that moves the cursor runs in a live terminal, though it sets no timer", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  // A cursor save and restore, which is no CSI, around text the next write overwrites.
  await write(page, 'process.stdout.write("\\x1b7first\\x1b8second");');
  await expect.poll(() => rows(page), LIVE).toContain("second");
  await expect(output(page).locator(".rich-example-name")).toHaveText("Live");
  expect(errors).toEqual([]);
});

test("a program that runs on with a timer set runs in a live terminal, and one that ends is drawn again", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await write(page, 'let n = 0;\nsetInterval(() => process.stdout.write(`\\rframe ${++n}`), 50);');
  await expect.poll(() => rows(page), LIVE).toMatch(/frame \d+/);
  await expect(output(page).locator(".rich-example-name")).toHaveText("Live");
  await write(page, HELLO_AGAIN);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello again");
  await expect(page.locator(".rich-playground .xterm")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a program that reads input runs in a live terminal, which takes the keys", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await write(page, 'process.stdout.write("press a key ");\nprocess.stdin.on("data", (key) => process.stdout.write(`got ${key}`));');
  await expect.poll(() => rows(page), LIVE).toContain("press a key");
  await page.locator(".rich-playground .xterm-screen").click({ position: { x: 10, y: 10 } });
  await page.keyboard.type("q");
  await expect.poll(() => rows(page)).toContain("got q");
  expect(errors).toEqual([]);
});

test("a program that never ends leaves the page usable", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  await write(page, 'process.stdout.write("spinning");\nwhile (true) {}');
  // Past the static run's limit it is still running, and moves to a live terminal.
  await expect.poll(() => rows(page), LIVE).toContain("spinning");
  // The page answers: the editor still takes typing.
  await write(page, HELLO_AGAIN);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello again");
  expect(errors).toEqual([]);
});

test("at phone width the card fits the screen, the output under the code", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  const code = (await page.locator(".rich-playground .rich-example-editor").boundingBox())!;
  const shown = (await output(page).boundingBox())!;
  expect(code.y + code.height).toBeLessThanOrEqual(shown.y);
  expect(code.x).toBeGreaterThanOrEqual(0);
  expect(code.x + code.width).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("at full width the card spans the page's content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await open(page);
  await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
  const card = (await page.locator(".rich-playground .rich-example").boundingBox())!;
  const title = (await page.locator(".rich-playground h1").boundingBox())!;
  expect(Math.abs(card.x - title.x)).toBeLessThan(1);
  expect(card.width).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

for (const [scheme, theme] of [["light", ATOM_ONE_LIGHT], ["dark", ATOM_ONE_DARK]] as const) {
  test(`in ${scheme} mode the output wears the ${scheme} theme, drawn or live`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const errors = await open(page);
    await expect.poll(() => drawn(page), OPENING).toContain("Hello, World!");
    const [r, g, b] = [theme.backgroundColor.red, theme.backgroundColor.green, theme.backgroundColor.blue];
    await expect(output(page).locator(`.rich-example-${scheme} pre`)).toHaveCSS("background-color", `rgb(${r}, ${g}, ${b})`);
    await write(page, 'process.stdout.write("\\x1b[?25lwaiting");\nsetInterval(() => {}, 1000);');
    await expect.poll(() => rows(page), LIVE).toContain("waiting");
    await expect(page.locator(".rich-playground .rich-live-screen")).toHaveCSS("background-color", `rgb(${r}, ${g}, ${b})`);
    expect(errors).toEqual([]);
  });
}
