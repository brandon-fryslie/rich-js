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
    expect(scanEscapes(bytes)).toEqual({ dropped: null, unread: bytes.length });
  });

  it.each([
    ["a cursor move", "\x1b[2A"],
    ["a screen clear", "\x1b[2J"],
    ["a mode switch", "\x1b[?1049h"],
    ["a cursor save, which is no CSI", "\x1b7"],
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
    expect(scan).toEqual({ dropped: null, unread: 1 });
    const whole = `${first.slice(scan.unread)}${link.slice(20)}y`;
    expect(scanEscapes(whole)).toEqual({ dropped: null, unread: whole.length });
    expect(scanEscapes("\x1b[2").unread).toBe(0);
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
