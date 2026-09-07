/**
 * Table — tabular data with headers, borders, auto-sizing, and alignment.
 */

import { cellLen, cellCount as cells } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, HEAVY_HEAD } from "../core/box.js";
import type { RowLevel } from "../core/box.js";
import { RichText } from "../core/text.js";
import { renderMarkup } from "../core/markup.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { withBoundedWidth, withCellWidth } from "../core/protocol.js";

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

/**
 * The one crossing where caller text becomes styled table content.
 *
 * Cells, headers, footers, the title and the caption each used to build their
 * own `RichText` straight from the constructor — which does not parse markup —
 * so the markup rule had five homes and was absent from all five, and
 * `[red]Solo[/red]` reached the terminal with its tags intact.
 * [LAW:single-enforcer]
 *
 * Parsing is unconditional because that is what the reference does rather than
 * because it is the simpler branch: Rich's `Console.__init__` declares
 * `markup: bool = True`, and all five positions reach the wire through Rich's
 * own `render_str`. A table-level opt-out would be a mode with no reference
 * behaviour to define. [LAW:no-mode-explosion]
 *
 * `end` is cleared on both arms, not passed in, because a table cell is a
 * fragment rather than a line — the same two steps Rich takes for a printed
 * string. The `RichText` arm copies first: clearing in place would reach back
 * into the caller's object.
 */
function toCellText(content: unknown): RichText {
  const text =
    content instanceof RichText ? content.copy() : renderMarkup(String(content ?? ""));
  text.end = "";
  return text;
}

function toRenderable(content: unknown): Renderable {
  // A `RichText` leaves through this arm too — it implements `Renderable`, so
  // the prototype carries `render` and the instance is returned untouched.
  if (typeof content === "object" && content !== null && "render" in content) {
    return content as Renderable;
  }
  return toCellText(content);
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
 * A column's `want` or `weight`. Finite, because `UNBOUNDED` is this model's
 * own infinity: a literal `Infinity` reaching `distribute` makes a column's
 * weighted share `Infinity / Infinity`, which is NaN, and the NaN then skews
 * every other elastic column in the table.
 */
const demandCells = (n: number): number => Math.min(cells(n), UNBOUNDED);

/**
 * Hand out `total` cells across `demands`, weighted, and never past a demand's
 * `want`.
 *
 * A column whose proportional share would overshoot its cap is granted its
 * whole want and dropped, and the cells it could not use are reopened to the
 * columns still under their caps. That repeats until everyone still open fits
 * within their share; one largest-remainder pass then places the cells the
 * shares left as fractions, so the granted widths sum to `total` exactly — or
 * to the point where every column is capped, which is how a table stays
 * narrower than a width it was offered.
 *
 * Each round caps at least one column or is the last, so the work is bounded by
 * the number of columns and never by the width. That bound is the point rather
 * than an optimization: handing cells out one at a time made the iteration
 * count the width itself, which stalled on a very wide table and — since
 * `Infinity - 1 === Infinity` — never terminated at all for a `maxWidth` of
 * `Infinity` held open by a ratio column. Capping by want reaches that case in
 * one round.
 */
function distribute(total: number, demands: readonly ColumnDemand[]): number[] {
  const granted: number[] = demands.map(() => 0);
  let open = demands
    .map((_, index) => index)
    .filter((index) => demands[index]!.weight > 0 && demands[index]!.want > 0);
  let remaining = Math.max(0, total);

  const weightOf = (indices: readonly number[]): number =>
    indices.reduce((sum, index) => sum + demands[index]!.weight, 0);

  while (open.length > 0 && remaining > 0) {
    const weightSum = weightOf(open);
    const capped = open.filter(
      (index) => (remaining * demands[index]!.weight) / weightSum >= demands[index]!.want,
    );
    if (capped.length === 0) break;
    for (const index of capped) {
      granted[index] = demands[index]!.want;
      remaining -= demands[index]!.want;
    }
    open = open.filter((index) => !capped.includes(index));
  }

  if (open.length > 0 && remaining > 0) {
    const weightSum = weightOf(open);
    const shares = open.map((index) => (remaining * demands[index]!.weight) / weightSum);
    const whole = shares.map(Math.floor);
    let residue = remaining - whole.reduce((sum, cells) => sum + cells, 0);

    // The cells the shares left as fractions go to the largest fraction first,
    // ties to the leftmost column, so the total lands exactly on `remaining`.
    const byFraction = open
      .map((_, slot) => slot)
      .sort((a, b) => shares[b]! - whole[b]! - (shares[a]! - whole[a]!) || a - b);
    for (const slot of byFraction) {
      if (residue <= 0) break;
      whole[slot]!++;
      residue--;
    }

    open.forEach((index, slot) => {
      granted[index] = whole[slot]!;
    });
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
  // Plain `number`, not the `CellCol` `cells` hands back: this budget is spent
  // down by arithmetic, and arithmetic on a branded type produces a number.
  let budget: number = cells(outerWidth);
  const take = (want: number): number => {
    const got = Math.min(Math.max(0, want), budget);
    budget -= got;
    return got;
  };

  // Both edge columns or neither: `Box.getTop` and its siblings take a single
  // flag for the pair, so half a frame is not a shape this renderer can emit.
  const edge = budget >= frame.edge * 2 ? frame.edge : 0;
  take(edge * 2);

  // A first content cell per column, in column order, each paying for the
  // divider that precedes it. The first column the budget cannot seat is where
  // the table ends; the rest are dropped. A column that wants no cells is
  // seated at zero — the queue exists to stop one column taking a second cell
  // before another has its first, and a spacer never joins it.
  const seats: number[] = [];
  while (seats.length < demands.length) {
    const seat = Math.min(1, demands[seats.length]!.want);
    const cost = (seats.length > 0 ? frame.divider : 0) + seat;
    if (budget < cost) break;
    take(cost);
    seats.push(seat);
  }
  const seated = seats.length;

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
  const reserved = seatedDemands.map((demand, index) => take(demand.reserved - seats[index]!));

  // What is left to apportion is the rest of what each column wanted. A table
  // whose columns all fit leaves this budget partly unspent, which is how it
  // stays narrower than the width it was offered.
  const extra = distribute(
    budget,
    seatedDemands.map((demand, index) => ({
      reserved: 0,
      want: Math.max(0, demand.want - seats[index]! - reserved[index]!),
      weight: demand.weight,
    })),
  );
  const columns = extra.map((cells, index) => seats[index]! + reserved[index]! + cells);
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
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  ratio?: number;
  noWrap?: boolean;
  overflow?: "fold" | "crop" | "ellipsis";
}

export class Column {
  private _header!: RichText;
  private _footer!: RichText;
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
    this.header = options?.header;
    this.footer = options?.footer;
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

  /**
   * The two stamped cells, parsed on assignment rather than at the constructor.
   * `Table.columns` hands out the live column and both fields are public, so a
   * constructor-only stamp held only until the first `columns[0].footer = mine`
   * — which installed content that had parsed no markup, still carried its
   * `end`, and was still owned by the caller, into a slot every reader below
   * assumes `toCellText` has been through. [LAW:parse-dont-validate] The setter
   * is the border, so the guarantee holds for the object's whole lifetime and
   * the constructor is one caller of it rather than the one place it is true.
   *
   * Absent and empty are the same header, and the same footer.
   * [LAW:types-are-the-program] Rich declares `footer: RenderableType = ""`, so
   * a column always has one and `show_footer` alone decides whether it is
   * drawn. Modelling the absence as `undefined` instead made "no column has a
   * footer" a state the render path could ask about — and it did, skipping the
   * row a caller had asked for. `toCellText` already maps nothing onto empty,
   * which is why the setters take `undefined` rather than defaulting around it.
   */
  get header(): RichText {
    return this._header;
  }

  set header(content: string | RichText | undefined) {
    this._header = toCellText(content);
  }

  get footer(): RichText {
    return this._footer;
  }

  set footer(content: string | RichText | undefined) {
    this._footer = toCellText(content);
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
      // No `.copy()` here: the crossing the constructor routes through copies
      // a `RichText` already, and a second copy is a second home for that rule.
      // [LAW:single-enforcer]
      header: this.header,
      footer: this.footer,
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
  private _rows: Array<{ cells: Renderable[]; endSection?: boolean }>;
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
    this.title = titleVal !== undefined ? toCellText(titleVal) : undefined;
    const captionVal = options?.caption;
    this.caption = captionVal !== undefined ? toCellText(captionVal) : undefined;
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

    // Stamped once, here at the border, so sizing and drawing read one resolved
    // cell instead of each converting the raw value for itself. Two converters
    // is two answers to "what is this cell": they disagreed on a `Panel`, which
    // stringifies to `[object Object]` — a string the tag pattern swallows
    // whole, sizing the column to nothing. [LAW:parse-dont-validate]
    //
    // Ahead of the column loop: a cell that throws must leave no phantom column
    // behind. [LAW:no-ambient-temporal-coupling]
    const resolved = cells.map(toRenderable);

    // Auto-create columns if needed
    while (this._columns.length < resolved.length) {
      this.addColumn();
    }

    this._rows.push({ cells: resolved, endSection });
    return this;
  }

  addSection(): this {
    if (this._rows.length > 0) {
      this._rows[this._rows.length - 1]!.endSection = true;
    }
    return this;
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    if (this._columns.length === 0) {
      yield Segment.line();
      return;
    }

    const options = withBoundedWidth(rawOptions, this);

    // The two swaps a box goes through before anything is drawn with it, in the
    // reference's order: what the platform can render, then what a table
    // lacking a header should. [LAW:dataflow-not-control-flow] Both run every
    // render and each returns the receiver when it has nothing to change, so
    // the flags arrive as values rather than as branches around a step.
    const drawable = this.box?.substitute({ asciiOnly: options.asciiOnly });
    const box = (this.showHeader ? drawable : drawable?.plainHeaded()) ?? null;
    const border = this.borderStyle.isNull ? undefined : this.borderStyle;

    // The one division of the width every row below is measured against.
    const geometry = this._geometry(this._outerWidth(options));
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
    if (this.showHeader) {
      const headerCells = this._columns.map((c) => c.header as Renderable);
      yield* this._renderRow(headerCells, geometry, box, "head", border, this.headerStyle);

      // Header separator
      if (box) {
        yield* box.getRow(geometry.cellWidths, "head", border, edge);
      }
    }

    // Data rows
    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx]!;
      const rowCells = this._columns.map((_, colIdx) => row.cells[colIdx] ?? toCellText(undefined));

      const rowStyle = this.rowStyles.length > 0
        ? resolveStyle(this.rowStyles[rowIdx % this.rowStyles.length])
        : NULL_STYLE;

      yield* this._renderRow(rowCells, geometry, box, "row", border, rowStyle);

      // Row separator
      const showSep = this.showLines || row.endSection;
      if (showSep && box && rowIdx < this._rows.length - 1) {
        yield* box.getRow(geometry.cellWidths, "row", border, edge);
      }
    }

    // Footer
    if (this.showFooter) {
      if (box) {
        yield* box.getRow(geometry.cellWidths, "foot", border, edge);
      }
      const footerCells = this._columns.map((c) => c.footer as Renderable);
      yield* this._renderRow(footerCells, geometry, box, "foot", border, this.footerStyle);
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
  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    const options = withCellWidth(rawOptions);
    const outerWidth = this._outerWidth(options);
    const frame = this._frame();
    const demands = this._columnDemands();
    const laidOut = layoutTable(outerWidth, demands, this.padding, frame).totalWidth;
    // `UNBOUNDED` is this table's own infinity, so a layout that reached it has
    // no natural width to report — a column asked for every cell there is. Said
    // as the number, it escapes as a width a caller would try to draw:
    // `minWidth: Infinity` measured 18014398509481988 and rendered
    // `RangeError: Invalid string length` out of the top border.
    const maximum = laidOut >= UNBOUNDED ? Infinity : laidOut;
    const tightest = layoutTable(
      outerWidth,
      demands.map((demand) => ({
        reserved: 0,
        want: Math.min(1, demand.want),
        weight: 1,
      })),
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

  /**
   * The width this table lays itself out against: what it was told to be, as a
   * count of cells, never wider than what it was offered.
   *
   * [LAW:one-source-of-truth] `render` and `measure` divide the same two fields
   * and once did it in two places. `measure` bounded the declared width by the
   * offer and `render` preferred it outright, walking past the value
   * `withBoundedWidth` had just resolved — so `new Table({width: Infinity})`
   * with a `{ratio: 1}` column granted that column `UNBOUNDED` cells and threw
   * `RangeError: Invalid string length` out of the top border, at a perfectly
   * ordinary 80-cell offer.
   */
  private _outerWidth(options: RenderOptions): number {
    return Math.min(
      this.tableWidth === undefined ? options.maxWidth : cells(this.tableWidth),
      options.maxWidth,
    );
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
        // [LAW:single-enforcer] floored where it is parsed, the same rule
        // `normalizePadding` applies to a negative padding side.
        const declared = demandCells(col.width);
        return { reserved: declared, want: declared, weight: 0 };
      }
      if (elastic) return { reserved: 0, want: UNBOUNDED, weight: demandCells(col.ratio ?? 1) };
      const natural = demandCells(this._naturalWidth(col, index));
      return { reserved: 0, want: natural, weight: natural };
    });
  }

  /**
   * Every cell column `index` draws, in draw order.
   *
   * [LAW:one-source-of-truth] The reference's `_get_cells` is the one answer to
   * "which cells belong to this column", and both `_measure_column` and
   * `_render` read it. Enumerating that set a second time inside the width path
   * is how the two ends drifted: the header was measured whether or not
   * `showHeader` drew it, and `col.footer` was never measured at all, so a
   * footer wider than its column — a totals row, exactly — was cut to `…`.
   * A flag is the whole membership rule; nothing here asks after content.
   */
  private *_columnCells(col: Column, index: number): Iterable<Renderable> {
    if (this.showHeader) yield col.header;
    for (const row of this._rows) yield row.cells[index] ?? toCellText(undefined);
    if (this.showFooter) yield col.footer;
  }

  /**
   * The widest cell in a column, bounded by its own `minWidth`/`maxWidth`.
   * Zero for a column that draws nothing — a gutter asks for its padding and
   * nothing else.
   */
  private _naturalWidth(col: Column, index: number): number {
    let natural = 0;
    for (const cell of this._columnCells(col, index)) {
      // The stamped cell, so the width a column asks for is the width its text
      // will occupy — measuring the raw value sized this column to
      // `[red]Solo[/red]`, fifteen cells for four cells of text.
      // [LAW:one-source-of-truth]
      //
      // A cell that draws itself is stringified rather than measured, which is
      // a pre-existing gap: `_columnDemands` carries no `RenderOptions`, so
      // `Measurement.get` is not reachable from here. It contributes a wrong
      // non-zero width, and narrowing that is its own change.
      natural = Math.max(
        natural,
        cell instanceof RichText ? cellLen(cell.plain) : cellLen(String(cell)),
      );
    }
    if (col.minWidth !== undefined) natural = Math.max(natural, col.minWidth);
    if (col.maxWidth !== undefined) natural = Math.min(natural, col.maxWidth);
    return natural;
  }

  private *_renderRow(
    cells: Renderable[],
    geometry: TableGeometry,
    box: Box | null,
    level: RowLevel,
    border: Style | undefined,
    rowStyle: Style,
  ): Iterable<Segment> {
    const { padLeft, padRight, columns } = geometry;

    // [LAW:dataflow-not-control-flow] Header, body and footer share this path;
    // the level crosses as a value the box answers with glyphs, not a branch.
    const frame = box?.getContentChars(level);

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
      if (frame && geometry.edge === 1) {
        yield new Segment(frame.left, border);
      }

      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        if (colIdx > 0 && frame) {
          yield new Segment(frame.vertical, border);
        }

        const cellWidth = columns[colIdx]!;
        if (padLeft > 0) yield new Segment(" ".repeat(padLeft));

        // A cell that ran out of lines contributes blanks, so every column
        // spans the same number of rows and the frame stays rectangular.
        const line = cellLines[colIdx]![lineIdx] ?? [new Segment(" ".repeat(cellWidth))];
        yield* rowStyle.isNull ? line : Segment.applyStyle(line, rowStyle);

        if (padRight > 0) yield new Segment(" ".repeat(padRight));
      }

      if (frame && geometry.edge === 1) {
        yield new Segment(frame.right, border);
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

    // The table owns the canvas; the caller's text still says how it meets the
    // edge. A `RichText`'s own `justify` and `noWrap` outrank the options
    // `render` is handed, so `titleJustify` would lose to a property the caller
    // may not know it set, and a `noWrap` title would leave at its natural width
    // and run straight through the frame. `overflow` stays theirs: every method
    // cuts within a bound it cannot lift, so none can escape. Cleared on a copy
    // rather than in place — the caller's text is theirs. [LAW:one-source-of-truth]
    const source = text.copy();
    source.justify = undefined;
    source.noWrap = false;

    // The table's title style is the *base* the content's own spans layer over,
    // which is what the reference emits: a `[red]` title inside an italic table
    // title arrives as italic-red, not one or the other. Rendering `text.plain`
    // here read the characters and dropped every span attached to them, so a
    // styled title lost its styling and parsed markup silently did nothing.
    //
    // Rendered at the table's own width with nothing suppressed, because that
    // is what the reference hands its title: an annotation too wide for the
    // frame wraps down it rather than being cut off at the corner. `noWrap` and
    // an explicit `crop` stood here and did the cutting (rich-table-6uy.7).
    //
    // [LAW:single-enforcer] The alignment is the renderable's to perform, not
    // just to be told. Padding the lines here as well needed the same
    // rules — that a wrap's trailing whitespace is not content to centre
    // around, that `left` fills the canvas and an unset justify does not — and
    // a second copy of those is a second answer waiting to disagree.
    const rendered = [...source.render({ maxWidth: tableWidth, justify })];

    // Every line the text has, because that is what the reference renders — a
    // title of "one\ntwo" occupies two lines there. Taking only the first
    // dropped the rest with no truncation mark.
    for (const line of Segment.splitLines(rendered)) {
      yield* Segment.applyStyle(line, titleStyle);
      yield Segment.line();
    }
  }

}
