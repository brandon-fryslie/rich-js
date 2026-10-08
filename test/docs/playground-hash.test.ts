/**
 * The playground's link format: a card's program, every file of it with its
 * setup and its terminal's size, survives the trip into a URL hash and back;
 * links in the formats before it still open, at the example size; and a hash that was not
 * written any of those ways fails rather than opening as some other program.
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { NO_SETUP, oneFile, type CardProgram, type CardSetup } from "../../docs/.vitepress/example-card.js";
import { MAX_PROGRAM_BYTES, decodeProgram, encodeProgram } from "../../docs/.vitepress/playground-hash.js";
import { EXAMPLE_SIZE, MAX_TERMINAL_CELLS } from "../../docs/.vitepress/terminal-size.js";

const SETUP: CardSetup = {
  before: [
    { origin: "imports", lines: ['import { Console } from "@promptctl/rich-js";', ""] },
    { origin: "from 'Basic usage'", lines: ["const console = new Console();", "", "{"] },
  ],
  after: ["}"],
};

const CODE = 'console.print("[bold magenta]Hello[/], naïve café — 👋 ✓");';

const PROGRAM: CardProgram = oneFile(SETUP, CODE);

/** A demo's program: an entry and the files it imports, one from a directory beside it. */
const DEMO: CardProgram = {
  files: [
    { name: "main.ts", setup: NO_SETUP, code: 'import { run } from "./app.js";\nrun();' },
    { name: "app.ts", setup: NO_SETUP, code: 'export const run = () => process.stdout.write("ran");' },
    { name: "../_capabilities/file-system.ts", setup: NO_SETUP, code: "export interface FileSystem {}" },
  ],
  terminal: { columns: 100, rows: 30 },
  contrast: "as drawn",
};

/** `json`, deflated, in base64url, behind `format`. */
const shaped = (format: string, json: unknown) => `${format}.${deflateSync(JSON.stringify(json)).toString("base64url")}`;

/** A hash as the oldest format wrote it: the source alone, deflated, in base64url. */
const oldHash = (source: string) => deflateSync(source).toString("base64url");

describe("a playground hash", () => {
  it("opens the program it was made from, every file, its setup and every character kept", async () => {
    expect(await decodeProgram(await encodeProgram(PROGRAM))).toEqual(PROGRAM);
    expect(await decodeProgram(await encodeProgram(DEMO))).toEqual(DEMO);
    const empty = oneFile(NO_SETUP, "");
    expect(await decodeProgram(await encodeProgram(empty))).toEqual(empty);
  });

  it("opens a link in the files format as those files at the example size", async () => {
    const { files } = DEMO;
    expect(await decodeProgram(shaped("files", { files }))).toEqual({ files, terminal: EXAMPLE_SIZE, contrast: "readable" });
  });

  it("opens a program link written before programs carried a contrast as readable, and refuses one it does not know", async () => {
    const { files, terminal } = DEMO;
    expect(await decodeProgram(shaped("program", { files, terminal }))).toEqual({ files, terminal, contrast: "readable" });
    await expect(decodeProgram(shaped("program", { files, terminal, contrast: "high" }))).rejects.toThrow('does not know: "high"');
  });

  it.each([
    ["no terminal", undefined],
    ["a fraction", { columns: 90.5, rows: 28 }],
    ["more cells than a terminal has", { columns: MAX_TERMINAL_CELLS + 1, rows: 28 }],
  ])("refuses a link whose program has %s", async (_, terminal) => {
    await expect(decodeProgram(shaped("program", { files: DEMO.files, terminal }))).rejects.toThrow("a terminal is");
  });

  it("opens a link in the card format as that block and its setup", async () => {
    expect(await decodeProgram(shaped("card", { setup: SETUP, code: CODE }))).toEqual(PROGRAM);
  });

  it("opens a link in the oldest format as that source with no setup", async () => {
    expect(await decodeProgram(oldHash(CODE))).toEqual(oneFile(NO_SETUP, CODE));
  });

  it("is made only of characters a URL fragment carries as they are", async () => {
    expect(await encodeProgram(oneFile(SETUP, CODE.repeat(20)))).toMatch(/^program\.[A-Za-z0-9_-]+$/);
  });

  it("is shorter than the program it carries", async () => {
    const code = CODE.repeat(20);
    expect((await encodeProgram(oneFile(SETUP, code))).length).toBeLessThan(code.length);
  });

  it("refuses a program longer than a link carries, whichever way it is going", async () => {
    const long = "x".repeat(MAX_PROGRAM_BYTES + 1);
    await expect(encodeProgram(oneFile(NO_SETUP, long))).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    // A hash inflating past the limit, as a crafted one would: the limit is on what comes out.
    const bomb = oldHash(long);
    expect(bomb.length).toBeLessThan(MAX_PROGRAM_BYTES / 100);
    await expect(decodeProgram(bomb)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    await expect(decodeProgram(`program.${bomb}`)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    await expect(decodeProgram(`files.${bomb}`)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    await expect(decodeProgram(`card.${bomb}`)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    // The limit is on what is packed, the program's JSON, and a program that fills it exactly still opens.
    const { files, contrast } = oneFile(NO_SETUP, "");
    const fits = "x".repeat(MAX_PROGRAM_BYTES - JSON.stringify({ files, terminal: EXAMPLE_SIZE, contrast }).length);
    expect(await decodeProgram(await encodeProgram(oneFile(NO_SETUP, fits)))).toEqual(oneFile(NO_SETUP, fits));
    await expect(encodeProgram(oneFile(NO_SETUP, `${fits}x`))).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
  });

  it("fails on a hash it did not write", async () => {
    await expect(decodeProgram("not a hash!")).rejects.toThrow();
    const hash = await encodeProgram(PROGRAM);
    await expect(decodeProgram(hash.slice(0, hash.length / 2))).rejects.toThrow();
    await expect(decodeProgram(`page.${hash.slice("program.".length)}`)).rejects.toThrow('a format named "page"');
  });

  it("fails on a file whose JSON is not a block and its setup", async () => {
    for (const file of [null, "code", { code: "x" }, { setup: { before: [{ origin: 1, lines: [] }], after: [] }, code: "x" }, { setup: NO_SETUP, code: 1 },
      // A line break inside a line, or a carriage return anywhere: the editor would make either a line of its own.
      { setup: { before: [{ origin: "imports", lines: ["a\r\nb"] }], after: [] }, code: "x" },
      { setup: { before: [], after: ["}\n"] }, code: "x" },
      { setup: NO_SETUP, code: "a\r\nb" }]) {
      await expect(decodeProgram(shaped("card", file))).rejects.toThrow("not a block and the setup it runs on");
      await expect(decodeProgram(shaped("files", { files: [{ name: "main.ts", ...(file as object) }] }))).rejects.toThrow();
    }
  });

  it("fails on a program of no files, a file with no name, or two files of one name", async () => {
    const file = { setup: NO_SETUP, code: "x" };
    await expect(decodeProgram(shaped("files", { files: [] }))).rejects.toThrow("has no files");
    await expect(decodeProgram(shaped("files", {}))).rejects.toThrow("has no files");
    for (const name of [undefined, "", "a\nb", 1]) {
      await expect(decodeProgram(shaped("files", { files: [{ name, ...file }] }))).rejects.toThrow("with no name");
    }
    await expect(decodeProgram(shaped("files", { files: [{ name: "a.ts", ...file }, { name: "a.ts", ...file }] }))).rejects.toThrow("names a file twice");
  });
});
