import { describe, expect, it } from "vitest";
import { decodeAnsi } from "../../src/core/ansi.js";
import { renderToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";

const PLAIN = { width: 40, colorSystem: null, hyperlinks: false } as const;
const STAND_IN = "�";

/** Every C1 control, the use it keeps, and the characters `a<code>b` is written as. */
const C1: readonly (readonly [code: number, use: string, written: string])[] = Array.from({ length: 0x20 }, (_, at) => {
  const code = 0x80 + at;
  return code === 0x85
    ? [code, "NEL ends a line, as CR, LF and CRLF do", "a\nb"]
    : [code, "none in text: a terminal may read it as a directive", `a${STAND_IN}b`];
});

describe("each C1 control in content", () => {
  it.each(C1)("U+%s keeps its use: %s", (code, _use, bytes) => {
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
});
