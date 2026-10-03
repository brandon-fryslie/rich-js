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
import { drawLabel, inlineLabel, type InlineLabel } from "./embed.js";

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

    const label = this._label?.text(options);

    if (label === undefined) {
      // No title — just a line of repeated characters
      yield new Segment(repeatToWidth(ruleChar, maxWidth), ruleStyle);
      yield Segment.line();
      return;
    }

    const title = drawLabel(label, options, ruleStyle);
    const titleWidth = Segment.getLineLength(title);

    if (titleWidth >= maxWidth) {
      // Title fills the whole width; adjustLineLength cuts by cells, not code units.
      yield* Segment.adjustLineLength(title, maxWidth, ruleStyle);
      yield Segment.line();
      return;
    }

    const remaining = maxWidth - titleWidth;

    // [LAW:dataflow-not-control-flow] Always compute both sides; alignment determines distribution
    const leftWidth =
      this.align === "right"
        ? remaining
        : this.align === "center"
          ? Math.floor(remaining / 2)
          : 0;
    const rightWidth = remaining - leftWidth;

    if (leftWidth > 0) {
      yield new Segment(repeatToWidth(ruleChar, leftWidth), ruleStyle);
    }
    yield* title;
    if (rightWidth > 0) {
      yield new Segment(repeatToWidth(ruleChar, rightWidth), ruleStyle);
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
