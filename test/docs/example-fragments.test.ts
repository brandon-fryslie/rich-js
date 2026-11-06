/**
 * What a drawing of a program's bytes can show: the escapes `decodeAnsi`
 * draws pass, every other is the one only a terminal shows, and an escape
 * not yet finished is left unread until the rest of it is written.
 */
import { describe, expect, it } from "vitest";
import { scanEscapes, undrawnEscape } from "../../docs/.vitepress/example-fragments.js";
import { OSC8_CLOSE, osc8Open } from "../../src/core/osc8.js";

describe("scanEscapes", () => {
  it("passes what a drawing draws: SGR, erase in line, a carriage return and an OSC 8 link", () => {
    const bytes = `\x1b[1;31mred\x1b[0m\r\x1b[2K${osc8Open("https://example.com")}link${OSC8_CLOSE}`;
    expect(scanEscapes(bytes)).toEqual({ dropped: null, unread: bytes.length, saved: false });
  });

  it.each(["\x1b[E", "\x1b[3E", "\x1bE"])("passes %j, a line break the drawing draws", (escape) => {
    expect(scanEscapes(`a${escape}b`).dropped).toBeNull();
  });

  it.each([["\x1b7", "\x1b8"], ["\x1b[s", "\x1b[u"]])("passes %j then %j, a save and a restore on one line, which the drawing performs", (save, restore) => {
    expect(scanEscapes(`a${save}b`).dropped).toBeNull();
    expect(scanEscapes(`a${save}bc${restore}d`).dropped).toBeNull();
  });

  it.each([
    ["with nothing saved, where a terminal homes the cursor", "a\x1b8b"],
    ["from a later line, where a terminal goes up to the saved row", "a\x1b7b\nc\x1b8d"],
    ["after a line-break escape", "a\x1b7b\x1bEc\x1b8d"],
    ["after a soft reset forgot the save", "a\x1b7b\x1b[!pc\x1b8d"],
  ])("finds a restore %s", (_, bytes) => {
    expect(scanEscapes(bytes).dropped).toBe("\x1b8");
  });

  it("carries a save across writes, so a restore in the next one is drawn as it is in the whole output", () => {
    const first = scanEscapes("a\x1b7bc");
    expect(first).toMatchObject({ dropped: null, saved: true });
    expect(scanEscapes("\x1b8d", first.saved).dropped).toBeNull();
    expect(scanEscapes("\nx\x1b8d", first.saved).dropped).toBe("\x1b8");
  });

  it.each([
    ["a cursor move", "\x1b[2A"],
    ["a move up to a line's start, CPL", "\x1b[F"],
    ["a screen clear", "\x1b[2J"],
    ["a mode switch", "\x1b[?1049h"],
    ["left and right margins, DECSLRM, which share a save's final", "\x1b[1;5s"],
    ["a kitty keyboard query, which shares a restore's final", "\x1b[?u"],
    ["a reverse index", "\x1bM"],
    ["a reset", "\x1bc"],
    ["an OSC that is not a link", "\x1b]0;title\x07"],
  ])("finds %s", (_, escape) => {
    expect(scanEscapes(`a${escape}b`).dropped).toBe(escape);
  });

  it("leaves an escape not yet finished unread, and reads it whole once it is", () => {
    const link = osc8Open("https://example.com/a/long/path/past/any/window");
    const first = `x${link.slice(0, 20)}`;
    const scan = scanEscapes(first);
    expect(scan).toEqual({ dropped: null, unread: 1, saved: false });
    const whole = `${first.slice(scan.unread)}${link.slice(20)}y`;
    expect(scanEscapes(whole)).toEqual({ dropped: null, unread: whole.length, saved: false });
    expect(scanEscapes("\x1b[2").unread).toBe(0);
    expect(scanEscapes("x\x1b(")).toEqual({ dropped: null, unread: 1, saved: false });
    expect(scanEscapes("\x1b(0q\x1b[!p")).toEqual({ dropped: null, unread: 8, saved: false });
  });

  it("cuts a designation of any final, a string escape's introducer included", () => {
    expect(scanEscapes("\x1b(_q")).toEqual({ dropped: null, unread: 4, saved: false });
  });

  it.each([
    ["an escape no byte can finish", "\x1b\x01"],
    ["a string escape that is no link, unfinished", "\x1b]0;tit"],
    ["a link with an escape inside it", "\x1b]8;;http://a\x1b[31m"],
    ["a link still open past any a terminal takes", `\x1b]8;;http://${"a".repeat(5000)}`],
  ])("drops %s as soon as it is written, not when it ends", (_, bytes) => {
    expect(scanEscapes(`x${bytes}`).dropped).not.toBeNull();
  });
});

describe("undrawnEscape", () => {
  it("reads a program's whole output, an escape left unfinished at its end dropped", () => {
    expect(undrawnEscape("\x1b[1mbold\x1b[0m")).toBeNull();
    expect(undrawnEscape("done\x1b[")).toBe("\x1b[");
    expect(undrawnEscape("a\x1b[2Jb")).toBe("\x1b[2J");
  });
});
