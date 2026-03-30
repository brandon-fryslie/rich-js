/**
 * Rule — a horizontal divider line, optionally with a centered title.
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export type RuleAlign = "left" | "center" | "right";

export interface RuleOptions {
  characters?: string;
  align?: RuleAlign;
  style?: string | Style;
}

const ASCII_RULE_CHAR = "-";
const DEFAULT_RULE_CHAR = "\u2500"; // ─

export class Rule implements Renderable, Measurable {
  readonly title: string | undefined;
  readonly characters: string;
  readonly align: RuleAlign;
  readonly style: Style;

  constructor(title?: string, options?: RuleOptions) {
    const chars = options?.characters ?? DEFAULT_RULE_CHAR;
    if (chars.length === 0) {
      throw new Error("Rule characters must not be empty");
    }
    const align = options?.align;
    if (align !== undefined && align !== "left" && align !== "center" && align !== "right") {
      throw new Error(`Invalid align value: "${align}"`);
    }

    this.title = title;
    this.characters = chars;
    this.align = align ?? "center";
    this.style = resolveStyle(options?.style);
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const maxWidth = options.maxWidth;
    const ruleChar = options.asciiOnly ? ASCII_RULE_CHAR : this.characters;
    const ruleStyle = this.style.isNull ? undefined : this.style;

    if (!this.title) {
      // No title — just a line of repeated characters
      yield new Segment(repeatToWidth(ruleChar, maxWidth), ruleStyle);
      yield Segment.line();
      return;
    }

    // With title
    const titleText = ` ${this.title} `;
    const titleWidth = cellLen(titleText);

    if (titleWidth >= maxWidth) {
      // Title fills the whole width
      yield new Segment(titleText.slice(0, maxWidth), ruleStyle);
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
    yield new Segment(titleText, ruleStyle);
    if (rightWidth > 0) {
      yield new Segment(repeatToWidth(ruleChar, rightWidth), ruleStyle);
    }
    yield Segment.line();
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: _options.maxWidth };
  }
}

function repeatToWidth(char: string, width: number): string {
  const charWidth = cellLen(char);
  if (charWidth === 0) return " ".repeat(width);
  const repeats = Math.ceil(width / charWidth);
  const full = char.repeat(repeats);
  // Trim to exact width
  let w = 0;
  let i = 0;
  for (const c of full) {
    const cw = cellLen(c);
    if (w + cw > width) break;
    w += cw;
    i += c.length;
  }
  const result = full.slice(0, i);
  // Pad if needed (wide char couldn't fill exact width)
  const gap = width - w;
  return gap > 0 ? result + " ".repeat(gap) : result;
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}
