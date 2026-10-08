/**
 * The playground's link format: a card's program, its setup included,
 * survives the trip into a URL hash and back; a link in the format before it
 * still opens, as a program with no setup; and a hash that was not written
 * either way fails rather than opening as some other program.
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { NO_SETUP, type CardProgram } from "../../docs/.vitepress/example-card.js";
import { MAX_PROGRAM_BYTES, decodeProgram, encodeProgram } from "../../docs/.vitepress/playground-hash.js";

const PROGRAM: CardProgram = {
  setup: {
    before: [
      { origin: "imports", lines: ['import { Console } from "@promptctl/rich-js";', ""] },
      { origin: "from 'Basic usage'", lines: ["const console = new Console();", "", "{"] },
    ],
    after: ["}"],
  },
  code: 'console.print("[bold magenta]Hello[/], naïve café — 👋 ✓");',
};

/** A hash as the format before this one wrote it: the source alone, deflated, in base64url. */
const oldHash = (source: string) => deflateSync(source).toString("base64url");

describe("a playground hash", () => {
  it("opens the program it was made from, its setup and every character kept", async () => {
    expect(await decodeProgram(await encodeProgram(PROGRAM))).toEqual(PROGRAM);
    const empty = { setup: NO_SETUP, code: "" };
    expect(await decodeProgram(await encodeProgram(empty))).toEqual(empty);
  });

  it("opens a link in the format before it as that source with no setup", async () => {
    expect(await decodeProgram(oldHash(PROGRAM.code))).toEqual({ setup: NO_SETUP, code: PROGRAM.code });
  });

  it("is made only of characters a URL fragment carries as they are", async () => {
    expect(await encodeProgram({ ...PROGRAM, code: PROGRAM.code.repeat(20) })).toMatch(/^card\.[A-Za-z0-9_-]+$/);
  });

  it("is shorter than the program it carries", async () => {
    const code = PROGRAM.code.repeat(20);
    expect((await encodeProgram({ ...PROGRAM, code })).length).toBeLessThan(code.length);
  });

  it("refuses a program longer than a link carries, whichever way it is going", async () => {
    const long = "x".repeat(MAX_PROGRAM_BYTES + 1);
    await expect(encodeProgram({ setup: NO_SETUP, code: long })).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    // A hash inflating past the limit, as a crafted one would: the limit is on what comes out.
    const bomb = oldHash(long);
    expect(bomb.length).toBeLessThan(MAX_PROGRAM_BYTES / 100);
    await expect(decodeProgram(bomb)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    await expect(decodeProgram(`card.${bomb}`)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    // The limit is on what is packed, the program's JSON, and a program that fills it exactly still opens.
    const fits = "x".repeat(MAX_PROGRAM_BYTES - JSON.stringify({ setup: NO_SETUP, code: "" }).length);
    expect(await decodeProgram(await encodeProgram({ setup: NO_SETUP, code: fits }))).toEqual({ setup: NO_SETUP, code: fits });
    await expect(encodeProgram({ setup: NO_SETUP, code: `${fits}x` })).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
  });

  it("fails on a hash it did not write", async () => {
    await expect(decodeProgram("not a hash!")).rejects.toThrow();
    const hash = await encodeProgram(PROGRAM);
    await expect(decodeProgram(hash.slice(0, hash.length / 2))).rejects.toThrow();
    await expect(decodeProgram(`page.${hash.slice("card.".length)}`)).rejects.toThrow('a format named "page"');
  });

  it("fails on a card whose JSON is not a block and its setup", async () => {
    const shaped = (json: unknown) => `card.${deflateSync(JSON.stringify(json)).toString("base64url")}`;
    for (const json of [null, "code", { code: "x" }, { setup: { before: [{ origin: 1, lines: [] }], after: [] }, code: "x" }, { setup: NO_SETUP, code: 1 },
      // A line break inside a line, or a carriage return anywhere: the editor would make either a line of its own.
      { setup: { before: [{ origin: "imports", lines: ["a\r\nb"] }], after: [] }, code: "x" },
      { setup: { before: [], after: ["}\n"] }, code: "x" },
      { setup: NO_SETUP, code: "a\r\nb" }]) {
      await expect(decodeProgram(shaped(json))).rejects.toThrow("not a block and the setup it runs on");
    }
  });
});
