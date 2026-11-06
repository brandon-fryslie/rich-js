import { describe, it, expect } from "vitest";
import { OSC8_CLOSE, osc8Open, osc8Sequences, stripOscControls } from "../../src/core/osc8.js";

// [LAW:behavior-not-structure] The wire grammar's contracts, read off bytes.
// Expected ids are standard FNV-1a-32 over the URL's UTF-8 bytes, computed
// independently of this implementation.

describe("osc8Open", () => {
  it("writes the id as FNV-1a over the URL's UTF-8 bytes", () => {
    expect(osc8Open("https://example.com")).toBe("\x1b]8;id=6fbc04d3;https://example.com\x1b\\");
    // Non-ASCII: a UTF-16 code-unit hash would give 517a1558 here.
    expect(osc8Open("https://ex.com/é")).toBe("\x1b]8;id=2071123d;https://ex.com/é\x1b\\");
  });

  it("hashes the sanitized URL, so a dirty and a clean URL are one link", () => {
    expect(osc8Open("https://evil.example/\x1b\\BAD")).toBe(osc8Open("https://evil.example/\\BAD"));
    expect(osc8Open("https://evil.example/\\BAD")).toBe("\x1b]8;id=21d503c2;https://evil.example/\\BAD\x1b\\");
  });
});

describe("osc8Sequences", () => {
  it("reads an open's params and uri, and a close as empty fields, with their positions", () => {
    const open = osc8Open("https://example.com");
    expect(osc8Sequences(`${open}click${OSC8_CLOSE}`)).toEqual([
      { index: 0, length: open.length, params: "id=6fbc04d3", uri: "https://example.com" },
      { index: open.length + 5, length: OSC8_CLOSE.length, params: "", uri: "" },
    ]);
  });

  it("reads a URI containing `;` whole — only the params field stops at `;`", () => {
    const url = "https://example.com/;jsessionid=1;foo=bar";
    expect(osc8Sequences(`${osc8Open(url)}x${OSC8_CLOSE}`).map((seq) => seq.uri)).toEqual([url, ""]);
  });

  it("accepts every terminator the sanitizer removes: ESC \\, BEL, and 8-bit ST", () => {
    for (const st of ["\x1b\\", "\x07", "\x9c"]) {
      const seq = `\x1b]8;;https://a.example${st}`;
      expect(osc8Sequences(`${seq}text`)).toEqual([
        { index: 0, length: seq.length, params: "", uri: "https://a.example" },
      ]);
    }
  });

  it("reads no sequence a CAN or SUB aborts before its terminator", () => {
    for (const abort of ["\x18", "\x1a"]) {
      expect(osc8Sequences(`\x1b]8;;http://a${abort}visible\x07x`)).toEqual([]);
    }
  });

  it("stops the uri only at bytes stripOscControls removes", () => {
    for (const t of ["\x1b", "\x07", "\x9c"]) {
      expect(stripOscControls(`a${t}b`)).toBe("ab");
    }
  });

  it("removes what could break the wrap or reorder the address", () => {
    const refused = [0x09, 0x18, 0x7f, 0x9b, 0x200f, 0x2028, 0x2029, 0x202e, 0x2067].map((codePoint) => String.fromCodePoint(codePoint));
    for (const c of refused) expect(stripOscControls(`a${c}b`)).toBe("ab");
  });

  it("leaves what an address needs, so a link goes where it says", () => {
    const joined = `https://fa.wikipedia.org/wiki/a${String.fromCodePoint(0x200c)}b`;
    const selected = `https://example.com/${String.fromCodePoint(0x2764, 0xfe0f)}`;
    for (const url of [joined, selected, "https://例え.jp/a%20b?q=1#x"]) expect(stripOscControls(url)).toBe(url);
  });
});
