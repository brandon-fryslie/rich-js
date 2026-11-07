/**
 * The format characters, a family at a time, on the bytes rich-js writes. What
 * real terminals do with each is `docs/control-codes.md`; here the claim is what
 * reaches them.
 */

import { describe, expect, it } from "vitest";
import { ALL_UNDERLINES } from "../../src/core/color.js";
import { cellLen, graphemes, wireText } from "../../src/core/cells.js";
import { ColorDepth } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { Pretty } from "../../src/core/pretty.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { render } from "../../src/core/protocol.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Style } from "../../src/core/style.js";
import type { TextOrder } from "../../src/core/text-order.js";
import { JSONRenderable } from "../../src/core/json.js";
import { Panel } from "../../src/renderables/panel.js";
import { Syntax } from "../../src/renderables/syntax.js";

const SHY = "\u00ad";
const ZWSP = "\u200b";
const ZWNJ = "\u200c";
const ZWJ = "\u200d";
const WJ = "\u2060";
const BOM = "\ufeff";
const LS = "\u2028";
const PS = "\u2029";
const VS1 = "\ufe00";
const VS16 = "\ufe0f";
const IVS = "\u{e0100}";
const HEART = "\u2764";
const KANJI = "\u845b";
const WOMAN = "\u{1f469}";
const LAPTOP = "\u{1f4bb}";
const ENGLAND = "\u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}";
const HIDDEN = "\u{e0068}\u{e0069}";
const COMBINING = "\u0301";
const PDF = "\u202c";

function wire(renderable: string | Renderable, width: number, colorSystem?: "truecolor"): string {
  const chunks: string[] = [];
  const console = new Console({ file: { write: (chunk) => void chunks.push(String(chunk)) }, width, markup: false, highlight: false, colorSystem });
  console.print(renderable);
  return chunks.join("");
}

const rows = (renderable: string | Renderable, width: number): string[] =>
  wire(renderable, width).split("\n").slice(0, -1).map((row) => row.trimEnd());

describe("joiners", () => {
  it("writes a Persian word with its ZWNJ, whole", () => {
    const word = `\u0645\u06cc${ZWNJ}\u062e\u0648\u0627\u0647\u0645`;
    expect(rows(word, 20)).toEqual([word]);
    expect(cellLen(word)).toBe(Array.from(word).length - 1);
  });

  it("writes a ZWJ emoji sequence as the one glyph it measures", () => {
    const family = `${WOMAN}${ZWJ}${LAPTOP}`;
    expect(cellLen(family)).toBe(2);
    expect(rows(family, 4)).toEqual([family]);
  });

  it("measures a ZWJ that joins nothing as what it is drawn beside", () => {
    expect(cellLen(`a${ZWJ}b`)).toBe(2);
  });
});

describe("variation selectors", () => {
  it("writes a Japanese ideographic variation sequence as the glyph it is", () => {
    const glyph = `${KANJI}${IVS}`;
    expect(cellLen(glyph)).toBe(2);
    expect(rows(`a${glyph}b`, 10)).toEqual([`a${glyph}b`]);
  });

  it("measures a VS16 emoji at its drawn width, and a wrap counts that", () => {
    const glyph = `${HEART}${VS16}`;
    expect(cellLen(glyph)).toBe(2);
    expect(rows(`${glyph}${glyph}${glyph}`, 4)).toEqual([`${glyph}${glyph}`, glyph]);
  });

  it.each([
    ["a selector", VS1],
    ["ZWNJ", ZWNJ],
    ["a soft hyphen", SHY],
    ["a line separator", LS],
    ["a filler letter of no cells", "\u3164"],
  ])("keeps one selector on a glyph, with %s before the next", (_name, between) => {
    expect(wireText(`a${VS1}${between}${VS1}${VS1}b`).match(/\p{Variation_Selector}/gu)).toEqual([VS1]);
  });

  it("keeps a selector a span edge cut from its glyph", () => {
    expect(wireText(VS1)).toBe(VS1);
  });
});

describe("line-break controls", () => {
  it("draws a soft hyphen as nothing inside a line", () => {
    expect(rows(`co${SHY}op`, 10)).toEqual(["coop"]);
    expect(cellLen(`co${SHY}op`)).toBe(4);
  });

  it("draws it as a hyphen where the line breaks", () => {
    expect(rows(`super${SHY}cali`, 6)).toEqual(["super-", "cali"]);
  });

  it("breaks with no hyphen rather than past the edge", () => {
    expect(rows(`super${SHY}cali`, 5)).toEqual(["super", "cali"]);
  });

  it("leaves a word that fits whole alone, a trailing soft hyphen and all", () => {
    expect(rows(`foo${SHY}`, 3)).toEqual(["foo"]);
    expect(rows(`foo${SHY} bar`, 3)).toEqual(["foo", "bar"]);
  });

  it("keeps a hyphenated row's style to its last cell, and pads past it", () => {
    const text = new RichText(`foo${SHY}barbaz`);
    text.stylize("red", 0, 4);
    expect(wire(text, 6, "truecolor")).toContain("\x1b[31mfoo-\x1b[0m");
  });

  it("measures the narrowest width a soft hyphen allows, its hyphen included", () => {
    const { minimum, maximum } = new RichText(`super${SHY}cali`).measure({ maxWidth: 80 } as never);
    expect([minimum, maximum]).toEqual([5, 9]);
    const narrow = new RichText(`ab${SHY}\u1161`).measure({ maxWidth: 80 } as never);
    expect(narrow.minimum).toBeLessThanOrEqual(narrow.maximum);
  });

  it("hyphenates a right-to-left row on its own side, in logical order", () => {
    const hebrew = "\u05d0\u05d1\u05d2";
    const [first, second] = rows(`${hebrew}${SHY}${hebrew}`, 4);
    expect(first).toContain("-");
    expect(second).toContain(hebrew);
  });

  it("breaks after ZWSP", () => {
    expect(rows(`aaaa${ZWSP}bbbb`, 5).map((row) => row.replace(ZWSP, ""))).toEqual(["aaaa", "bbbb"]);
  });

  it.each([["WORD JOINER", WJ], ["ZERO WIDTH NO-BREAK SPACE", BOM]])("does not break at %s", (_name, joiner) => {
    expect(rows(`aaaa${joiner}bbbb cc`, 8)).toEqual([`aaaa${joiner}bbbb`, "cc"]);
  });

  const unspaced = (text: string, width: number): void => {
    const wrapped = rows(text, width);
    const words = new Set([0]);
    for (const { index, segment } of new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)) words.add(index + segment.length);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped.join("")).toBe(text);
    let at = 0;
    for (const row of wrapped) {
      at += row.length;
      expect(words.has(at)).toBe(true);
      expect(cellLen(row)).toBeLessThanOrEqual(width);
    }
  };

  it.each([
    ["Thai", "\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22\u0e44\u0e21\u0e48\u0e21\u0e35\u0e0a\u0e48\u0e2d\u0e07\u0e27\u0e48\u0e32\u0e07", 8],
    ["Lao", "\u0ea5\u0eb2\u0ea7\u0e9a\u0ecd\u0ec8\u0ea1\u0eb5", 3],
    ["Khmer", "\u1781\u17d2\u1798\u17c2\u179a\u1797\u17b6\u179f\u17b6", 4],
    ["Burmese", "\u1019\u103c\u1014\u103a\u1019\u102c\u1005\u102c", 3],
  ])("wraps %s, written without spaces, at its word boundaries", (_script, text, width) => {
    unspaced(text as string, width as number);
  });

  it("leaves a word of any other script to the reference's one rule", () => {
    expect(rows("aaaa-bbbb", 5)).toEqual(["aaaa-", "bbbb"]);
  });
});

describe("line and paragraph separators", () => {
  it.each([["LINE SEPARATOR", LS], ["PARAGRAPH SEPARATOR", PS]])("ends a line at %s", (_name, separator) => {
    expect(rows(`one${separator}two`, 20)).toEqual(["one", "two"]);
  });

  it("gives every reader of a Text one line ending", () => {
    const text = new RichText(`ab${LS}cd`);
    expect(text.split("\n")).toHaveLength(2);
    expect(text.plain.length).toBe(5);
    const styled = new RichText(`ab${LS}cd`);
    styled.stylize("red", 3, 5);
    expect(wire(styled, 10, "truecolor")).toContain("\x1b[31mcd\x1b[0m");
  });

  it("starts a tab stop afresh after one", () => {
    expect(rows(`abc${LS}a\tb`, 20)).toEqual(["abc", "a       b"]);
  });

  it("flattens one in a Panel title as it flattens an LF", () => {
    expect(rows(new Panel("x", { title: `a${LS}b` }), 12)).toHaveLength(3);
  });

  it("shows one in Syntax as its escape, so a line number stays the one an editor shows", () => {
    expect(rows(new Syntax(`a${LS}b\nc`, "text", { lineNumbers: true }), 20).map((row) => row.trim().at(0))).toEqual(["1", "2"]);
  });

  it("shows one in JSON as the escape a JSON string needs", () => {
    expect(rows(JSONRenderable.fromData(`b${LS}c`), 40)).toEqual([String.raw`"b\u2028c"`]);
  });

  it("leaves Pretty's later rows where they were", () => {
    class Named {
      constructor(private readonly name: string) {}
      toString(): string {
        return this.name;
      }
    }
    const shown = (name: string): string[] => rows(new Pretty([new Named(name), "after-after-after"]), 12);
    expect(shown(`a${LS}b`).slice(-2)).toEqual(shown("ab").slice(-2));
  });

  it("reaches no wire from a raw segment, which measures it as nothing", () => {
    expect(wireText(`a${LS}b${PS}c`)).toBe("abc");
    expect(new Segment(`a${LS}b`).cellLength).toBe(2);
  });
});

describe("marks and anchors that hold no state", () => {
  it.each([
    ["ARABIC LETTER MARK", "\u061c"],
    ["MONGOLIAN VOWEL SEPARATOR", "\u180e"],
    ["an annotation anchor", "\ufff9"],
    ["an annotation separator", "\ufffa"],
    ["an annotation terminator", "\ufffb"],
  ])("writes %s where the text has it, in no cell", (_name, mark) => {
    expect(rows(`a${mark}b`, 10)).toEqual([`a${mark}b`]);
    expect(cellLen(`a${mark}b`)).toBe(2);
  });

  it("writes annotated text with its annotation visible", () => {
    const annotated = `\ufff9${KANJI}\ufffa\u304b\u3064\ufffb`;
    expect(rows(annotated, 10)).toEqual([annotated]);
    expect(cellLen(annotated)).toBe(6);
  });
});

describe("tag characters", () => {
  it("writes an emoji subdivision flag", () => {
    expect(rows(ENGLAND, 10)).toEqual([ENGLAND]);
    expect(cellLen(ENGLAND)).toBe(2);
  });

  it("writes none of a text hidden in tags, to the wire or an export", () => {
    expect(rows(`a${HIDDEN}b`, 10)).toEqual(["ab"]);
    const chunks: string[] = [];
    const console = new Console({ file: { write: (chunk) => void chunks.push(String(chunk)) }, width: 10, markup: false, record: true });
    console.print(`a${HIDDEN}b`);
    expect(console.exportHtml({ clear: false })).not.toMatch(/[\u{e0020}-\u{e007f}]/u);
    expect(console.exportText()).toBe("ab\n");
  });

  it("measures a text that is one long run of them in linear time", () => {
    expect(cellLen(`a${"\u{e0068}".repeat(50000)}`)).toBe(1);
  });

  it("writes no tag on a black flag that spells nothing", () => {
    expect(wireText("\u{1f3f4}\u{e0067}\u{e007f}")).toBe("\u{1f3f4}");
  });

  it("deletes LANGUAGE TAG from content", () => {
    expect(new RichText("a\u{e0001}b").plain).toBe("ab");
    expect(rows("a\u{e0001}b", 10)).toEqual(["ab"]);
  });

  it("leaves spans where they were: only the wire reads a tag's neighbours", () => {
    const text = new RichText(`a${HIDDEN}b`);
    text.stylize("red", 5, 6);
    expect(text.plain.length).toBe(6);
    expect(wire(text, 10, "truecolor")).toContain("\x1b[31mb\x1b[0m");
  });
});

describe("data on show", () => {
  it("shows JSON whatever the wire withholds, so it parses back to the data", () => {
    const data = { [`k${SHY}`]: `a${SHY}b${HIDDEN}c${LS}d${VS1}${VS1}e\u007ff\u0085g\u206ah\u{e0001}i` };
    expect(JSON.parse(wire(JSONRenderable.fromData(data, { indent: 0 } as never), 200))).toEqual(data);
  });

  it("leaves a selector the wire keeps as the character it is", () => {
    expect(rows(JSONRenderable.fromData(`${HEART}${VS16}`), 20)).toEqual([`"${HEART}${VS16}"`]);
  });
});

describe("the deprecated switches", () => {
  it("deletes them from content", () => {
    expect(new RichText("a\u206ab\u206fc").plain).toBe("abc");
    expect(rows("a\u206ab\u206fc", 10)).toEqual(["abc"]);
  });
});

describe("the measure is the width of what the wire holds", () => {
  const ALPHABET = ["a", "b", KANJI, HEART, WOMAN, LAPTOP, ZWJ, ZWNJ, VS1, VS16, IVS, SHY, ZWSP, LS, COMBINING, "\u{e0068}", "\u{e007f}", "\u{1f3f4}", "\u3164", "\u1160"];

  // A linear congruential generator, so a failure names a string that recurs.
  function* strings(count: number): Iterable<string> {
    let seed = 12345;
    const next = (bound: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };
    for (let i = 0; i < count; i++) yield Array.from({ length: 1 + next(8) }, () => ALPHABET[next(ALPHABET.length)]!).join("");
  }

  it("agrees with a heart whose selector a mark separates", () => {
    expect(cellLen(`${HEART}${COMBINING}${VS16}`)).toBe(1);
  });

  it("forms no join by a deletion", () => {
    expect(cellLen(`${WOMAN}${ZWJ}${SHY}${LAPTOP}`)).toBe(4);
    expect(cellLen(`${WOMAN}${ZWJ}\u{e0068}${LAPTOP}`)).toBe(4);
    expect(cellLen(`${WOMAN}${SHY}${ZWJ}${LAPTOP}`)).toBe(4);
    expect(cellLen(`${WOMAN}${SHY}${COMBINING}${ZWJ}${LAPTOP}`)).toBe(4);
  });

  // Every string of up to five code points the joins are made of.
  function* exhaustive(): Iterable<string> {
    const parts = [HEART, WOMAN, ZWJ, SHY, COMBINING, VS16, "\u{e0068}", LS];
    let level = [""];
    for (let length = 1; length <= 5; length++) {
      level = level.flatMap((text) => parts.map((part) => text + part));
      yield* level;
    }
  }

  it("stays the sum over the text's clusters, the width of its wire form, and stable", () => {
    for (const text of [...exhaustive(), ...strings(20000)]) {
      const sum = graphemes(text).reduce((cells, glyph) => cells + cellLen(glyph), 0);
      expect([text, cellLen(text)]).toEqual([text, sum]);
      expect([text, cellLen(wireText(text))]).toEqual([text, sum]);
      expect(wireText(wireText(text))).toBe(wireText(text));
    }
  });
});

describe("what a break leaves behind", () => {
  it("does not break where a run of an unspaced script starts", () => {
    const thai = "ภาษาไทย";
    expect(rows(`(${thai})`, 4)[0]).not.toBe("(");
    expect(rows(`abc${thai}`, 6)[0]).not.toBe("abc");
  });

  it("gives a soft hyphen that opens a word nothing to hyphenate", () => {
    expect(rows(`foo ${SHY}bar`, 6)).toEqual(["foo", "bar"]);
    expect(rows(`  ${SHY}foo`, 3)).toEqual(rows("  foo", 3));
  });

  it("does not count a zero-width code point after a wrap's whitespace as content", () => {
    const drawn = (text: string, width: number, options: Partial<RenderOptions>): string[] =>
      Array.from(new RichText(text).render({ ...new Console({ width }).options, ...options }), (segment) => segment.text).join("").split("\n");
    for (const opener of [ZWSP, SHY, WJ]) {
      expect(drawn(`foo ${opener}bar`, 3, { overflow: "ellipsis" })[0]).toMatch(/^foo/);
      const [row] = drawn(`foo ${opener}bar`, 5, { justify: "right" });
      expect(row!.indexOf("f")).toBe(2);
    }
  });
});

describe("a line separator a value wrote", () => {
  class Named {
    constructor(private readonly name: string) {}
    toString(): string {
      return this.name;
    }
  }

  it("lays out as an LF does, guides and hang included", () => {
    const shown = (name: string): string[] => rows(new Pretty({ a: new Named(name), b: "after-after-after-after-after" }, { indentGuides: true }), 24);
    expect(shown(`x${LS}y`)).toEqual(shown("x\ny"));
    expect(shown(`x${PS}y`)).toEqual(shown("x\ny"));
  });

  it("is measured and expanded as an LF is", () => {
    const options = new Console({ width: 80 }).options;
    expect(new Pretty(new Named(`aaaa${LS}bbbb`)).measure(options)).toEqual(new Pretty(new Named("aaaa\nbbbb")).measure(options));
    const map = (key: string): Map<Named, string> => new Map([[new Named(key), "v"]]);
    expect(rows(new Pretty(map(`k${LS}ey`)), 40)).toEqual(rows(new Pretty(map("k\ney")), 40));
  });
});

describe("the edge of a text", () => {
  it("is the last thing drawn, past what the wire withholds", () => {
    const options = new Console({ width: 80 }).options;
    const painted = (text: string): RichText => new RichText(text).stylize("on red", 0, 2);
    const right = (text: string): unknown => painted(text).edgeStyle("right", options).toString();
    expect(right(`ab${SHY}`)).toBe(right("ab"));
    expect(right(`ab${HIDDEN}`)).toBe(right("ab"));
  });
});

describe("JSON", () => {
  it("escapes every hidden family in one document and parses back", () => {
    const data = { k: `a\u202e${SHY}${HIDDEN}\u007f\u{e0001}${LS}${VS1}${VS1}b` };
    expect(JSON.parse(wire(JSONRenderable.fromData(data), 200))).toEqual(data);
  });
});

describe("where a row and a word end", () => {
  const drawn = (text: string, width: number, options: Partial<RenderOptions>): string[] =>
    Array.from(new RichText(text).render({ ...new Console({ width }).options, ...options }), (segment) => segment.text).join("").split("\n");

  it("fills a row flush to its edge past a zero-width opener", () => {
    const row = (opener: string): string => drawn(`aa bb cc ${opener}dddddddddddd`, 12, { justify: "full" })[0]!;
    expect(row(ZWSP).trimEnd()).toBe(row("").trimEnd());
    expect(row(WJ).trimEnd()).toBe(row("").trimEnd());
  });

  it("keeps a space a mark is drawn on as content", () => {
    expect(drawn(`ab ${COMBINING}`, 6, { justify: "right" })[0]).toBe(`   ab ${COMBINING}`);
  });

  it("does not break a word at a soft hyphen with no glyph after it", () => {
    for (const closer of [ZWSP, COMBINING, "\u{e0068}"]) expect(rows(`abcd foo${SHY}${closer}`, 8)).toHaveLength(1);
    expect(rows(`foo${SHY}${SHY}${SHY} bar`, 3)).toEqual(["foo", "bar"]);
  });

  it("is linear in a word of nothing but marks", () => {
    const started = performance.now();
    expect(rows(`a${SHY}${ZWNJ.repeat(200000)}b`, 40).length).toBeGreaterThan(0);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe("Pretty, showing data", () => {
  it("escapes the selectors the wire would withhold from a string", () => {
    expect(rows(new Pretty(`a${VS1}${VS1}b`), 40)).toEqual([`"a${VS1}\\ufe00b"`]);
  });

  it("wraps a value's soft hyphen the same at every depth, with no hyphen", () => {
    class Named {
      toString(): string {
        return `hello${SHY}worldworld`;
      }
    }
    expect(rows(new Pretty(new Named()), 12).join("")).not.toContain("-");
    expect(rows(new Pretty({ a: new Named() }), 14).join("")).not.toContain("-");
  });
});

describe("Syntax, showing code", () => {
  it("escapes what the wire would drop, so no identifier is invented", () => {
    expect(rows(new Syntax(`total${SHY}count${HIDDEN}`, "text"), 40)).toEqual([String.raw`total\u00adcount\u{e0068}\u{e0069}`]);
  });

  it("draws no hyphen the source does not hold", () => {
    expect(rows(new Syntax(`const total${SHY}count = 1;`, "text", { wordWrap: true }), 14).join("")).not.toContain("-");
  });
});

describe("adjacent marks", () => {
  it("draws no row of a lone hyphen", () => {
    expect(rows(`hello${SHY}${SHY}world${SHY}again`, 5)).toEqual(["hello", "world", "again"]);
    expect(rows(`hello${SHY}${SHY}world`, 6)).toEqual(["hello-", "world"]);
  });
});

describe("the edge of a text with a tab", () => {
  it("is the tab, which draws its cells", () => {
    const options = new Console({ width: 80 }).options;
    const text = new RichText("ab\t").stylize("on red", 2, 3);
    expect(text.edgeStyle("right", options).toString()).toContain("red");
  });
});

describe("a span edge inside a sequence", () => {
  const TRUECOLOR = { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, underlines: ALL_UNDERLINES, isTerminal: false, reducedMotion: false, textOrder: "plain" } as const;
  const SGR = /\x1b\[[0-9;]*m/g;
  // The first row the wire holds, its styling taken off: what the terminal lays out.
  const drawn = (bytes: string): string => bytes.replace(SGR, "").split("\n")[0]!;
  // `text` styled bold from the code unit `at` on, written at a width it fits.
  const options = new Console({ width: 80 }).options;
  const edged = (text: string, at: number, textOrder: TextOrder = "plain"): string =>
    drawn(segmentsToString(render(new RichText(text).stylize("bold", at), { ...options, textOrder }), { ...TRUECOLOR, textOrder }));

  it("reports the edge in the style the edge cell is drawn in", () => {
    const right = (text: string, at: number): string => new RichText(text).stylize("on red", at).edgeStyle("right", options).toString();
    expect(right(`x${WOMAN}${ZWJ}${LAPTOP}`, 4)).toBe(right("x", 1));
    expect(right("x\u{1f1fa}\u{1f1f8}", 3)).toBe(right("x", 1));
  });

  it("lets no segment reshape the glyph in the one before it", () => {
    const row = (...texts: string[]): string => drawn(segmentsToString(texts.map((text) => new Segment(text)), TRUECOLOR));
    expect(row("a", VS1, VS1)).toBe("a");
    expect(row(HEART, "︎")).toBe(HEART);
    expect(row("e", `${COMBINING}x`)).toBe("ex");
  });

  it("judges an edge on what is written, after the order's controls are gone", () => {
    const row = drawn(segmentsToString([new Segment(`${WOMAN}${ZWJ}${PDF}`), new Segment(LAPTOP)], TRUECOLOR));
    expect(cellLen(row)).toBe(4);
  });

  it("keeps an extender with no glyph before it on the row", () => {
    expect(drawn(segmentsToString([new Segment(`${COMBINING}a`)], TRUECOLOR))).toBe(`${COMBINING}a`);
    expect(segmentsToString([new Segment("a\n"), new Segment(`${COMBINING}b`)], TRUECOLOR).replace(/\x1b\[[0-9;]*m/g, "")).toBe(`a\n${COMBINING}b`);
  });

  it("keeps an extender that takes a cell of its own where it opens a segment", () => {
    const row = drawn(segmentsToString([new Segment("|"), new Segment("ﾞ|")], TRUECOLOR));
    expect(row).toBe("|ﾞ|");
    expect(cellLen(row)).toBe(3);
  });

  it("keeps what a control segment's text may carry to the wire, and no more", () => {
    const bytes = segmentsToString([new Segment("a"), new Segment(`\x1b]0;t\x07${ZWJ}`, undefined, [])], TRUECOLOR);
    expect(bytes).not.toContain("\x07");
  });

  it.each([
    ["a join with a soft hyphen in it", `${WOMAN}${ZWJ}${SHY}${LAPTOP}`, 3],
    ["a join", `${WOMAN}${ZWJ}${LAPTOP}`, 3],
    ["a selector past a soft hyphen", `${HEART}${SHY}${VS16}`, 2],
    ["a selector", `${HEART}${VS16}`, 1],
  ])("writes %s as wide as it measures", (_name, text, at) => {
    expect(cellLen(edged(text, at))).toBe(cellLen(text));
  });

  // The PDF ends the heart's cluster, so the selector selects nothing in the text
  // as given. Every order drops the PDF: logical drops the selector with it, the
  // rest keep it, so it joins the heart and makes it wide.
  it.each([["plain", 3], ["logical", 2], ["visual", 3], ["words", 3]] as const)("writes a selector past a removed control as wide as it measures under %s", (textOrder, width) => {
    const text = `${HEART}${PDF}${VS16}|`;
    for (let at = 0; at <= text.length; at += 1) {
      const measured = new RichText(text).stylize("bold", at).measure({ ...options, textOrder }).maximum;
      expect([at, measured, cellLen(edged(text, at, textOrder))]).toEqual([at, width, width]);
    }
  });

  it("keeps a flag's tags with its base", () => {
    expect(edged(`a${ENGLAND}b`, 5)).toBe(`a${ENGLAND}b`);
  });

  it("keeps one selector on a glyph", () => {
    expect(edged(`${HEART}${VS1}${VS1}`, 2)).toBe(`${HEART}${VS1}`);
  });

  // Every string of up to four code points the joins are made of, cut before every code point.
  function* cuts(): Iterable<[string, number]> {
    const parts = [HEART, WOMAN, ZWJ, SHY, COMBINING, VS16, VS1, "\u{e0068}", "\u{1f1fa}", "\u{1f3fd}", "a"];
    let level = [""];
    for (let length = 1; length <= 4; length++) {
      level = level.flatMap((text) => parts.map((part) => text + part));
      for (const text of level) {
        let at = 0;
        for (const character of [...text, ""]) {
          yield [text, at];
          at += character.length;
        }
      }
    }
  }

  it("writes every text as wide as it measures, wherever a style changes", () => {
    for (const [text, at] of cuts()) expect([text, at, cellLen(edged(text, at))]).toEqual([text, at, cellLen(text)]);
  });

  it("joins nothing across an edge between segments, which were measured apart", () => {
    for (const [text, at] of cuts()) {
      const [left, right] = [text.slice(0, at), text.slice(at)];
      const row = drawn(segmentsToString([new Segment(left, Style.parse("bold")), new Segment(right)], TRUECOLOR));
      expect([left, right, cellLen(row)]).toEqual([left, right, cellLen(left) + cellLen(right)]);
    }
  });
});
