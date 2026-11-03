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
// refuses the order), so a host takes its rows off the render: one
// `Segment.line()` between each. The contract is that those rows, each drawn
// alone and laid one per line, are the render — in bytes and in both exports.

const destination = (textOrder: TextOrder) =>
  ({ colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, reducedMotion: false, textOrder }) as const;

function texts(): RichText[] {
  const spanned = (plain: string): RichText => {
    const text = new RichText(plain, { end: "" });
    text.stylize("bold", 2, Math.floor(plain.length / 2) + 3);
    text.stylize("on blue", Math.floor(plain.length / 3), plain.length);
    return text;
  };
  return [
    // An RTL line whose rows end in whitespace hanging past the edge (cmt-bee92ff0).
    spanned("שלום   עולם     יפה   מאוד   "),
    // A neutral and a number at a break, resolved by the strong text across it (cmt-bee92ff0).
    spanned("שלום עולם ! 123 עוד מילים, 45 בעברית"),
    spanned("english first then עברית בסוף השורה הזאת"),
    spanned("שלום עולם, hello world! 123 עוד מילים\nsecond line"),
    spanned("plain latin text with no direction in it"),
  ];
}

const widths = [3, 7, 12, 20];
const justifies = [undefined, "left", "center", "right", "full"] as const;
const overflows: OverflowMethod[] = ["fold", "crop", "ellipsis"];
const orders: TextOrder[] = ["plain", "logical", "visual"];

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
              const target = destination(textOrder);
              expect(rows.map((row) => segmentsToString(row, target)).join("\n"), label).toBe(segmentsToString(whole, target));
              const laid = rows.flatMap((row, index) => [...(index > 0 ? [Segment.line()] : []), ...row]);
              expect(encodeHtml(laid), label).toBe(encodeHtml(whole));
              expect(encodeSvg(laid, { title: "t", width: maxWidth }), label).toBe(encodeSvg(whole, { title: "t", width: maxWidth }));
            }
          }
        }
      }
    });
  }
});
