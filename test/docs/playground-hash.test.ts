/**
 * The playground's link format: a program survives the trip into a URL hash
 * and back, and a hash that was not written that way fails rather than
 * opening as some other program.
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MAX_PROGRAM_BYTES, decodeProgram, encodeProgram } from "../../docs/.vitepress/playground-hash.js";

const PROGRAM = [
  'import { Console } from "@promptctl/rich-js";',
  "",
  "const console = new Console();",
  'console.print("[bold magenta]Hello[/], naïve café — 👋 ✓");',
].join("\n");

describe("a playground hash", () => {
  it("opens the program it was made from, every character kept", async () => {
    expect(await decodeProgram(await encodeProgram(PROGRAM))).toBe(PROGRAM);
    expect(await decodeProgram(await encodeProgram(""))).toBe("");
  });

  it("is made only of characters a URL fragment carries as they are", async () => {
    expect(await encodeProgram(PROGRAM.repeat(20))).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is shorter than the program it carries", async () => {
    const program = PROGRAM.repeat(20);
    expect((await encodeProgram(program)).length).toBeLessThan(program.length);
  });

  it("refuses a program longer than a link carries, whichever way it is going", async () => {
    const long = "x".repeat(MAX_PROGRAM_BYTES + 1);
    await expect(encodeProgram(long)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    // A hash inflating past the limit, as a crafted one would: the limit is on what comes out.
    const bomb = deflateSync(long).toString("base64url");
    expect(bomb.length).toBeLessThan(MAX_PROGRAM_BYTES / 100);
    await expect(decodeProgram(bomb)).rejects.toThrow(`at most ${MAX_PROGRAM_BYTES} bytes`);
    expect(await decodeProgram(await encodeProgram("x".repeat(MAX_PROGRAM_BYTES)))).toHaveLength(MAX_PROGRAM_BYTES);
  });

  it("fails on a hash it did not write", async () => {
    await expect(decodeProgram("not a hash!")).rejects.toThrow();
    const hash = await encodeProgram(PROGRAM);
    await expect(decodeProgram(hash.slice(0, hash.length / 2))).rejects.toThrow();
  });
});
