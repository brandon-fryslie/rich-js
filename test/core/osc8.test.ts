import { describe, it, expect } from "vitest";
import { OSC8_CLOSE, osc8Open, osc8Sequences, stripUrlControls } from "../../src/core/osc8.js";

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

  it("stops the uri only at bytes stripUrlControls removes", () => {
    for (const t of ["\x1b", "\x07", "\x9c"]) {
      expect(stripUrlControls(`a${t}b`)).toBe("ab");
    }
  });

  it("removes every code point of the census from a url, and nothing else", () => {
    const census = [0x09, 0x18, 0x9b, 0xad, 0x200d, 0x2028, 0x202e, 0xe0100].map((codePoint) => String.fromCodePoint(codePoint));
    for (const c of census) expect(stripUrlControls(`a${c}b`)).toBe("ab");
    expect(stripUrlControls("https://例え.jp/a%20b?q=1#x")).toBe("https://例え.jp/a%20b?q=1#x");
  });
});
