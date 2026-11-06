import { describe, expect, it } from "vitest";
import { ColorDepth } from "../../src/core/color.js";
import { encodeHtml } from "../../src/core/export-html.js";
import { encodeSvg } from "../../src/core/export-svg.js";
import { render, type OverflowMethod, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import type { TextOrder } from "../../src/core/text-order.js";

// [LAW:behavior-not-structure] A visual row cannot be a `RichText` (`wrap`
// refuses the order), so a host takes its rows off the render, which ends each
// row in a `Segment.line()`. The contract is that those rows, each drawn alone
// and followed by a line break, are the render — in bytes and in both exports —
// and that there are as many of them as the text has rows in logical order,
// since reordering moves cells within a row and never across one.

const SHY = "­";
const LRI = "⁦";
const RLI = "⁧";
const PDI = "⁩";

const destination = (textOrder: TextOrder) =>
  ({ colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, isTerminal: false, reducedMotion: false, textOrder }) as const;

/** Each text under the default `end`, so the render ends its last row in a break as it does every other. */
function texts(): RichText[] {
  const spanned = (plain: string): RichText => {
    const text = new RichText(plain);
    text.stylize("bold", 2, Math.floor(plain.length / 2) + 3);
    text.stylize("on blue", Math.floor(plain.length / 3), plain.length);
    return text;
  };
  return [
    // RTL rows ending in whitespace that hangs past the edge.
    spanned("שלום   עולם     יפה   מאוד   "),
    // A neutral and a number at a break, resolved by the strong text across it.
    spanned("שלום עולם ! 123 עוד מילים, 45 בעברית"),
    spanned("english first then עברית בסוף השורה הזאת"),
    spanned("שלום עולם, hello world! 123 עוד מילים\nsecond line"),
    // A blank row inside the text and an empty one after its last break.
    spanned("two lines\nof text\n\nwith a blank one\n"),
    spanned(`hy${SHY}phen${SHY}ation is ${SHY}soft hy${SHY}phen${SHY}ated text`),
    spanned("tab\tseparated\tcolumns\tof text"),
    spanned("wide 漢字の文字列 cells 漢字漢字漢字 across"),
    spanned(`an ${RLI}isolate open across ${PDI}a break and ${LRI}another`),
    spanned("plain latin text with no direction in it"),
    spanned(""),
  ];
}

const widths = [1, 3, 7, 12, 20, 80];
const justifies = [undefined, "left", "center", "right", "full"] as const;
const overflows: OverflowMethod[] = ["fold", "crop", "ellipsis", "ignore"];
const orders: TextOrder[] = ["plain", "logical", "visual", "words"];

describe("A text's placed rows, taken off its render, draw it one per line", () => {
  for (const textOrder of orders) {
    it(textOrder, () => {
      for (const text of texts()) {
        for (const maxWidth of widths) {
          for (const justify of justifies) {
            for (const overflow of overflows) {
              const options: RenderOptions = { maxWidth, textOrder, justify, overflow };
              const whole = [...render(text, options)];
              const rows = Segment.splitLines(whole);
              const label = JSON.stringify({ plain: text.plain, maxWidth, justify, overflow });
              expect(rows.length, label).toBe(text.wrap({ ...options, textOrder: "logical" }).length);
              const target = destination(textOrder);
              expect(rows.map((row) => `${segmentsToString(row, target)}\n`).join(""), label).toBe(segmentsToString(whole, target));
              const laid = rows.flatMap((row) => [...row, Segment.line()]);
              expect(encodeHtml(laid), label).toBe(encodeHtml(whole));
              expect(encodeSvg(laid, { title: "t", width: maxWidth }), label).toBe(encodeSvg(whole, { title: "t", width: maxWidth }));
            }
          }
        }
      }
    });
  }
});
