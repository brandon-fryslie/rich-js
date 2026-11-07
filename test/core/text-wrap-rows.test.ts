import { describe, expect, it } from "vitest";
import { ALL_UNDERLINES } from "../../src/core/color.js";
import { ColorDepth } from "../../src/core/color.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText, type WrapOptions } from "../../src/core/text.js";
import type { OverflowMethod } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] The contract `wrap` makes is one sentence: drawn
// one per line with the same options, its rows are the text's render. Every
// case below asks only that, over the inputs that make a row hard to draw alone.

const SHY = "­";
const LRI = "⁦";
const RLI = "⁧";
const PDI = "⁩";
const RLE = "‫";
const PDF = "‬";
const RLM = "‏";

/** Each text with spans across its breaks, its gaps and its edges. */
function texts(): RichText[] {
  const spanned = (plain: string, style?: string): RichText => {
    const text = new RichText(plain, { end: "", ...(style === undefined ? {} : { style }) });
    // A span over the middle of the text, one over its tail, and one character's worth.
    text.stylize("bold", 2, Math.floor(plain.length / 2) + 3);
    text.stylize("on blue", Math.floor(plain.length / 3), plain.length);
    text.stylize(new Style({ italic: true }), 1, 2);
    return text;
  };
  return [
    spanned("The quick brown fox jumps over the lazy dog"),
    spanned("The quick brown fox jumps over the lazy dog", "on red"),
    spanned("supercalifragilisticexpialidocious and more"),
    spanned(`hy${SHY}phen${SHY}ation is ${SHY}soft hy${SHY}phen${SHY}ated text`),
    spanned("tab\tseparated\tcolumns\tof text"),
    spanned("hanging   whitespace     past   the edge   "),
    spanned("wide 漢字の文字列 cells 漢字漢字漢字 across"),
    spanned("two lines\nof text\n\nwith a blank one\n"),
    spanned("שלום עולם, hello world! 123 עוד מילים בעברית"),
    spanned("english first then עברית בסוף השורה הזאת"),
    spanned(`an ${RLI}isolate open across ${PDI}a break and ${LRI}another`),
    spanned(`embedding ${RLE}שלום across a break${PDF} and ${RLM}marks`),
    spanned(""),
  ];
}

const destination = (textOrder: "plain" | "logical") =>
  ({ colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, underlines: ALL_UNDERLINES, isTerminal: false, reducedMotion: false, textOrder }) as const;

/** The rows drawn one per line, as a host lays them out. */
function drawnRows(rows: readonly RichText[], options: WrapOptions): Segment[] {
  return rows.flatMap((row, index) => [...(index > 0 ? [Segment.line()] : []), ...row.render(options)]);
}

/** Bytes, and the segments with what writes nothing left out. */
function drawn(segments: readonly Segment[], order: "plain" | "logical") {
  const shown = segments.filter((segment) => segment.text !== "");
  return {
    bytes: segmentsToString(shown, destination(order)),
    segments: shown.map((segment) => [segment.text, segment.style?.toString() ?? ""]),
  };
}

const widths = [1, 3, 7, 12, 20, 80];
const justifies = [undefined, "left", "center", "right", "full"] as const;
const overflows: OverflowMethod[] = ["fold", "crop", "ellipsis", "ignore"];
const orders = ["plain", "logical"] as const;

describe("RichText.wrap: drawn one per line, its rows are the text's render", () => {
  for (const order of orders) {
    for (const overflow of overflows) {
      for (const noWrap of [false, true]) {
        it(`${order}, overflow ${overflow}${noWrap ? ", noWrap" : ""}`, () => {
          for (const text of texts()) {
            for (const maxWidth of widths) {
              for (const justify of justifies) {
                const options: WrapOptions = { maxWidth, textOrder: order, overflow, noWrap, justify };
                const rows = text.wrap(options);
                const label = JSON.stringify({ plain: text.plain, maxWidth, justify });
                expect(drawn(drawnRows(rows, options), order), label).toEqual(drawn([...text.render(options)], order));
              }
            }
          }
        });
      }
    }
  }
});

describe("RichText.wrap: a row says all it draws in its text, spans and format", () => {
  it("draws the same rebuilt from its plain text, spans and format", () => {
    for (const order of orders) {
      for (const text of texts()) {
        for (const justify of justifies) {
          const options: WrapOptions = { maxWidth: 12, textOrder: order, justify };
          for (const row of text.wrap(options)) {
            const rebuilt = new RichText(row.plain, {
              style: row.style,
              justify: row.justify,
              overflow: row.overflow,
              end: row.end,
              noWrap: row.noWrap,
              direction: row.direction,
            });
            for (const span of row.spans) rebuilt.stylize(span.style, span.start, span.end);
            expect(drawn([...rebuilt.render(options)], order)).toEqual(drawn([...row.render(options)], order));
          }
        }
      }
    }
  });

  it("holds the characters of the text, spans intact, as Rich's Text.wrap does", () => {
    const text = new RichText("The quick brown fox", { end: "" });
    text.stylize("bold", 4, 15);
    const rows = text.wrap({ maxWidth: 10 });
    expect(rows.map((row) => row.plain)).toEqual(["The quick ", "brown fox"]);
    expect(rows.map((row) => row.spans.map((span) => [span.start, span.end, span.style]))).toEqual([
      [[4, 10, "bold"]],
      [[0, 5, "bold"]],
    ]);
    expect(rows.map((row) => row.end)).toEqual(["", ""]);
  });

  it("writes a taken soft hyphen, a cut word's ellipsis and a full row's gaps into the row", () => {
    expect(new RichText(`hyphen${SHY}ation`).wrap({ maxWidth: 8 }).map((row) => row.plain)).toEqual(["hyphen-", "ation"]);
    expect(new RichText("unbreakable", { overflow: "ellipsis" }).wrap({ maxWidth: 5 }).map((row) => row.plain)).toEqual(["unbr…"]);
    expect(new RichText("a b c d e f", { justify: "full" }).wrap({ maxWidth: 6 }).map((row) => row.plain)).toEqual(["a b  c", "d e f"]);
  });

  it("states its line's direction under logical, which a row alone could not find", () => {
    // The second row holds no strong character of its own; its line is right-to-left.
    const rows = new RichText("שלום עולם 12345 67890").wrap({ maxWidth: 10, textOrder: "logical" });
    expect(rows.map((row) => row.direction)).toEqual(["rtl", "rtl", "rtl"]);
    expect(rows.at(-1)!.plain).toBe("67890");
  });

  it("a stated direction decides the paragraph, P3, for placing and ordering alike", () => {
    const bytes = (text: RichText) => segmentsToString([...text.render({ maxWidth: 20, textOrder: "logical" })], destination("logical"));
    // Left to right by its first strong character; stated right to left, its
    // isolate says so and it stands at its paragraph's right edge.
    expect(bytes(new RichText("abc", { end: "" }))).toBe("abc");
    expect(bytes(new RichText("abc", { end: "", direction: "rtl", justify: "start" }))).toBe(`${" ".repeat(17)}${RLI}abc${PDI}`);
    // The edge a separator meets is the one the stated direction shows there.
    const mixed = new RichText("abc שלום", { end: "" });
    mixed.stylize("bold", 0, 3);
    const edges = () => ["left", "right"].map((side) => mixed.edgeStyle(side as "left" | "right", { maxWidth: 20, textOrder: "visual" }).bold === true);
    // Its first strong character is Latin, so unstated it is left to right.
    expect(edges()).toEqual([true, false]);
    mixed.direction = "rtl";
    expect(edges()).toEqual([false, true]);
  });

  it("under visual, orders a line by the embeddings and marks it is drawn without", () => {
    const drawn = (plain: string) => Segment.plainOf([...new RichText(plain, { end: "" }).render({ maxWidth: 40, textOrder: "visual" })]);
    expect(drawn(`x ${RLE}abc !${PDF} y`)).toBe("x ! abc y");
    expect(drawn(`abc!${RLM} אב`)).toBe("abc!בא ");
  });

  it("finds a stated direction's edges in a row with no bidi character", () => {
    const text = new RichText("hello!", { end: "", direction: "rtl" });
    text.stylize("bold", 5, 6);
    const bold = (side: "left" | "right") => text.edgeStyle(side, { maxWidth: 20, textOrder: "logical" }).bold === true;
    expect([bold("left"), bold("right")]).toEqual([true, false]);
  });

  it("styles the ellipsis as Rich's truncate does: by the spans begun before it", () => {
    const text = new RichText("abcdefghij", { end: "", overflow: "ellipsis" });
    text.stylize("red", 8, 10);
    text.stylize("bold", 2, 6);
    const [row] = text.wrap({ maxWidth: 5 });
    expect(row!.plain).toBe("abcd…");
    expect(row!.spans.map((span) => [span.start, span.end, String(span.style)])).toEqual([[2, 5, "bold"]]);
  });

  it("refuses visual order in its type", () => {
    // @ts-expect-error A visual row is laid out by its whole line, so no RichText draws it alone.
    expect(() => new RichText("x").wrap({ maxWidth: 4, textOrder: "visual" })).toThrow(RangeError);
  });
});
