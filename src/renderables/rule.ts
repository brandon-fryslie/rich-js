/**
 * Rule — a horizontal divider line, optionally with a centered title.
 */

import { asCellCol, cellLen, setCellSize } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import type { RichText } from "../core/text.js";
import { Style, NULL_STYLE } from "../core/style.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle } from "../core/protocol.js";
import { cutLabel, drawLabel, inlineLabel, type InlineLabel } from "./embed.js";

export type RuleAlign = "left" | "center" | "right";

export interface RuleOptions {
  characters?: string;
  align?: RuleAlign;
  style?: string | Style;
}

const ASCII_RULE_CHAR = "-";
const DEFAULT_RULE_CHAR = "\u2500"; // ─

export class Rule implements Renderable, Measurable {
  readonly title: string | RichText | undefined;
  readonly characters: string;
  readonly align: RuleAlign;
  readonly style: string | Style;
  private readonly _label: InlineLabel | undefined;

  constructor(title?: string | RichText, options?: RuleOptions) {
    const chars = options?.characters ?? DEFAULT_RULE_CHAR;
    // [LAW:parse-dont-validate] Rich's rule: a rule drawn from zero-width
    // characters would advance no cells, so `repeatToWidth` never meets one.
    if (cellLen(chars) < 1) {
      throw new Error("Rule characters must have a cell width of at least 1");
    }
    const align = options?.align;
    if (align !== undefined && align !== "left" && align !== "center" && align !== "right") {
      throw new Error(`Invalid align value: "${align}"`);
    }

    this.title = title;
    this._label = inlineLabel(title);
    this.characters = chars;
    this.align = align ?? "center";
    this.style = options?.style ?? NULL_STYLE;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const maxWidth = options.maxWidth;
    const ruleChar = drawable(options, this.characters, ASCII_RULE_CHAR);
    const style = getStyle(options, this.style);
    const ruleStyle = style.isNull ? undefined : style;
    const line = (width: number) => new Segment(repeatToWidth(ruleChar, width), ruleStyle);

    // Rich's `required_space`: a centred title keeps a rule cell and a space
    // either side of it, an aligned one a space and a rule cell on its open
    // side. A rule with no room past that draws no title, as one without a title.
    const room = Math.max(0, maxWidth - (this.align === "center" ? 4 : 2));
    if (this._label === undefined || room === 0) {
      yield line(maxWidth);
      yield Segment.line();
      return;
    }

    const text = this._label.text(options);
    cutLabel(text, room, drawable(options, "\u2026", "."));
    const title = drawLabel(text, options, ruleStyle);
    const titleWidth = Segment.getLineLength(title);

    // As Rich lays the line out: the gaps of a centred title are the rule's,
    // styled with it; an aligned title's one gap is unstyled.
    switch (this.align) {
      case "center": {
        const left = Math.floor((maxWidth - titleWidth) / 2) - 1;
        yield line(left);
        yield new Segment(" ", ruleStyle);
        yield* title;
        yield new Segment(" ", ruleStyle);
        yield line(maxWidth - left - titleWidth - 2);
        break;
      }
      case "left":
        yield* title;
        yield new Segment(" ");
        yield line(maxWidth - titleWidth - 1);
        break;
      case "right":
        yield line(maxWidth - titleWidth - 1);
        yield new Segment(" ");
        yield* title;
        break;
    }
    yield Segment.line();
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: _options.maxWidth };
  }
}

// [LAW:one-source-of-truth] `setCellSize` crops between the grapheme clusters
// `cellLen` measures, so `❤️` or `👨‍👩‍👧` is never cut in half or over-counted.
function repeatToWidth(char: string, width: number): string {
  return setCellSize(char.repeat(Math.ceil(width / cellLen(char))), asCellCol(width));
}
