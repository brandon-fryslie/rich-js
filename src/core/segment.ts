/**
 * Segment — the atomic rendering unit. Every piece of styled terminal output
 * is represented as a Segment: (text, style?, control?).
 */

import { cellLen, splitText, asCellCol, type CellCol } from "./cells.js";
import { Style } from "./style.js";
import { shiftAnchor, type Anchor } from "./anchor.js";

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
   * Splits at a cell position. Returns [left, right]: the first `position`
   * cells and the rest, so the two halves are exactly as wide as this one.
   * A wide glyph the cut goes through leaves a space in each of its two cells,
   * as the reference's `Segment.split_cells` does — kept whole on either side,
   * it would make that side a cell wider than the cells it stands for.
   *
   * [LAW:single-enforcer] The right half starts `position` cells further into
   * whatever drew it, and its anchor says so; see `./anchor.ts`.
   */
  splitCells(position: CellCol): [Segment, Segment] {
    const len = this.cellLength;
    if (position >= len) return [this, new Segment("")];
    if (position <= 0) return [new Segment(""), this];
    // `splitText` pads the left half and keeps a cut glyph whole on the right,
    // so `rest` overhangs the cut by the one cell of that glyph left of it.
    const [leftText, rest] = splitText(this.text, position);
    const overhang = cellLen(rest) - (len - position);
    const rightText = " ".repeat(overhang) + [...rest].slice(overhang).join("");
    return [
      new Segment(leftText, this.style),
      new Segment(rightText, this.style?.shiftedBy(position)),
    ];
  }

  // --- Static factories ---

  private static _line: Segment | undefined;
  static line(): Segment {
    return (Segment._line ??= new Segment("\n"));
  }

  // --- Static transformations ---

  /**
   * `lines`, as drawn by `owner`: every segment stamped with the row and
   * column of its first cell, wrapping whatever anchor it already carried.
   * Control segments occupy no cell and are left as they are. `firstRow` is
   * the owner's row that `lines[0]` is, for output that arrives in pieces.
   */
  static anchorLines(lines: Segment[][], owner: object, firstRow = 0): Segment[][] {
    return lines.map((line, i) => {
      const row = firstRow + i;
      let col = 0;
      return line.map((segment) => {
        if (segment.isControl) return segment;
        const style = segment.style ?? Style.null();
        const anchored = new Segment(
          segment.text,
          style.withAnchor({ owner, row, col, inner: style.anchor }),
        );
        col += segment.cellLength;
        return anchored;
      });
    });
  }

  /**
   * The anchor of the cell at column `x` of row `y` in a composed frame, or
   * `undefined` when that cell was drawn by no owner or lies outside the frame.
   */
  static anchorAt(
    lines: readonly (readonly Segment[])[],
    x: number,
    y: number,
  ): Anchor | undefined {
    if (!Number.isInteger(x) || x < 0) return undefined;
    let start = 0;
    for (const segment of lines[y] ?? []) {
      const end = start + segment.cellLength;
      if (x < end) {
        const anchor = segment.style?.anchor;
        return anchor && shiftAnchor(anchor, x - start);
      }
      start = end;
    }
    return undefined;
  }

  /**
   * Yields segments with combined styles.
   */
  static *applyStyle(
    segments: Iterable<Segment>,
    style?: Style,
    postStyle?: Style,
  ): Iterable<Segment> {
    // Applying no style is the identity, so the segments pass through as they
    // are instead of each being copied into an equal one.
    if (!style && !postStyle) {
      yield* segments;
      return;
    }
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
        const [left] = segment.splitCells(asCellCol(remaining));
        result.push(left);
        remaining = 0;
        break;
      }
    }
    return result;
  }

  // --- Bounding output to a width ---
  //
  // Two primitives, because containers ask two different questions of content.
  //
  // `cropLines` — *keep the structure, bound it*. The container needs no line
  // to overrun and must not pad: a `Layout` leaf and the console's crop pass
  // the stream on as it is; a `Tree` label splits the cropped stream itself to
  // hang its guides on each row. The crop never decides how many lines there
  // are — whoever splits after it owns that.
  //
  // `splitAndCropLines` — *decompose into rows of exactly this width*. The
  // container goes on to compose the rows (a `Table` cell zipped beside its
  // neighbours), so it needs the two-dimensional shape and every row full.
  //
  // The split decides how many lines there are, so it is wrong for the first
  // question; `cropLines`' header records the two times it was tried there.

  /**
   * Crops a renderable's output so no line exceeds `width`, leaving short lines
   * alone and the line structure exactly as it arrived.
   *
   * [LAW:single-enforcer] `adjustLineLength` is where a width is enforced, but
   * it takes one line and a container holding arbitrary content has a stream of
   * them. Without this step the container has to trust content to honour the
   * offer, and content that ignores it overflows the region — which is how a
   * `Layout` leaf and a `Tree` label came to emit forty cells into a one-cell
   * offer while `Panel` and `Padding`, which split and adjust, did not.
   *
   * One segment in, one segment out, shortening text and nothing else — so the
   * line structure that arrives is the line structure that leaves. Two earlier
   * shapes of this both decided how many lines there were and both were wrong:
   * built on `splitLines`, which cannot tell `"abc"` from `"abc\n"`, it invented
   * a trailing newline and dropped the row of an empty `Tree` label entirely,
   * running its guides into the next row; rebuilt to accumulate lines, it
   * dropped the zero-width-but-present line `RichText` emits at an offer of 0,
   * and a row split rendered nothing at all. A crop shortens; it does not count.
   *
   * A wide glyph the edge cuts through leaves a space in the cell it would have
   * half-filled, so a cropped line still reaches the edge — the reference's
   * `set_cell_size`, which `splitText` already is. An unbounded `width` crops
   * nothing, and a segment the crop did not change leaves as itself.
   */
  static *cropLines(segments: Iterable<Segment>, width: number): Iterable<Segment> {
    const cap = Math.max(0, width);
    let used = 0;
    for (const segment of segments) {
      if (segment.isControl) {
        yield segment;
        continue;
      }
      const parts = segment.text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) used = 0;
        const [piece] = splitText(parts[i]!, asCellCol(cap - used));
        used += cellLen(piece);
        parts[i] = piece;
      }
      const cropped = parts.join("\n");
      yield cropped === segment.text ? segment : new Segment(cropped, segment.style);
    }
  }

  /**
   * Splits a renderable's output into rows, each exactly `width` cells:
   * short rows padded with spaces, long ones cut.
   */
  static splitAndCropLines(segments: Iterable<Segment>, width: number): Segment[][] {
    return Segment.splitLines(segments).map((line) => Segment.adjustLineLength(line, width));
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
   * Composes cells side by side into full lines. Each cell contributes its
   * own lines cropped/padded to its declared width; a cell shorter than the
   * tallest is filled with blank space so the grid stays aligned. Adjacent
   * cells are separated by a gutter of spaces, and each merged row ends with a
   * line break. This is the single side-by-side merge used by every horizontal
   * layout (Columns grid rows, Layout row splits).
   */
  static *mergeHorizontal(
    cells: readonly { readonly lines: Segment[][]; readonly width: number }[],
    gutter = 0,
  ): Iterable<Segment> {
    let height = 0;
    for (const cell of cells) {
      if (cell.lines.length > height) height = cell.lines.length;
    }
    const gap = gutter > 0 ? [new Segment(" ".repeat(gutter))] : [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < cells.length; col++) {
        if (col > 0) yield* gap;
        const cell = cells[col]!;
        yield* Segment.adjustLineLength(cell.lines[row] ?? [], cell.width);
      }
      yield Segment.line();
    }
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
        section.push(currentSegment);
        cellOffset += currentSegment.cellLength;
        segmentIndex++;
        currentSegment = segments[segmentIndex];
      }

      if (currentSegment && !currentSegment.isControl && cellOffset < cut) {
        const splitAt = asCellCol(cut - cellOffset);
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
}

// --- Internal helpers ---

function stylesEqual(a: Style | undefined, b: Style | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.equals(b);
}
