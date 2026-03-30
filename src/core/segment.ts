/**
 * Segment — the atomic rendering unit. Every piece of styled terminal output
 * is represented as a Segment: (text, style?, control?).
 */

import { cellLen, splitText } from "./cells.js";
import { Style } from "./style.js";

// --- ControlType ---

export enum ControlType {
  BELL = "bell",
  CARRIAGE_RETURN = "carriage_return",
  HOME = "home",
  CLEAR = "clear",
  SHOW_CURSOR = "show_cursor",
  HIDE_CURSOR = "hide_cursor",
  ENABLE_ALT_SCREEN = "enable_alt_screen",
  DISABLE_ALT_SCREEN = "disable_alt_screen",
  CURSOR_UP = "cursor_up",
  CURSOR_DOWN = "cursor_down",
  CURSOR_FORWARD = "cursor_forward",
  CURSOR_BACKWARD = "cursor_backward",
  CURSOR_MOVE_TO_COLUMN = "cursor_move_to_column",
  CURSOR_MOVE_TO = "cursor_move_to",
  ERASE_IN_LINE = "erase_in_line",
  SET_WINDOW_TITLE = "set_window_title",
}

export type ControlCode = [ControlType, ...unknown[]];

// --- Segment ---

export class Segment {
  readonly text: string;
  readonly style: Style | undefined;
  readonly control: ControlCode[] | undefined;

  constructor(
    text: string,
    style?: Style,
    control?: ControlCode[],
  ) {
    this.text = text;
    this.style = style;
    this.control = control;
  }

  get cellLength(): number {
    return this.control ? 0 : cellLen(this.text);
  }

  get hasText(): boolean {
    return this.text.length > 0;
  }

  get isControl(): boolean {
    return this.control !== undefined;
  }

  /**
   * Splits at a cell position. Returns [left, right].
   */
  splitCells(position: number): [Segment, Segment] {
    const len = this.cellLength;
    if (position >= len) return [this, new Segment("")];
    if (position <= 0) return [new Segment(""), this];
    const [leftText, rightText] = splitText(this.text, position);
    return [
      new Segment(leftText, this.style),
      new Segment(rightText, this.style),
    ];
  }

  // --- Static factories ---

  private static _line: Segment | undefined;
  static line(): Segment {
    return (Segment._line ??= new Segment("\n"));
  }

  // --- Static transformations ---

  /**
   * Yields segments with combined styles.
   */
  static *applyStyle(
    segments: Iterable<Segment>,
    style?: Style,
    postStyle?: Style,
  ): Iterable<Segment> {
    for (const segment of segments) {
      if (segment.isControl) {
        yield segment;
        continue;
      }
      let s = segment.style;
      if (style) s = style.add(s);
      if (postStyle) s = s ? s.add(postStyle) : postStyle;
      yield new Segment(segment.text, s, segment.control);
    }
  }

  /**
   * Filters segments by control status.
   */
  static *filterControl(
    segments: Iterable<Segment>,
    isControl: boolean,
  ): Iterable<Segment> {
    for (const segment of segments) {
      if (segment.isControl === isControl) yield segment;
    }
  }

  /**
   * Splits segments at newlines. Yields arrays of segments per line.
   */
  static splitLines(segments: Iterable<Segment>): Segment[][] {
    const lines: Segment[][] = [];
    let currentLine: Segment[] = [];

    for (const segment of segments) {
      if (segment.isControl) {
        currentLine.push(segment);
        continue;
      }

      const text = segment.text;
      if (!text.includes("\n")) {
        currentLine.push(segment);
        continue;
      }

      const parts = text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push(currentLine);
          currentLine = [];
        }
        const part = parts[i]!;
        if (part.length > 0) {
          currentLine.push(new Segment(part, segment.style));
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Adjusts a line of segments to exactly `width` cells.
   */
  static adjustLineLength(
    line: Segment[],
    width: number,
    style?: Style,
    pad = true,
  ): Segment[] {
    const currentWidth = Segment.getLineLength(line);
    if (currentWidth === width) return line;

    if (currentWidth < width) {
      if (!pad) return line;
      return [...line, new Segment(" ".repeat(width - currentWidth), style)];
    }

    // Crop to width
    const result: Segment[] = [];
    let remaining = width;
    for (const segment of line) {
      if (segment.isControl) {
        result.push(segment);
        continue;
      }
      const segWidth = segment.cellLength;
      if (segWidth <= remaining) {
        result.push(segment);
        remaining -= segWidth;
      } else {
        const [left] = segment.splitCells(remaining);
        result.push(left);
        remaining = 0;
        break;
      }
    }
    return result;
  }

  /**
   * Returns total cell width of a line. Ignores control segments.
   */
  static getLineLength(line: Segment[]): number {
    let width = 0;
    for (const segment of line) {
      if (!segment.isControl) {
        width += segment.cellLength;
      }
    }
    return width;
  }

  /**
   * Returns [width, height] of a set of lines.
   */
  static getShape(lines: Segment[][]): [number, number] {
    if (lines.length === 0) return [0, 0];
    let maxWidth = 0;
    for (const line of lines) {
      const w = Segment.getLineLength(line);
      if (w > maxWidth) maxWidth = w;
    }
    return [maxWidth, lines.length];
  }

  /**
   * Merges contiguous segments with the same style.
   */
  static *simplify(segments: Iterable<Segment>): Iterable<Segment> {
    let pending: Segment | undefined;

    for (const segment of segments) {
      if (!pending) {
        pending = segment;
        continue;
      }
      if (stylesEqual(pending.style, segment.style) && !segment.isControl && !pending.isControl) {
        pending = new Segment(pending.text + segment.text, pending.style);
      } else {
        yield pending;
        pending = segment;
      }
    }
    if (pending) yield pending;
  }

  /**
   * Yields segments with links removed.
   */
  static *stripLinks(segments: Iterable<Segment>): Iterable<Segment> {
    for (const segment of segments) {
      if (segment.style?.link) {
        yield new Segment(segment.text, segment.style.clearMetaAndLinks(), segment.control);
      } else {
        yield segment;
      }
    }
  }

  /**
   * Yields segments with all styles removed.
   */
  static *stripStyles(segments: Iterable<Segment>): Iterable<Segment> {
    for (const segment of segments) {
      yield new Segment(segment.text, undefined, segment.control);
    }
  }

  /**
   * Yields segments with colors removed but attributes preserved.
   */
  static *removeColor(segments: Iterable<Segment>): Iterable<Segment> {
    for (const segment of segments) {
      if (segment.style) {
        yield new Segment(segment.text, segment.style.withoutColor, segment.control);
      } else {
        yield segment;
      }
    }
  }

  /**
   * Divides segments at cell positions. Yields arrays of segments for each section.
   */
  static divide(
    segments: Segment[],
    cuts: number[],
  ): Segment[][] {
    if (cuts.length === 0) return [segments];

    const result: Segment[][] = [];
    let segmentIndex = 0;
    let cellOffset = 0;
    let currentSegment = segments[segmentIndex];

    for (const cut of cuts) {
      const section: Segment[] = [];

      while (currentSegment && cellOffset + currentSegment.cellLength <= cut) {
        if (currentSegment.isControl) {
          section.push(currentSegment);
        } else {
          section.push(currentSegment);
          cellOffset += currentSegment.cellLength;
        }
        segmentIndex++;
        currentSegment = segments[segmentIndex];
      }

      if (currentSegment && !currentSegment.isControl && cellOffset < cut) {
        const splitAt = cut - cellOffset;
        const [left, right] = currentSegment.splitCells(splitAt);
        if (left.hasText) section.push(left);
        cellOffset += left.cellLength;
        currentSegment = right;
      }

      result.push(section);
    }

    // Remaining segments
    const tail: Segment[] = [];
    if (currentSegment?.hasText) tail.push(currentSegment);
    segmentIndex++;
    while (segmentIndex < segments.length) {
      tail.push(segments[segmentIndex]!);
      segmentIndex++;
    }
    if (tail.length > 0) result.push(tail);

    return result;
  }

  // --- Layout helpers ---

  /**
   * Pads below to fill height.
   */
  static alignTop(
    lines: Segment[][],
    width: number,
    height: number,
    style: Style,
  ): Segment[][] {
    const result = lines.map((line) =>
      Segment.adjustLineLength(line, width, style),
    );
    const blankLine = [new Segment(" ".repeat(width), style)];
    while (result.length < height) {
      result.push([...blankLine]);
    }
    return result.slice(0, height);
  }

  /**
   * Pads above to fill height. Content at bottom.
   */
  static alignBottom(
    lines: Segment[][],
    width: number,
    height: number,
    style: Style,
  ): Segment[][] {
    const adjusted = lines.map((line) =>
      Segment.adjustLineLength(line, width, style),
    );
    const blankLine = [new Segment(" ".repeat(width), style)];
    const padCount = Math.max(0, height - adjusted.length);
    const result: Segment[][] = [];
    for (let i = 0; i < padCount; i++) {
      result.push([...blankLine]);
    }
    result.push(...adjusted);
    return result.slice(0, height);
  }

  /**
   * Pads above and below. Content in middle.
   */
  static alignMiddle(
    lines: Segment[][],
    width: number,
    height: number,
    style: Style,
  ): Segment[][] {
    const adjusted = lines.map((line) =>
      Segment.adjustLineLength(line, width, style),
    );
    const blankLine = [new Segment(" ".repeat(width), style)];
    const padAbove = Math.max(0, Math.floor((height - adjusted.length) / 2));
    const result: Segment[][] = [];
    for (let i = 0; i < padAbove; i++) {
      result.push([...blankLine]);
    }
    result.push(...adjusted);
    while (result.length < height) {
      result.push([...blankLine]);
    }
    return result.slice(0, height);
  }

  /**
   * Forces lines to exactly width x height.
   */
  static setShape(
    lines: Segment[][],
    width: number,
    height: number,
    style?: Style,
  ): Segment[][] {
    const result = lines.map((line) =>
      Segment.adjustLineLength(line, width, style),
    );
    const blankLine = [new Segment(" ".repeat(width), style)];
    while (result.length < height) {
      result.push([...blankLine]);
    }
    return result.slice(0, height);
  }

  /**
   * Splits segments into lines and adjusts each to exactly `width` cells.
   */
  static splitAndCropLines(
    segments: Iterable<Segment>,
    width: number,
    pad = true,
    includeNewLines = false,
    style?: Style,
  ): Segment[][] {
    const rawLines = Segment.splitLines(segments);
    const result: Segment[][] = [];

    for (const line of rawLines) {
      const adjusted = Segment.adjustLineLength(line, width, style, pad);
      result.push(adjusted);
      if (includeNewLines) {
        result[result.length - 1]!.push(Segment.line());
      }
    }

    return result;
  }
}

// --- Internal helpers ---

function stylesEqual(a: Style | undefined, b: Style | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.equals(b);
}
