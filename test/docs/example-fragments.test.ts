/**
 * What a drawing of a program's bytes can show: the escapes `decodeAnsi`
 * draws pass, every other is the one only a terminal shows, and an escape
 * not yet finished is left unread until the rest of it is written.
 */
import { describe, expect, it } from "vitest";
import { scanEscapes, undrawnEscape } from "../../docs/.vitepress/example-fragments.js";
import { OSC8_CLOSE, osc8Open } from "../../src/core/osc8.js";

/** `writes` read one after another, as the page's static run reads them: the first escape dropped, or null. */
function streamed(...writes: string[]): string | null {
  let unread = "";
  let before = scanEscapes("").after;
  for (const write of writes) {
    const seen = `${unread}${write}`;
    const scan = scanEscapes(seen, before);
    if (scan.dropped !== null) return scan.dropped;
    unread = seen.slice(scan.unread);
    before = scan.after;
  }
  return null;
}

describe("scanEscapes", () => {
  it("passes what a drawing draws: SGR, erase in line, a carriage return and an OSC 8 link", () => {
    const bytes = `\x1b[1;31mred\x1b[0m\r\x1b[2K${osc8Open("https://example.com")}link${OSC8_CLOSE}`;
    expect(scanEscapes(bytes)).toMatchObject({ dropped: null, unread: bytes.length });
  });

  it.each(["\x1b[E", "\x1b[1E", "\x1bE", "\x9bE", "\x85"])("passes %j, a line break the drawing draws", (escape) => {
    expect(scanEscapes(`a${escape}b`).dropped).toBeNull();
  });

  it.each(["\x18", "\x1a"])("passes a string, a CSI or an escape a %j aborts, which a terminal drops as the drawing does", (abort) => {
    for (const bytes of [`\x1b]8;;http://a${abort}visible\x07x`, `\x1b]0;title${abort}rest`, `x\x1bP${abort}y`, `\x1b[31${abort}mx`]) {
      expect(scanEscapes(bytes).dropped).toBeNull();
    }
  });

  it.each(["\x1b[3E", "\x9b2E"])("finds %j, a CNL past rows the drawing never draws", (escape) => {
    expect(scanEscapes(`a${escape}b`).dropped).toBe(escape);
  });

  it.each([["\x1b7", "\x1b8"], ["\x1b[s", "\x1b[u"], ["\x9bs", "\x9bu"]])("passes %j then %j, a save and a restore on one line, which the drawing performs", (save, restore) => {
    expect(scanEscapes(`a${save}b`).dropped).toBeNull();
    expect(scanEscapes(`a${save}bc${restore}d`).dropped).toBeNull();
  });

  it.each([
    ["with nothing saved, where a terminal homes the cursor", "a\x1b8b", "\x1b8"],
    ["from a later line, where a terminal goes up to the saved row", "a\x1b7b\nc\x1b8d", "\x1b8"],
    ["after a line-break escape", "a\x1b7b\x1bEc\x1b8d", "\x1b8"],
    ["after a C1 next line, NEL", "a\x1b7b\x85c\x1b8d", "\x1b8"],
    ["after a C1 CNL", "a\x1b7b\x9bEc\x1b8d", "\x1b8"],
    ["after a soft reset forgot the save", "a\x1b7b\x1b[!pc\x1b8d", "\x1b8"],
    ["in its C1 form, from a later line", "a\x9bsb\nc\x9bud", "\x9bu"],
  ])("finds a restore %s", (_, bytes, restore) => {
    expect(scanEscapes(bytes).dropped).toBe(restore);
  });

  it("keeps a save's line through a line end inside a link's URI, as the decoder does", () => {
    const link = osc8Open("https://example.com/a b");
    expect(scanEscapes(`a\x1b7${link}b${OSC8_CLOSE}c\x1b8d`).dropped).toBeNull();
  });

  it("carries a save across writes, so a restore in the next one is drawn as it is in the whole output", () => {
    expect(streamed("a\x1b7bc", "\x1b8d")).toBeNull();
    expect(streamed("a\x1b7bc", "\nx\x1b8d")).toBe("\x1b8");
    expect(streamed("a\x1b7b\n", "c\x1b8d")).toBe("\x1b8");
  });

  it("passes REP after a graphic character, carried across writes, and finds it where the drawing repeats nothing", () => {
    expect(scanEscapes("a\x1b[3b").dropped).toBeNull();
    expect(scanEscapes("\x1b[3b").dropped).toBe("\x1b[3b");
    expect(scanEscapes("a\x1b[1m\x1b[3b").dropped).toBe("\x1b[3b");
    expect(scanEscapes("a\n\x1b[3b").dropped).toBe("\x1b[3b");
    expect(streamed("ab", "\x1b[3b")).toBeNull();
    expect(streamed("a\x1b[1m", "\x1b[3b")).toBe("\x1b[3b");
    // One cluster however long, as the decoder repeats it.
    expect(scanEscapes(`a${"́".repeat(70)}\x1b[2b`).dropped).toBeNull();
  });

  it("repeats a cluster a mark finished in a later write, as it does the cluster whole", () => {
    expect(streamed("e", "́\x1b[2b")).toBeNull();
    expect(streamed("é", "́\x1b[2b")).toBeNull();
  });

  it("finds a REP after a code point the segmenter joins to nothing, in one write or two", () => {
    expect(scanEscapes("a​\x1b[2b").dropped).toBe("\x1b[2b");
    expect(streamed("a", "​\x1b[2b")).toBe("\x1b[2b");
  });

  it("carries the cursor's column across writes, so the margin cuts a REP where it does in the whole output", () => {
    expect(streamed("a".repeat(74), "\x1b[5b")).toBe("\x1b[5b");
    expect(streamed("a".repeat(70), "\x1b[4b")).toBeNull();
  });

  it("judges the margin at the width it is given, the one the card draws at", () => {
    expect(scanEscapes("a\x1b[60b", undefined, 40).dropped).toBe("\x1b[60b");
    expect(scanEscapes("a\x1b[90b", undefined, 120).dropped).toBeNull();
  });

  it("finds a REP the drawing cuts at the card's right margin, where a terminal wraps the rest", () => {
    expect(scanEscapes("a\x1b[200b").dropped).toBe("\x1b[200b");
    expect(scanEscapes(`${"a".repeat(30)}\x1b[39b`).dropped).toBeNull();
  });

  it.each(["\x0b", "\x0c", " ", " "])("finds %j, a line break no terminal performs as the drawing does", (control) => {
    expect(scanEscapes(`abc${control}def`).dropped).toBe(control);
  });

  it("passes an ESC the next escape cancels, which a terminal drops as the drawing does", () => {
    expect(scanEscapes("\x1b\x1b[31mx").dropped).toBeNull();
    expect(scanEscapes(`\x1b${osc8Open("https://example.com")}x${OSC8_CLOSE}`).dropped).toBeNull();
    expect(scanEscapes("\x1b\x01").dropped).toBe("\x1b");
    expect(scanEscapes("a\x1b\x18b").dropped).toBeNull();
    expect(scanEscapes("a\x1b\x1ab").dropped).toBeNull();
  });

  it.each(["\x1bE", "\x85", "\x1b[E"])("passes an ESC cancelled by %j, the line break after it", (escape) => {
    expect(scanEscapes(`a\x1b${escape}b`).dropped).toBeNull();
  });

  it.each([
    ["a cursor move", "\x1b[2A"],
    ["a cursor move in its C1 form", "\x9b2A"],
    ["a move up to a line's start, CPL", "\x1b[F"],
    ["a screen clear", "\x1b[2J"],
    ["a mode switch", "\x1b[?1049h"],
    ["left and right margins, DECSLRM, which share a save's final", "\x1b[1;5s"],
    ["a kitty keyboard query, which shares a restore's final", "\x1b[?u"],
    ["a reverse index", "\x1bM"],
    ["a reverse index in its C1 form", "\x8d"],
    ["a reset", "\x1bc"],
    ["an OSC that is not a link", "\x1b]0;title\x07"],
  ])("finds %s", (_, escape) => {
    expect(scanEscapes(`a${escape}b`).dropped).toBe(escape);
  });

  it("leaves an escape not yet finished unread, and reads it whole once it is", () => {
    const link = osc8Open("https://example.com/a/long/path/past/any/window");
    const first = `x${link.slice(0, 20)}`;
    const scan = scanEscapes(first);
    expect(scan).toMatchObject({ dropped: null, unread: 1 });
    const whole = `${first.slice(scan.unread)}${link.slice(20)}y`;
    expect(scanEscapes(whole)).toMatchObject({ dropped: null, unread: whole.length });
    expect(scanEscapes("\x1b[2").unread).toBe(0);
    expect(scanEscapes("x\x9b").unread).toBe(1);
    expect(scanEscapes("x\x1b(")).toMatchObject({ dropped: null, unread: 1 });
    expect(scanEscapes("\x1b(0q\x1b[!p")).toMatchObject({ dropped: null, unread: 8 });
    expect(streamed("x\x1b[3", "1mred\x1b[2", "A")).toBe("\x1b[2A");
  });

  it("cuts a designation of any final, a string escape's introducer included", () => {
    expect(scanEscapes("\x1b(_q")).toMatchObject({ dropped: null, unread: 4 });
  });

  it.each([
    ["an escape no byte can finish", "\x1b\x01"],
    ["a link with an escape inside it", "\x1b]8;;http://a\x1b[31m"],
    ["a link still open past any a terminal takes", `\x1b]8;;http://${"a".repeat(5000)}`],
  ])("drops %s as soon as it is written", (_, bytes) => {
    expect(scanEscapes(`x${bytes}`).dropped).not.toBeNull();
  });

  it("judges a string escape that is no link once it ends: at its terminator, or the line feed that cuts it", () => {
    expect(scanEscapes("x\x1b]0;tit").dropped).toBeNull();
    expect(streamed("x\x1b]0;tit", "le\x07")).toBe("\x1b]0;title\x07");
    expect(streamed("x\x1b]0;tit", "\ny")).toBe("\x1b]0;tit");
  });
});

describe("undrawnEscape", () => {
  it("reads a program's whole output, an escape left unfinished at its end dropped", () => {
    expect(undrawnEscape("\x1b[1mbold\x1b[0m")).toBeNull();
    expect(undrawnEscape("done\x1b[")).toBe("\x1b[");
    expect(undrawnEscape("done\x1b]0;tit")).toBe("\x1b]0;tit");
    expect(undrawnEscape("a\x1b[2Jb")).toBe("\x1b[2J");
  });
});
