/// <reference lib="dom" />
/**
 * The playground page, in the built site: reached from the nav, it opens on
 * the start example and runs it; an edit, run by the button or the shortcut,
 * replaces the output; the program is in the URL, so a reload or a fresh
 * browser opens it again; a program that never ends can be stopped; at phone
 * width the editor sits above the terminal; the terminal wears the site's
 * colour mode. What the terminal shows is read from xterm's rows.
 */
import { test, expect, type Page } from "@playwright/test";
import { ATOM_ONE_DARK, ATOM_ONE_LIGHT } from "../src/themes/terminalThemes.js";

async function open(page: Page, path = "playground.html"): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  return errors;
}

// xterm's DOM renderer draws some of a row's spaces as no-break spaces.
const rows = async (page: Page) => (await page.locator(".rich-playground .xterm-rows").innerText()).replaceAll(" ", " ");
const editor = (page: Page) => page.locator(".rich-playground .cm-content");
const button = (page: Page, name: string) => page.locator(".rich-playground button", { hasText: name });

/** Replace the editor's program with `source`, as a reader selecting all and typing would. */
async function write(page: Page, source: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);
}

const HELLO_AGAIN = ['import { Console } from "@promptctl/rich-js";', 'new Console().print("[bold]Hello again[/]");'].join("\n");

test("the nav reaches it, and it opens on the start example, run", async ({ page }) => {
  const errors = await open(page, "introduction.html");
  await page.locator(".VPNavBar a", { hasText: "Playground" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  await expect(editor(page)).toContainText('console.print("[bold magenta]Hello[/bold magenta]');
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello, World!");
  expect(errors).toEqual([]);
});

test("an edit, run by the button or the shortcut, replaces the output", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello, World!");

  await write(page, HELLO_AGAIN);
  await button(page, "Run").click();
  await expect.poll(() => rows(page)).toContain("Hello again");
  expect(await rows(page)).not.toContain("Hello, World!");

  await write(page, HELLO_AGAIN.replace("Hello again", "By the shortcut"));
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect.poll(() => rows(page)).toContain("By the shortcut");
  // The shortcut ran the program and left the editor's text alone: no line was added.
  await expect(page.locator(".rich-playground .cm-line")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("the program is the URL: a reload and a fresh browser both open it", async ({ page, browser }) => {
  const errors = await open(page);
  await expect(editor(page)).toContainText("Hello");
  await write(page, HELLO_AGAIN);
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");
  const link = page.url();

  await page.reload();
  await expect(editor(page)).toContainText("Hello again");
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello again");

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(link);
  await expect(editor(other)).toContainText("Hello again");
  await expect.poll(() => rows(other), { timeout: 15_000 }).toContain("Hello again");
  await fresh.close();
  expect(errors).toEqual([]);
});

test("a link it cannot read says so and opens the start example", async ({ page }) => {
  const errors = await open(page, "playground.html#not-a-program");
  await expect(page.locator(".rich-playground [role=alert]")).toContainText("could not be read");
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello, World!");
  expect(errors).toEqual([]);
});

test("a program that never ends is stopped, and the page stays usable", async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello, World!");
  await write(page, 'process.stdout.write("spinning");\nwhile (true) {}');
  await button(page, "Run").click();
  await expect.poll(() => rows(page)).toContain("spinning");
  await button(page, "Stop").click();
  await expect(button(page, "Stop")).toBeDisabled();
  // The page answers: the editor still takes typing.
  await write(page, HELLO_AGAIN);
  await button(page, "Run").click();
  await expect.poll(() => rows(page)).toContain("Hello again");
  expect(errors).toEqual([]);
});

test("at phone width the editor is above the terminal, both full width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page);
  await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello, World!");
  const code = (await page.locator(".rich-playground-editor").boundingBox())!;
  const terminal = (await page.locator(".rich-playground-output").boundingBox())!;
  expect(code.y + code.height).toBeLessThanOrEqual(terminal.y);
  expect(Math.abs(code.width - terminal.width)).toBeLessThan(1);
  expect(code.x + code.width).toBeLessThanOrEqual(390);
  // Beside each other when there is room for both.
  await page.setViewportSize({ width: 1440, height: 900 });
  const wide = (await page.locator(".rich-playground-output").boundingBox())!;
  expect(wide.y).toBeLessThan(code.y + code.height);
  expect(errors).toEqual([]);
});

for (const [scheme, theme] of [["light", ATOM_ONE_LIGHT], ["dark", ATOM_ONE_DARK]] as const) {
  test(`in ${scheme} mode the terminal wears the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const errors = await open(page);
    await expect.poll(() => rows(page), { timeout: 15_000 }).toContain("Hello, World!");
    const [r, g, b] = [theme.backgroundColor.red, theme.backgroundColor.green, theme.backgroundColor.blue];
    await expect(page.locator(".rich-playground .rich-live-screen")).toHaveCSS("background-color", `rgb(${r}, ${g}, ${b})`);
    expect(errors).toEqual([]);
  });
}
