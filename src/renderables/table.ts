/**
 * Table — tabular data with headers, borders, auto-sizing, and alignment.
 */

import { cellLen, setCellSize, asCellCol } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, HEAVY_HEAD } from "../core/box.js";
import { RichText } from "../core/text.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

function toRenderable(content: unknown): Renderable {
  if (content instanceof RichText) return content;
  if (typeof content === "object" && content !== null && "render" in content) {
    return content as Renderable;
  }
  return new RichText(String(content ?? ""), { end: "" });
}


// --- Width division ---

/**
 * What one column asks of the width division: cells it takes off the top,
 * cells it would use if the table were not squeezed, and how hard it pulls
 * when the cells run short.
 *
 * A declared `width` is a reservation rather than a bid — it is paid before
 * anyone competes, because a column told to be four cells wide is not asking
 * for a proportional share of four. A plain column reserves nothing and both
 * wants and weighs its natural content width. A ratio column wants more than
 * any budget can offer and weighs its ratio, so it absorbs whatever the
 * bounded columns leave behind.
 */
interface ColumnDemand {
  readonly reserved: number;
  readonly want: number;
  readonly weight: number;
}

/** A `want` no budget can satisfy: the column takes every cell its weight earns. */
const UNBOUNDED = Number.MAX_SAFE_INTEGER;

/**
 * Hand out `total` cells across `demands`, weighted, and never past a demand's
 * `want`.
 *
 * Cells go out one at a time to whichever column currently sits furthest behind
 * the share its weight entitles it to — the highest-averages rule elections use
 * to apportion seats. Doing it a cell at a time is what makes the result exact:
 * the granted widths sum to `total`, or to the point where every column has hit
 * its cap, with no rounding residue for a second pass to sweep up and disagree
 * about. Capped columns simply stop winning rounds, so the cells they cannot
 * use flow to the columns that can, without a redistribution step.
 */
function distribute(total: number, demands: readonly ColumnDemand[]): number[] {
  const granted: number[] = demands.map(() => 0);
  let budget = Math.max(0, total);

  while (budget > 0) {
    let winner = -1;
    let bestScore = 0;
    for (let i = 0; i < demands.length; i++) {
      const demand = demands[i]!;
      if (granted[i]! >= demand.want) continue;
      const score = demand.weight / (granted[i]! + 1);
      if (score > bestScore) {
        bestScore = score;
        winner = i;
      }
    }
    if (winner < 0) break;
    granted[winner]!++;
    budget--;
  }

  return granted;
}

/** The cells a box costs a table, independent of how wide the table is. */
interface TableFrame {
  /** Width of one inter-column divider: 1 with a box, 0 without. */
  readonly divider: number;
  /** Width of one outer edge column: 1 with a box drawn to its edge, 0 without. */
  readonly edge: number;
}

/**
 * How one requested outer width divides into edge columns, dividers, padding
 * and column canvases.
 *
 * [LAW:one-source-of-truth] Every row a table emits — the four kinds of box
 * row, the header, the data rows, the footer, and the title/caption spans —
 * is measured from this one division, so they cannot disagree about where the
 * frame sits. The fields sum to `totalWidth`, and `totalWidth` never exceeds
 * the requested width, which is what makes "no emitted line is wider than the
 * width we were given" true by construction rather than by a clamp repeated at
 * each site.
 *
 * Cells are handed out in priority order — the pair of edge columns, then one
 * content cell per column with the divider that precedes it, then the
 * configured padding, then the remainder back to content. Content outranking
 * padding is why a squeezed table shows characters rather than spending its
 * last cells framing empty canvases.
 */
interface TableGeometry {
  readonly edge: number;
  readonly divider: number;
  readonly padLeft: number;
  readonly padRight: number;
  /**
   * Content canvas per rendered column. Shorter than the table's column list
   * when the requested width could not seat them all — the columns that did
   * not fit are dropped, never drawn outside the frame.
   */
  readonly columns: readonly number[];
  /**
   * `padLeft + column + padRight` per rendered column: the spans a `Box` fills
   * between its dividers. Read off the geometry rather than recomputed at each
   * of the four box-row callsites, which is where the widths used to drift.
   */
  readonly cellWidths: readonly number[];
  /** The exact width of every line this geometry produces. */
  readonly totalWidth: number;
}

function layoutTable(
  outerWidth: number,
  demands: readonly ColumnDemand[],
  padding: readonly [number, number, number, number],
  frame: TableFrame,
): TableGeometry {
  const [, padRightWanted, , padLeftWanted] = padding;
  let budget = Math.max(0, outerWidth);
  const take = (want: number): number => {
    const got = Math.min(Math.max(0, want), budget);
    budget -= got;
    return got;
  };

  // Both edge columns or neither: `Box.getTop` and its siblings take a single
  // flag for the pair, so half a frame is not a shape this renderer can emit.
  const edge = budget >= frame.edge * 2 ? frame.edge : 0;
  take(edge * 2);

  // One content cell per column, in column order, each paying for the divider
  // that precedes it. The first column the budget cannot seat is where the
  // table ends; the rest are dropped.
  let seated = 0;
  while (seated < demands.length && budget >= (seated > 0 ? frame.divider : 0) + 1) {
    take((seated > 0 ? frame.divider : 0) + 1);
    seated++;
  }

  // Padding is uniform across columns or it is not padding, so it is bought
  // for every seated column at once and skipped entirely when only some could
  // afford it.
  const takePerColumn = (want: number): number => {
    const per = seated === 0
      ? 0
      : Math.min(Math.max(0, want), Math.floor(budget / seated));
    budget -= per * seated;
    return per;
  };
  const padLeft = takePerColumn(padLeftWanted);
  const padRight = takePerColumn(padRightWanted);

  // Reservations are paid in column order, each already holding the cell the
  // seating pass gave it. A budget too small to cover them all runs out
  // partway, which costs the trailing columns their width but never costs the
  // table its frame.
  const seatedDemands = demands.slice(0, seated);
  const reserved = seatedDemands.map((demand) => take(demand.reserved - 1));

  // What is left to apportion is the rest of what each column wanted. A table
  // whose columns all fit leaves this budget partly unspent, which is how it
  // stays narrower than the width it was offered.
  const extra = distribute(
    budget,
    seatedDemands.map((demand, index) => ({
      reserved: 0,
      want: Math.max(0, demand.want - 1 - reserved[index]!),
      weight: demand.weight,
    })),
  );
  const columns = extra.map((cells, index) => 1 + reserved[index]! + cells);
  const cellWidths = columns.map((width) => padLeft + width + padRight);

  return {
    edge,
    divider: frame.divider,
    padLeft,
    padRight,
    columns,
    cellWidths,
    totalWidth:
      edge * 2 +
      Math.max(0, seated - 1) * frame.divider +
      cellWidths.reduce((sum, width) => sum + width, 0),
  };
}

// --- Column ---

export interface ColumnOptions {
  header?: string | RichText;
  footer?: string | RichText;
  headerStyle?: string | Style;
  footerStyle?: string | Style;
  style?: string | Style;
  justify?: "left" | "center" | "right" | "full";
  vertical?: "top" | "middle" | "bottom";
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  ratio?: number;
  noWrap?: boolean;
  overflow?: "fold" | "crop" | "ellipsis";
}

export class Column {
  header: RichText;
  footer: RichText | undefined;
  headerStyle: Style;
  footerStyle: Style;
  style: Style;
  justify: "left" | "center" | "right" | "full";
  width: number | undefined;
  minWidth: number | undefined;
  maxWidth: number | undefined;
  ratio: number | undefined;
  noWrap: boolean;
  overflow: "fold" | "crop" | "ellipsis";
  private _cells: Renderable[];

  constructor(options?: ColumnOptions) {
    const headerVal = options?.header;
    this.header = headerVal instanceof RichText
      ? headerVal
      : new RichText(headerVal ?? "", { end: "" });
    const footerVal = options?.footer;
    this.footer = footerVal !== undefined
      ? (footerVal instanceof RichText ? footerVal : new RichText(footerVal, { end: "" }))
      : undefined;
    this.headerStyle = resolveStyle(options?.headerStyle);
    this.footerStyle = resolveStyle(options?.footerStyle);
    this.style = resolveStyle(options?.style);
    this.justify = options?.justify ?? "left";
    this.width = options?.width;
    this.minWidth = options?.minWidth;
    this.maxWidth = options?.maxWidth;
    this.ratio = options?.ratio;
    this.noWrap = options?.noWrap ?? false;
    this.overflow = options?.overflow ?? "ellipsis";
    this._cells = [];
  }

  get flexible(): boolean {
    return this.ratio !== undefined && this.ratio > 0;
  }

  /** @internal */
  addCell(cell: Renderable): void {
    this._cells.push(cell);
  }

  /** @internal */
  getCells(): Renderable[] {
    return this._cells;
  }

  copy(): Column {
    const col = new Column({
      header: this.header.copy(),
      footer: this.footer?.copy(),
      justify: this.justify,
      width: this.width,
      minWidth: this.minWidth,
      maxWidth: this.maxWidth,
      ratio: this.ratio,
      noWrap: this.noWrap,
      overflow: this.overflow,
    });
    col.headerStyle = this.headerStyle;
    col.footerStyle = this.footerStyle;
    col.style = this.style;
    return col;
  }
}

// --- Table ---

export interface TableOptions {
  box?: Box | null;
  title?: string | RichText;
  caption?: string | RichText;
  expand?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  showLines?: boolean;
  showEdge?: boolean;
  padding?: PaddingDimensions;
  style?: string | Style;
  headerStyle?: string | Style;
  footerStyle?: string | Style;
  borderStyle?: string | Style;
  titleStyle?: string | Style;
  captionStyle?: string | Style;
  titleJustify?: "left" | "center" | "right" | "full";
  captionJustify?: "left" | "center" | "right" | "full";
  width?: number;
  minWidth?: number;
  rowStyles?: string[];
}

export class Table implements Renderable, Measurable {
  private _columns: Column[];
  private _rows: Array<{ cells: unknown[]; endSection?: boolean }>;
  readonly box: Box | null;
  readonly title: RichText | undefined;
  readonly caption: RichText | undefined;
  readonly expand: boolean;
  readonly showHeader: boolean;
  readonly showFooter: boolean;
  readonly showLines: boolean;
  readonly showEdge: boolean;
  readonly padding: [number, number, number, number];
  readonly style: Style;
  readonly headerStyle: Style;
  readonly footerStyle: Style;
  readonly borderStyle: Style;
  readonly titleStyle: Style;
  readonly captionStyle: Style;
  readonly titleJustify: "left" | "center" | "right" | "full";
  readonly captionJustify: "left" | "center" | "right" | "full";
  readonly tableWidth: number | undefined;
  readonly minWidth: number | undefined;
  readonly rowStyles: string[];

  constructor(options?: TableOptions) {
    this._columns = [];
    this._rows = [];
    this.box = options?.box !== undefined ? options.box : HEAVY_HEAD;
    const titleVal = options?.title;
    this.title = titleVal !== undefined
      ? (titleVal instanceof RichText ? titleVal : new RichText(titleVal, { end: "" }))
      : undefined;
    const captionVal = options?.caption;
    this.caption = captionVal !== undefined
      ? (captionVal instanceof RichText ? captionVal : new RichText(captionVal, { end: "" }))
      : undefined;
    this.expand = options?.expand ?? false;
    this.showHeader = options?.showHeader !== false;
    this.showFooter = options?.showFooter ?? false;
    this.showLines = options?.showLines ?? false;
    this.showEdge = options?.showEdge !== false;
    this.padding = normalizePadding(options?.padding ?? [0, 1, 0, 1]);
    this.style = resolveStyle(options?.style);
    this.headerStyle = resolveStyle(options?.headerStyle ?? "table.header");
    this.footerStyle = resolveStyle(options?.footerStyle ?? "table.footer");
    this.borderStyle = resolveStyle(options?.borderStyle);
    this.titleStyle = resolveStyle(options?.titleStyle ?? "table.title");
    this.captionStyle = resolveStyle(options?.captionStyle ?? "table.caption");
    this.titleJustify = options?.titleJustify ?? "center";
    this.captionJustify = options?.captionJustify ?? "center";
    this.tableWidth = options?.width;
    this.minWidth = options?.minWidth;
    this.rowStyles = options?.rowStyles ?? [];
  }

  get columns(): Column[] {
    return this._columns;
  }

  get rowCount(): number {
    return this._rows.length;
  }

  addColumn(header?: string | RichText, options?: ColumnOptions): this {
    const col = new Column({ ...options, header: header ?? options?.header });
    this._columns.push(col);
    return this;
  }

  addRow(...cells: unknown[]): this {
    // If last arg is an options object with endSection, extract it
    let endSection = false;
    const lastArg = cells[cells.length - 1];
    if (
      typeof lastArg === "object" &&
      lastArg !== null &&
      !(lastArg instanceof RichText) &&
      !("render" in lastArg) &&
      "endSection" in lastArg
    ) {
      endSection = (lastArg as { endSection: boolean }).endSection;
      cells = cells.slice(0, -1);
    }

    // Auto-create columns if needed
    while (this._columns.length < cells.length) {
      this.addColumn();
    }

    this._rows.push({ cells, endSection });
    return this;
  }

  addSection(): this {
    if (this._rows.length > 0) {
      this._rows[this._rows.length - 1]!.endSection = true;
    }
    return this;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    if (this._columns.length === 0) {
      yield Segment.line();
      return;
    }

    const box = this.box
      ? (options.asciiOnly ? this.box.substitute({ asciiOnly: true }) : this.box)
      : null;
    const border = this.borderStyle.isNull ? undefined : this.borderStyle;

    // The one division of the width every row below is measured against.
    const geometry = this._geometry(this.tableWidth ?? options.maxWidth);
    const edge = geometry.edge === 1;

    // Title
    if (this.title) {
      yield* this._renderTitle(this.title, geometry.totalWidth, this.titleStyle, this.titleJustify);
    }

    // Top border
    if (box && this.showEdge) {
      yield* box.getTop(geometry.cellWidths, border, edge);
    }

    // Header row
    if (this.showHeader && this._columns.some((c) => c.header.hasContent)) {
      const headerCells = this._columns.map((c) => c.header as Renderable);
      yield* this._renderRow(headerCells, geometry, box, border, this.headerStyle);

      // Header separator
      if (box) {
        yield* box.getRow(geometry.cellWidths, "head", border, edge);
      }
    }

    // Data rows
    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx]!;
      const rowCells = this._columns.map((_, colIdx) => toRenderable(row.cells[colIdx]));

      const rowStyle = this.rowStyles.length > 0
        ? resolveStyle(this.rowStyles[rowIdx % this.rowStyles.length])
        : NULL_STYLE;

      yield* this._renderRow(rowCells, geometry, box, border, rowStyle);

      // Row separator
      const showSep = this.showLines || row.endSection;
      if (showSep && box && rowIdx < this._rows.length - 1) {
        yield* box.getRow(geometry.cellWidths, "row", border, edge);
      }
    }

    // Footer
    if (this.showFooter && this._columns.some((c) => c.footer)) {
      if (box) {
        yield* box.getRow(geometry.cellWidths, "foot", border, edge);
      }
      const footerCells = this._columns.map((c) => (c.footer ?? new RichText("", { end: "" })) as Renderable);
      yield* this._renderRow(footerCells, geometry, box, border, this.footerStyle);
    }

    // Bottom border
    if (box && this.showEdge) {
      yield* box.getBottom(geometry.cellWidths, border, edge);
    }

    // Caption
    if (this.caption) {
      yield* this._renderTitle(this.caption, geometry.totalWidth, this.captionStyle, this.captionJustify);
    }
  }

  /**
   * [LAW:one-source-of-truth] Both ends of the range are widths the geometry
   * actually produced — the maximum from the demands as they stand, the
   * minimum from the same layout with every column asking for a single cell.
   * Neither can exceed the width offered and the tighter request cannot exceed
   * the looser one, so the range cannot invert. Deriving the minimum from raw
   * column and padding counts instead is what used to return
   * `{minimum: 6, maximum: 1}` at `maxWidth: 1` — a floor above its own ceiling.
   */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const outerWidth = this.tableWidth ?? options.maxWidth;
    const frame = this._frame();
    const maximum = layoutTable(outerWidth, this._columnDemands(), this.padding, frame).totalWidth;
    const tightest = layoutTable(
      outerWidth,
      this._columns.map(() => ({ reserved: 0, want: 1, weight: 1 })),
      this.padding,
      frame,
    ).totalWidth;
    return {
      minimum: Math.min(maximum, Math.max(tightest, this.minWidth ?? 0)),
      maximum,
    };
  }

  // --- Static ---

  static grid(options?: Omit<TableOptions, "box" | "showHeader" | "showEdge">): Table {
    return new Table({
      ...options,
      box: null,
      showHeader: false,
      showEdge: false,
      padding: options?.padding ?? [0, 1, 0, 0],
    });
  }

  // --- Private ---

  private _frame(): TableFrame {
    return {
      divider: this.box ? 1 : 0,
      edge: this.box && this.showEdge ? 1 : 0,
    };
  }

  private _geometry(outerWidth: number): TableGeometry {
    return layoutTable(outerWidth, this._columnDemands(), this.padding, this._frame());
  }

  /**
   * [LAW:dataflow-not-control-flow] The three ways a column can be sized —
   * declared width, ratio, natural content — differ only in the `want` and
   * `weight` they produce. They are resolved once, here, into uniform data, so
   * `layoutTable` runs the same apportionment for every table and no sizing
   * mode gets its own path through the width division.
   */
  private _columnDemands(): ColumnDemand[] {
    // A ratio on any column makes every non-fixed column elastic: a ratio
    // expresses a split of the whole width, so a column that declares none
    // still holds a share of it (1).
    const elastic = this._columns.some((col) => col.flexible);

    return this._columns.map((col, index) => {
      if (col.width !== undefined) {
        const declared = Math.max(1, col.width);
        return { reserved: declared, want: declared, weight: 0 };
      }
      if (elastic) return { reserved: 0, want: UNBOUNDED, weight: col.ratio ?? 1 };
      const natural = this._naturalWidth(col, index);
      return { reserved: 0, want: natural, weight: natural };
    });
  }

  /** The widest cell in a column, bounded by its own `minWidth`/`maxWidth`. */
  private _naturalWidth(col: Column, index: number): number {
    let natural = cellLen(col.header.plain);
    for (const row of this._rows) {
      natural = Math.max(natural, cellLen(String(row.cells[index] ?? "")));
    }
    if (col.minWidth !== undefined) natural = Math.max(natural, col.minWidth);
    if (col.maxWidth !== undefined) natural = Math.min(natural, col.maxWidth);
    return Math.max(1, natural);
  }

  private *_renderRow(
    cells: Renderable[],
    geometry: TableGeometry,
    box: Box | null,
    border: Style | undefined,
    rowStyle: Style,
  ): Iterable<Segment> {
    const { padLeft, padRight, columns } = geometry;

    // Render each cell onto the canvas the geometry gave its column. Columns
    // the width could not seat are absent from `columns` and so are never
    // rendered at all.
    const cellLines: Segment[][][] = columns.map((cellWidth, index) => {
      const col = this._columns[index]!;
      const cell = cells[index] ?? toRenderable("");
      const segs = [...cell.render({
        maxWidth: cellWidth,
        justify: col.justify,
        overflow: col.overflow,
        noWrap: col.noWrap,
      })];
      const lines = Segment.splitLines(segs).map((line) =>
        Segment.adjustLineLength(line, cellWidth),
      );
      return lines.length > 0 ? lines : [[new Segment(" ".repeat(cellWidth))]];
    });
    const maxLines = cellLines.reduce((most, lines) => Math.max(most, lines.length), 1);

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      if (box && geometry.edge === 1) {
        yield new Segment(box.left, border);
      }

      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        if (colIdx > 0 && box) {
          yield new Segment(box.vertical, border);
        }

        const cellWidth = columns[colIdx]!;
        if (padLeft > 0) yield new Segment(" ".repeat(padLeft));

        // A cell that ran out of lines contributes blanks, so every column
        // spans the same number of rows and the frame stays rectangular.
        const line = cellLines[colIdx]![lineIdx] ?? [new Segment(" ".repeat(cellWidth))];
        yield* rowStyle.isNull ? line : Segment.applyStyle(line, rowStyle);

        if (padRight > 0) yield new Segment(" ".repeat(padRight));
      }

      if (box && geometry.edge === 1) {
        yield new Segment(box.right, border);
      }
      yield Segment.line();
    }
  }

  private *_renderTitle(
    text: RichText,
    tableWidth: number,
    style: Style,
    justify: "left" | "center" | "right" | "full",
  ): Iterable<Segment> {
    const titleStyle = style.isNull ? undefined : style;
    const plain = text.plain;
    const textWidth = cellLen(plain);

    // Cropped by cells, not by code units: a title of wide characters sliced
    // at `tableWidth` code units is up to twice `tableWidth` cells on screen,
    // which is the overflow this crop exists to prevent.
    if (textWidth >= tableWidth) {
      yield new Segment(setCellSize(plain, asCellCol(tableWidth)), titleStyle);
      yield Segment.line();
      return;
    }

    const gap = tableWidth - textWidth;
    const leftPad =
      justify === "right" ? gap
        : justify === "center" ? Math.floor(gap / 2)
          : 0;
    const rightPad = gap - leftPad;

    if (leftPad > 0) yield new Segment(" ".repeat(leftPad));
    yield new Segment(plain, titleStyle);
    if (rightPad > 0) yield new Segment(" ".repeat(rightPad));
    yield Segment.line();
  }
}
