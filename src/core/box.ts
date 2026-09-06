/**
 * Box-drawing character sets for borders and table grids.
 *
 * A style is declared as an 8x4 character grid — one line per row a table can
 * draw, one column per position within that row:
 *
 *     ┌─┬┐   top border
 *     │ ││   header content
 *     ├─┼┤   header separator
 *     │ ││   body content
 *     ├─┼┤   row separator
 *     ├─┼┤   footer separator
 *     │ ││   footer content
 *     └─┴┘   bottom border
 *
 * [LAW:one-source-of-truth] The grid is the shape the reference implementation
 * (Python Rich's `box.py`) publishes these glyphs in, so a constant below can
 * be diffed against it character for character. The eighteen named fields this
 * replaced were a second, differently-shaped map of the same territory, and it
 * had drifted: seven of the nineteen constants carried wrong glyphs, and the
 * field named `mid` held the reference's line 3 while the reference's `mid_*`
 * is line 4 — so reading the reference name-for-name swapped a separator for a
 * content row. Named row fields are gone for that reason; a row is reached by
 * what it is (`getRow`, `getContentChars`), never by a name that can be
 * mismatched to a line.
 */

import { cellLen } from "./cells.js";
import { Segment } from "./segment.js";
import type { Style } from "./style.js";

/** A rule spanning the table: the top and bottom borders, and every separator. */
export interface EdgeChars {
  left: string;
  horizontal: string;
  cross: string;
  right: string;
}

/**
 * The verticals framing a row of cells. A content line of the grid has no
 * horizontal of its own — its fill column is a placeholder the cells occupy.
 */
export interface ContentChars {
  left: string;
  vertical: string;
  right: string;
}

export type RowLevel = "head" | "row" | "foot" | "mid";

export interface SubstituteOptions {
  asciiOnly?: boolean;
  safe?: boolean;
}

const GRID_ROWS = 8;
const GRID_COLUMNS = 4;

/** Corners that a legacy Windows terminal cannot draw, and their square kin. */
const SAFE_SUBSTITUTIONS: Record<string, string> = {
  "╭": "┌",
  "╮": "┐",
  "╰": "└",
  "╯": "┘",
};

const edgeOf = (row: readonly string[]): EdgeChars => ({
  left: row[0]!,
  horizontal: row[1]!,
  cross: row[2]!,
  right: row[3]!,
});

const contentOf = (row: readonly string[]): ContentChars => ({
  left: row[0]!,
  vertical: row[2]!,
  right: row[3]!,
});

// [LAW:one-type-per-behavior] Box is a single type for all border styles — instances differ by data
export class Box {
  readonly top: EdgeChars;
  readonly bottom: EdgeChars;

  private readonly grid: string;
  private readonly headContent: ContentChars;
  private readonly headSeparator: EdgeChars;
  private readonly bodyContent: ContentChars;
  private readonly rowSeparator: EdgeChars;
  private readonly footSeparator: EdgeChars;
  private readonly footContent: ContentChars;

  /**
   * [LAW:parse-dont-validate] The one crossing between a grid string and box
   * glyphs. A `Box` cannot exist without eight rows of four characters, so no
   * consumer below ever re-checks the shape of the data it reads.
   */
  constructor(grid: string) {
    const lines = grid.split("\n");
    // A row is four characters because `getEdge` indexes the four positions,
    // and four cells because that is what the terminal draws — a single astral
    // glyph satisfies the first and breaks every frame the box appears in.
    // [LAW:single-enforcer] `cellLen` is the cell-width authority.
    const malformed = lines.length !== GRID_ROWS
      || lines.some((line) => Array.from(line).length !== GRID_COLUMNS)
      || lines.some((line) => cellLen(line) !== GRID_COLUMNS);
    if (malformed) {
      throw new Error(
        `A box grid is ${GRID_ROWS} lines of ${GRID_COLUMNS} single-cell `
        + `characters; got ${lines.length} line(s) measuring `
        + lines.map((line) => `${Array.from(line).length}/${cellLen(line)}`).join(", ")
        + " characters/cells",
      );
    }
    const rows = lines.map((line) => Array.from(line));

    this.grid = grid;
    this.top = edgeOf(rows[0]!);
    this.headContent = contentOf(rows[1]!);
    this.headSeparator = edgeOf(rows[2]!);
    this.bodyContent = contentOf(rows[3]!);
    this.rowSeparator = edgeOf(rows[4]!);
    this.footSeparator = edgeOf(rows[5]!);
    this.footContent = contentOf(rows[6]!);
    this.bottom = edgeOf(rows[7]!);
  }

  /**
   * Renders the top border row for given column widths.
   */
  getTop(widths: readonly number[], style?: Style, edge = true): Segment[] {
    return this.getEdge(widths, this.top, style, edge);
  }

  /**
   * Renders the separator drawn *above* a row at `level` — the head separator
   * under the header, the row separator between body rows, the foot separator
   * above the footer.
   */
  getRow(
    widths: readonly number[],
    level: RowLevel,
    style?: Style,
    edge = true,
  ): Segment[] {
    return this.getEdge(widths, this.getRowChars(level), style, edge);
  }

  /**
   * The verticals that frame a content row at `level` — the counterpart to
   * `getRow`, which draws the separator between two such rows.
   */
  getContentChars(level: RowLevel): ContentChars {
    switch (level) {
      case "head":
        return this.headContent;
      // `mid` is a spacer between body rows, so it is framed as one.
      case "row":
      case "mid":
        return this.bodyContent;
      case "foot":
        return this.footContent;
    }
  }

  /**
   * Renders the bottom border row.
   */
  getBottom(widths: readonly number[], style?: Style, edge = true): Segment[] {
    return this.getEdge(widths, this.bottom, style, edge);
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
    return new Box(
      Array.from(this.grid, (char) => SAFE_SUBSTITUTIONS[char] ?? char).join(""),
    );
  }

  /**
   * [LAW:dataflow-not-control-flow] Every full-width rule the box can draw is
   * this one loop; which rule it is arrives as four characters, not a branch.
   */
  private getEdge(
    widths: readonly number[],
    chars: EdgeChars,
    style: Style | undefined,
    edge: boolean,
  ): Segment[] {
    const segments: Segment[] = [];
    if (edge) segments.push(new Segment(chars.left, style));
    for (let i = 0; i < widths.length; i++) {
      if (i > 0) segments.push(new Segment(chars.cross, style));
      segments.push(new Segment(chars.horizontal.repeat(widths[i]!), style));
    }
    if (edge) segments.push(new Segment(chars.right, style));
    segments.push(Segment.line());
    return segments;
  }

  private getRowChars(level: RowLevel): EdgeChars {
    switch (level) {
      case "head":
        return this.headSeparator;
      case "row":
        return this.rowSeparator;
      case "foot":
        return this.footSeparator;
      // A blank section divider rather than a rule: `leading` puts empty lines
      // between rows, and they carry the body row's verticals and nothing else.
      case "mid":
        return {
          left: this.bodyContent.left,
          horizontal: " ",
          cross: this.bodyContent.vertical,
          right: this.bodyContent.right,
        };
    }
  }
}

// --- Pre-built box styles ---
// Transcribed from Python Rich's `rich/box.py` and verified grid-for-grid
// against it; see this module's header for the shape and why it is this shape.

export const ASCII = new Box(
  "+--+\n" +
  "| ||\n" +
  "|-+|\n" +
  "| ||\n" +
  "|-+|\n" +
  "|-+|\n" +
  "| ||\n" +
  "+--+",
);

export const ASCII2 = new Box(
  "+-++\n" +
  "| ||\n" +
  "+-++\n" +
  "| ||\n" +
  "+-++\n" +
  "+-++\n" +
  "| ||\n" +
  "+-++",
);

export const ASCII_DOUBLE_HEAD = new Box(
  "+-++\n" +
  "| ||\n" +
  "+=++\n" +
  "| ||\n" +
  "+-++\n" +
  "+-++\n" +
  "| ||\n" +
  "+-++",
);

export const SQUARE = new Box(
  "┌─┬┐\n" +
  "│ ││\n" +
  "├─┼┤\n" +
  "│ ││\n" +
  "├─┼┤\n" +
  "├─┼┤\n" +
  "│ ││\n" +
  "└─┴┘",
);

export const SQUARE_DOUBLE_HEAD = new Box(
  "┌─┬┐\n" +
  "│ ││\n" +
  "╞═╪╡\n" +
  "│ ││\n" +
  "├─┼┤\n" +
  "├─┼┤\n" +
  "│ ││\n" +
  "└─┴┘",
);

export const MINIMAL = new Box(
  "  ╷ \n" +
  "  │ \n" +
  "╶─┼╴\n" +
  "  │ \n" +
  "╶─┼╴\n" +
  "╶─┼╴\n" +
  "  │ \n" +
  "  ╵ ",
);

export const MINIMAL_HEAVY_HEAD = new Box(
  "  ╷ \n" +
  "  │ \n" +
  "╺━┿╸\n" +
  "  │ \n" +
  "╶─┼╴\n" +
  "╶─┼╴\n" +
  "  │ \n" +
  "  ╵ ",
);

export const MINIMAL_DOUBLE_HEAD = new Box(
  "  ╷ \n" +
  "  │ \n" +
  " ═╪ \n" +
  "  │ \n" +
  " ─┼ \n" +
  " ─┼ \n" +
  "  │ \n" +
  "  ╵ ",
);

export const SIMPLE = new Box(
  "    \n" +
  "    \n" +
  " ── \n" +
  "    \n" +
  "    \n" +
  " ── \n" +
  "    \n" +
  "    ",
);

export const SIMPLE_HEAD = new Box(
  "    \n" +
  "    \n" +
  " ── \n" +
  "    \n" +
  "    \n" +
  "    \n" +
  "    \n" +
  "    ",
);

export const SIMPLE_HEAVY = new Box(
  "    \n" +
  "    \n" +
  " ━━ \n" +
  "    \n" +
  "    \n" +
  " ━━ \n" +
  "    \n" +
  "    ",
);

export const HORIZONTALS = new Box(
  " ── \n" +
  "    \n" +
  " ── \n" +
  "    \n" +
  " ── \n" +
  " ── \n" +
  "    \n" +
  " ── ",
);

export const ROUNDED = new Box(
  "╭─┬╮\n" +
  "│ ││\n" +
  "├─┼┤\n" +
  "│ ││\n" +
  "├─┼┤\n" +
  "├─┼┤\n" +
  "│ ││\n" +
  "╰─┴╯",
);

export const HEAVY = new Box(
  "┏━┳┓\n" +
  "┃ ┃┃\n" +
  "┣━╋┫\n" +
  "┃ ┃┃\n" +
  "┣━╋┫\n" +
  "┣━╋┫\n" +
  "┃ ┃┃\n" +
  "┗━┻┛",
);

export const HEAVY_EDGE = new Box(
  "┏━┯┓\n" +
  "┃ │┃\n" +
  "┠─┼┨\n" +
  "┃ │┃\n" +
  "┠─┼┨\n" +
  "┠─┼┨\n" +
  "┃ │┃\n" +
  "┗━┷┛",
);

export const HEAVY_HEAD = new Box(
  "┏━┳┓\n" +
  "┃ ┃┃\n" +
  "┡━╇┩\n" +
  "│ ││\n" +
  "├─┼┤\n" +
  "├─┼┤\n" +
  "│ ││\n" +
  "└─┴┘",
);

export const DOUBLE = new Box(
  "╔═╦╗\n" +
  "║ ║║\n" +
  "╠═╬╣\n" +
  "║ ║║\n" +
  "╠═╬╣\n" +
  "╠═╬╣\n" +
  "║ ║║\n" +
  "╚═╩╝",
);

export const DOUBLE_EDGE = new Box(
  "╔═╤╗\n" +
  "║ │║\n" +
  "╟─┼╢\n" +
  "║ │║\n" +
  "╟─┼╢\n" +
  "╟─┼╢\n" +
  "║ │║\n" +
  "╚═╧╝",
);

export const MARKDOWN = new Box(
  "    \n" +
  "| ||\n" +
  "|-||\n" +
  "| ||\n" +
  "|-||\n" +
  "|-||\n" +
  "| ||\n" +
  "    ",
);
