/**
 * Box-drawing character sets for borders and table grids.
 */

import { Segment } from "./segment.js";
import type { Style } from "./style.js";

export interface BoxChars {
  topLeft: string;
  top: string;
  topDivider: string;
  topRight: string;
  headLeft: string;
  headVertical: string;
  headRight: string;
  midLeft: string;
  mid: string;
  midVertical: string;
  midRight: string;
  bottomLeft: string;
  bottom: string;
  bottomDivider: string;
  bottomRight: string;
  left: string;
  right: string;
  vertical: string;
}

export type RowLevel = "head" | "row" | "foot" | "mid";

export interface SubstituteOptions {
  asciiOnly?: boolean;
  safe?: boolean;
}

// [LAW:one-type-per-behavior] Box is a single type for all border styles — instances differ by data
export class Box {
  readonly topLeft: string;
  readonly top: string;
  readonly topDivider: string;
  readonly topRight: string;
  readonly headLeft: string;
  readonly headVertical: string;
  readonly headRight: string;
  readonly midLeft: string;
  readonly mid: string;
  readonly midVertical: string;
  readonly midRight: string;
  readonly bottomLeft: string;
  readonly bottom: string;
  readonly bottomDivider: string;
  readonly bottomRight: string;
  readonly left: string;
  readonly right: string;
  readonly vertical: string;

  constructor(chars: BoxChars) {
    this.topLeft = chars.topLeft;
    this.top = chars.top;
    this.topDivider = chars.topDivider;
    this.topRight = chars.topRight;
    this.headLeft = chars.headLeft;
    this.headVertical = chars.headVertical;
    this.headRight = chars.headRight;
    this.midLeft = chars.midLeft;
    this.mid = chars.mid;
    this.midVertical = chars.midVertical;
    this.midRight = chars.midRight;
    this.bottomLeft = chars.bottomLeft;
    this.bottom = chars.bottom;
    this.bottomDivider = chars.bottomDivider;
    this.bottomRight = chars.bottomRight;
    this.left = chars.left;
    this.right = chars.right;
    this.vertical = chars.vertical;
  }

  /**
   * Renders the top border row for given column widths.
   */
  getTop(widths: number[], style?: Style, edge = true): Segment[] {
    const segments: Segment[] = [];
    if (edge) segments.push(new Segment(this.topLeft, style));
    for (let i = 0; i < widths.length; i++) {
      if (i > 0) segments.push(new Segment(this.topDivider, style));
      segments.push(new Segment(this.top.repeat(widths[i]!), style));
    }
    if (edge) segments.push(new Segment(this.topRight, style));
    segments.push(Segment.line());
    return segments;
  }

  /**
   * Renders a separator row.
   */
  getRow(
    widths: number[],
    level: RowLevel,
    style?: Style,
    edge = true,
  ): Segment[] {
    const [left, horizontal, cross, right] = this.getRowChars(level);
    const segments: Segment[] = [];
    if (edge) segments.push(new Segment(left, style));
    for (let i = 0; i < widths.length; i++) {
      if (i > 0) segments.push(new Segment(cross, style));
      segments.push(new Segment(horizontal.repeat(widths[i]!), style));
    }
    if (edge) segments.push(new Segment(right, style));
    segments.push(Segment.line());
    return segments;
  }

  /**
   * Renders the bottom border row.
   */
  getBottom(widths: number[], style?: Style, edge = true): Segment[] {
    const segments: Segment[] = [];
    if (edge) segments.push(new Segment(this.bottomLeft, style));
    for (let i = 0; i < widths.length; i++) {
      if (i > 0) segments.push(new Segment(this.bottomDivider, style));
      segments.push(new Segment(this.bottom.repeat(widths[i]!), style));
    }
    if (edge) segments.push(new Segment(this.bottomRight, style));
    segments.push(Segment.line());
    return segments;
  }

  /**
   * Returns a new Box with characters substituted for ASCII or safe alternatives.
   * asciiOnly: all characters become ASCII (+, -, |)
   * safe: problematic characters (e.g. rounded corners) replaced with square equivalents
   */
  substitute(options: SubstituteOptions = {}): Box {
    if (options.asciiOnly) return ASCII;
    if (options.safe) return this.safeSubstitute();
    return this;
  }

  private safeSubstitute(): Box {
    // Replace rounded corners and other characters that may not render
    // on Windows legacy terminal with safe square equivalents
    const replacements: Record<string, string> = {
      "╭": "┌",
      "╮": "┐",
      "╰": "└",
      "╯": "┘",
    };
    const replace = (ch: string): string => replacements[ch] ?? ch;
    return new Box({
      topLeft: replace(this.topLeft),
      top: replace(this.top),
      topDivider: replace(this.topDivider),
      topRight: replace(this.topRight),
      headLeft: replace(this.headLeft),
      headVertical: replace(this.headVertical),
      headRight: replace(this.headRight),
      midLeft: replace(this.midLeft),
      mid: replace(this.mid),
      midVertical: replace(this.midVertical),
      midRight: replace(this.midRight),
      bottomLeft: replace(this.bottomLeft),
      bottom: replace(this.bottom),
      bottomDivider: replace(this.bottomDivider),
      bottomRight: replace(this.bottomRight),
      left: replace(this.left),
      right: replace(this.right),
      vertical: replace(this.vertical),
    });
  }

  private getRowChars(
    level: RowLevel,
  ): [string, string, string, string] {
    switch (level) {
      case "head":
        return [this.headLeft, this.mid, this.headVertical, this.headRight];
      case "row":
        return [this.midLeft, this.mid, this.midVertical, this.midRight];
      case "mid":
        return [this.midLeft, this.mid, this.midVertical, this.midRight];
      case "foot":
        return [this.midLeft, this.mid, this.midVertical, this.midRight];
    }
  }
}

// --- Pre-built box styles ---

export const ASCII = new Box({
  topLeft: "+",
  top: "-",
  topDivider: "+",
  topRight: "+",
  headLeft: "|",
  headVertical: "|",
  headRight: "|",
  midLeft: "|",
  mid: "-",
  midVertical: "+",
  midRight: "|",
  bottomLeft: "+",
  bottom: "-",
  bottomDivider: "+",
  bottomRight: "+",
  left: "|",
  right: "|",
  vertical: "|",
});

export const ASCII2 = new Box({
  topLeft: "+",
  top: "-",
  topDivider: "+",
  topRight: "+",
  headLeft: "|",
  headVertical: "|",
  headRight: "|",
  midLeft: "+",
  mid: "-",
  midVertical: "+",
  midRight: "+",
  bottomLeft: "+",
  bottom: "-",
  bottomDivider: "+",
  bottomRight: "+",
  left: "|",
  right: "|",
  vertical: "|",
});

export const ASCII_DOUBLE_HEAD = new Box({
  topLeft: "+",
  top: "-",
  topDivider: "+",
  topRight: "+",
  headLeft: "|",
  headVertical: "|",
  headRight: "|",
  midLeft: "+",
  mid: "=",
  midVertical: "+",
  midRight: "+",
  bottomLeft: "+",
  bottom: "-",
  bottomDivider: "+",
  bottomRight: "+",
  left: "|",
  right: "|",
  vertical: "|",
});

export const SQUARE = new Box({
  topLeft: "┌",
  top: "─",
  topDivider: "┬",
  topRight: "┐",
  headLeft: "│",
  headVertical: "│",
  headRight: "│",
  midLeft: "├",
  mid: "─",
  midVertical: "┼",
  midRight: "┤",
  bottomLeft: "└",
  bottom: "─",
  bottomDivider: "┴",
  bottomRight: "┘",
  left: "│",
  right: "│",
  vertical: "│",
});

export const SQUARE_DOUBLE_HEAD = new Box({
  topLeft: "┌",
  top: "─",
  topDivider: "┬",
  topRight: "┐",
  headLeft: "│",
  headVertical: "│",
  headRight: "│",
  midLeft: "╞",
  mid: "═",
  midVertical: "╪",
  midRight: "╡",
  bottomLeft: "└",
  bottom: "─",
  bottomDivider: "┴",
  bottomRight: "┘",
  left: "│",
  right: "│",
  vertical: "│",
});

export const MINIMAL = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "─",
  midVertical: "─",
  midRight: " ",
  bottomLeft: " ",
  bottom: " ",
  bottomDivider: " ",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const MINIMAL_HEAVY_HEAD = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "━",
  midVertical: "━",
  midRight: " ",
  bottomLeft: " ",
  bottom: " ",
  bottomDivider: " ",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const MINIMAL_DOUBLE_HEAD = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "═",
  midVertical: "═",
  midRight: " ",
  bottomLeft: " ",
  bottom: " ",
  bottomDivider: " ",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const SIMPLE = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "─",
  midVertical: " ",
  midRight: " ",
  bottomLeft: " ",
  bottom: "─",
  bottomDivider: " ",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const SIMPLE_HEAD = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "─",
  midVertical: " ",
  midRight: " ",
  bottomLeft: " ",
  bottom: " ",
  bottomDivider: " ",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const SIMPLE_HEAVY = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "━",
  midVertical: " ",
  midRight: " ",
  bottomLeft: " ",
  bottom: "━",
  bottomDivider: " ",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const HORIZONTALS = new Box({
  topLeft: " ",
  top: "─",
  topDivider: "─",
  topRight: " ",
  headLeft: " ",
  headVertical: " ",
  headRight: " ",
  midLeft: " ",
  mid: "─",
  midVertical: "─",
  midRight: " ",
  bottomLeft: " ",
  bottom: "─",
  bottomDivider: "─",
  bottomRight: " ",
  left: " ",
  right: " ",
  vertical: " ",
});

export const ROUNDED = new Box({
  topLeft: "╭",
  top: "─",
  topDivider: "┬",
  topRight: "╮",
  headLeft: "│",
  headVertical: "│",
  headRight: "│",
  midLeft: "├",
  mid: "─",
  midVertical: "┼",
  midRight: "┤",
  bottomLeft: "╰",
  bottom: "─",
  bottomDivider: "┴",
  bottomRight: "╯",
  left: "│",
  right: "│",
  vertical: "│",
});

export const HEAVY = new Box({
  topLeft: "┏",
  top: "━",
  topDivider: "┳",
  topRight: "┓",
  headLeft: "┃",
  headVertical: "┃",
  headRight: "┃",
  midLeft: "┣",
  mid: "━",
  midVertical: "╋",
  midRight: "┫",
  bottomLeft: "┗",
  bottom: "━",
  bottomDivider: "┻",
  bottomRight: "┛",
  left: "┃",
  right: "┃",
  vertical: "┃",
});

export const HEAVY_EDGE = new Box({
  topLeft: "┏",
  top: "━",
  topDivider: "┯",
  topRight: "┓",
  headLeft: "┃",
  headVertical: "│",
  headRight: "┃",
  midLeft: "┠",
  mid: "─",
  midVertical: "┼",
  midRight: "┨",
  bottomLeft: "┗",
  bottom: "━",
  bottomDivider: "┷",
  bottomRight: "┛",
  left: "┃",
  right: "┃",
  vertical: "│",
});

export const HEAVY_HEAD = new Box({
  topLeft: "┏",
  top: "━",
  topDivider: "┳",
  topRight: "┓",
  headLeft: "┃",
  headVertical: "┃",
  headRight: "┃",
  midLeft: "┡",
  mid: "━",
  midVertical: "╇",
  midRight: "┩",
  bottomLeft: "└",
  bottom: "─",
  bottomDivider: "┴",
  bottomRight: "┘",
  left: "│",
  right: "│",
  vertical: "│",
});

export const DOUBLE = new Box({
  topLeft: "╔",
  top: "═",
  topDivider: "╦",
  topRight: "╗",
  headLeft: "║",
  headVertical: "║",
  headRight: "║",
  midLeft: "╠",
  mid: "═",
  midVertical: "╬",
  midRight: "╣",
  bottomLeft: "╚",
  bottom: "═",
  bottomDivider: "╩",
  bottomRight: "╝",
  left: "║",
  right: "║",
  vertical: "║",
});

export const DOUBLE_EDGE = new Box({
  topLeft: "╔",
  top: "═",
  topDivider: "╤",
  topRight: "╗",
  headLeft: "║",
  headVertical: "│",
  headRight: "║",
  midLeft: "╟",
  mid: "─",
  midVertical: "┼",
  midRight: "╢",
  bottomLeft: "╚",
  bottom: "═",
  bottomDivider: "╧",
  bottomRight: "╝",
  left: "║",
  right: "║",
  vertical: "│",
});

export const MARKDOWN = new Box({
  topLeft: " ",
  top: " ",
  topDivider: " ",
  topRight: " ",
  headLeft: "|",
  headVertical: "|",
  headRight: "|",
  midLeft: "|",
  mid: "-",
  midVertical: "|",
  midRight: "|",
  bottomLeft: " ",
  bottom: " ",
  bottomDivider: " ",
  bottomRight: " ",
  left: "|",
  right: "|",
  vertical: "|",
});
