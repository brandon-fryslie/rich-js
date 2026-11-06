import { describe, expect, it } from "vitest";
import { decodeAnsi } from "../../src/core/ansi.js";
import { renderToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";

const PLAIN = { width: 40, colorSystem: null, hyperlinks: false } as const;
const STAND_IN = "\u2426";

/** Every C1 control, the use it keeps, and the characters `a<code>b` is written as. */
const C1: readonly (readonly [label: string, code: number, use: string, written: string])[] = Array.from({ length: 0x20 }, (_, at) => {
  const code = 0x80 + at;
  const label = code.toString(16).toUpperCase().padStart(4, "0");
  return code === 0x85
    ? [label, code, "NEL ends a line, as CR, LF and CRLF do", "a\nb"]
    : [label, code, "none in text: a terminal may read it as a directive", `a${STAND_IN}b`];
});

describe("each C1 control in content", () => {
  it.each(C1)("U+%s keeps its use: %s", (_label, code, _use, bytes) => {
    expect(renderToString(new RichText(`a${String.fromCharCode(code)}b`, { end: "" }), PLAIN)).toBe(bytes);
  });

  it("holds one code unit for one, so a span past it stays on its cells", () => {
    const text = new RichText("\u009b\u0085ab");
    text.stylize("bold", 2, 4);
    expect(text.plain).toBe(`${STAND_IN}\nab`);
    expect(text.spans.map((span) => [span.start, span.end])).toEqual([[2, 4]]);
  });

  it("never reaches the wire from a raw segment", () => {
    const every = Array.from({ length: 0x20 }, (_, at) => String.fromCharCode(0x80 + at)).join("");
    expect(renderToString({ render: () => [new Segment(`a${every}b`)] }, PLAIN)).toBe("ab");
  });

  it("ends a captured line at NEL, as a terminal moves to the next one", () => {
    expect(decodeAnsi("one\u0085two\u009b").plain).toBe("one\ntwo");
  });

  // A terminal that reads C1 (VTE, WezTerm, xterm.js) reads each introducer as
  // its ESC form does, so a capture decodes the same either way.
  it("reads an 8-bit CSI as the 7-bit one", () => {
    const capture = (csi: string): string => `${csi}31mred${csi}0m ${csi}0Kplain ${csi}?25lend`;
    const spans = (ansi: string) => decodeAnsi(ansi).spans.map((span) => [span.start, span.end, String(span.style)]);
    expect(decodeAnsi(capture("\u009b")).plain).toBe(decodeAnsi(capture("\u001b[")).plain);
    expect(spans(capture("\u009b"))).toEqual(spans(capture("\u001b[")));
    expect(spans(capture("\u009b"))).not.toEqual([]);
  });

  it.each([["OSC", "\u009d"], ["DCS", "\u0090"], ["APC", "\u009f"], ["PM", "\u009e"], ["SOS", "\u0098"]])(
    "reads an 8-bit %s string as silent, its payload line breaks included",
    (_name, introducer) => {
      expect(decodeAnsi(`a${introducer}0;x\u0085y\u009cb`).plain).toBe("ab");
      expect(decodeAnsi(`a${introducer}0;x\u0007b`).plain).toBe("ab");
    },
  );

  it("reads an 8-bit OSC 8 as the 7-bit link", () => {
    const spans = (ansi: string) => decodeAnsi(ansi).spans.map((span) => [span.start, span.end, String(span.style)]);
    expect(spans("a\u009d8;;http://x\u009clink\u009d8;;\u009cb")).toEqual(spans("a\u001b]8;;http://x\u001b\\link\u001b]8;;\u001b\\b"));
    expect(decodeAnsi("a\u009d8;;http://x\u009clink\u009d8;;\u009cb").plain).toBe("alinkb");
  });

  it("drops one unterminated 8-bit string introducer rather than the line after it", () => {
    expect(decodeAnsi("Slavoj \u008ei\u009eek is here").plain).toBe("Slavoj iek is here");
    expect(decodeAnsi("\u009fes here\nnext").plain).toBe("es here\nnext");
  });

  it("ends a captured line at ESC E, the 7-bit NEL", () => {
    expect(decodeAnsi("a\u001bEb").plain).toBe(decodeAnsi("a\u0085b").plain);
  });
});
