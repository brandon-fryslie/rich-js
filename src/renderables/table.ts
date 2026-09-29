/**
 * Table — tabular data with headers, borders, auto-sizing, and alignment.
 */

import { cellLen, cellCount as cells } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, HEAVY_HEAD } from "../core/box.js";
import type { RowLevel } from "../core/box.js";
import { RichText } from "../core/text.js";
import { embed, embeddedText } from "./embed.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { getStyle, withBoundedWidth, withCellWidth } from "../core/protocol.js";

// --- Width division ---

/**
 * What one column asks of the width division: cells it takes off the top,
 * cells it would use if the table were not squeezed, how hard it pulls when
 * the cells run short, its share of the cells left once every column has what
 * it wanted, and whether it grows into whatever the shares leave.
 *
 * A declared `width` is a reservation rather than a bid — it is paid before
 * anyone competes, because a column told to be four cells wide is not asking
 * for a proportional share of four. A plain column reserves nothing and both
 * wants and weighs its natural content width. A ratio column wants only its
 * seat and takes its `ratio` of what the bounded columns leave: a pass of its
 * own, because a ratio is a proportion and a `weight` is a count of cells, and
 * weighing one against the other let `ratio: 100` truncate a neighbour the
 * table had room for. A column with no cell to measure wants one cell and
 * `fill`s up to its cap before any share is taken. `stretch` is false unless
 * the table expands, and a table with a ratio column leaves nothing to stretch. Cells are left over only when
 * no column is short, so neither a share nor a stretch can widen one column
 * while another is still truncated.
 */
interface ColumnDemand {
  readonly reserved: number;
  readonly want: number;
  readonly weight: number;
  readonly fill: number;
  readonly ratio: number;
  readonly stretch: boolean;
}

/** The part of a demand that one round of `distribute` competes on. */
type Bid = Pick<ColumnDemand, "want" | "weight">;

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
 *
 * The arithmetic is exact. A share's fraction is what decides who gets a
 * leftover cell, and in floating point two fractions that are equal — 6/14 and
 * 6/14 for 16 cells over weights 3 and 10 — come out 0.4285714285714284 and
 * 0.4285714285714288, so the tie went wherever the rounding error pointed.
 * Every finite double is an integer over a power of two, so the weights are
 * scaled to one such denominator and everything after is integer division.
 */
function distribute(total: number, demands: readonly Bid[]): number[] {
  const granted: number[] = demands.map(() => 0);
  let open = demands
    .map((_, index) => index)
    .filter((index) => demands[index]!.weight > 0 && demands[index]!.want > 0);
  const weights = exactWeights(demands.map((demand) => demand.weight));
  const wants = demands.map((demand) => BigInt(demand.want));
  // A budget past every open want grants each its want either way, and that
  // bound is what keeps an unbounded offer — `Infinity` is a legal outer width
  // — out of integer arithmetic that cannot hold it.
  const wantSum = open.reduce((sum, index) => sum + wants[index]!, 0n);
  let remaining = total >= wantSum ? wantSum : BigInt(Math.max(0, total));

  const weightOf = (indices: readonly number[]): bigint =>
    indices.reduce((sum, index) => sum + weights[index]!, 0n);

  while (open.length > 0 && remaining > 0n) {
    const weightSum = weightOf(open);
    const capped = open.filter(
      (index) => remaining * weights[index]! >= wants[index]! * weightSum,
    );
    if (capped.length === 0) break;
    for (const index of capped) {
      granted[index] = demands[index]!.want;
      remaining -= wants[index]!;
    }
    open = open.filter((index) => !capped.includes(index));
  }

  if (open.length > 0 && remaining > 0n) {
    const weightSum = weightOf(open);
    const products = open.map((index) => remaining * weights[index]!);
    const whole = products.map((product) => product / weightSum);
    const fraction = products.map((product) => product % weightSum);
    let residue = remaining - whole.reduce((sum, cells) => sum + cells, 0n);

    // The cells the shares left as fractions go to the largest fraction first,
    // ties to the leftmost column, so the total lands exactly on `remaining`.
    const byFraction = open
      .map((_, slot) => slot)
      .sort((a, b) => fraction[b]! > fraction[a]! ? 1 : fraction[b]! < fraction[a]! ? -1 : a - b);
    for (const slot of byFraction) {
      if (residue <= 0n) break;
      whole[slot]!++;
      residue--;
    }

    open.forEach((index, slot) => {
      granted[index] = Number(whole[slot]!);
    });
  }

  return granted;
}

/**
 * Weights as integers in one exact proportion: each is scaled by the one power
 * of two that makes all of them whole. Doubling a double is exact, and one that
 * is not yet whole is below 2^53, so the loop neither rounds nor overflows. A
 * weight that is not finite leaves the loop as it came and `BigInt` refuses it
 * with a RangeError — the loud end of what `demandCells` exists to prevent.
 */
function exactWeights(weights: readonly number[]): bigint[] {
  const scaled = weights.map((weight) => {
    let mantissa = weight;
    let exponent = 0;
    while (Number.isFinite(mantissa) && !Number.isInteger(mantissa)) {
      mantissa *= 2;
      exponent++;
    }
    return { mantissa: BigInt(mantissa), exponent };
  });
  const common = Math.max(0, ...scaled.map(({ exponent }) => exponent));
  return scaled.map(({ mantissa, exponent }) => mantissa << BigInt(common - exponent));
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
  // whose columns all fit leaves this budget partly unspent.
  const wanted = distribute(
    budget,
    seatedDemands.map((demand, index) => ({
      want: Math.max(0, demand.want - seats[index]! - reserved[index]!),
      weight: demand.weight,
    })),
  );
  const spent = (granted: readonly number[]): number =>
    granted.reduce((sum, cells) => sum + cells, 0);
  const holding = (...passes: ReadonlyArray<readonly number[]>): number[] =>
    seatedDemands.map((_, index) =>
      passes.reduce((sum, granted) => sum + granted[index]!, seats[index]! + reserved[index]!),
    );
  // The unspent part goes first to the columns with nothing to size to, each
  // alike, up to its `fill` — the reference's `Measurement(1, max_width)`, a
  // maximum of the whole offer that no content measured.
  const afterWant = holding(wanted);
  const filled = distribute(
    budget - spent(wanted),
    seatedDemands.map((demand, index) => ({
      want: Math.max(0, demand.fill - afterWant[index]!),
      weight: demand.fill > 0 ? 1 : 0,
    })),
  );
  // Then to the ratio columns, in proportion.
  const shared = distribute(
    budget - spent(wanted) - spent(filled),
    seatedDemands.map((demand) => ({ want: UNBOUNDED, weight: demand.ratio })),
  );
  // What the shares leave goes to the columns that stretch, by the width each
  // already holds: its natural width, since nothing is left over while any
  // column is short, or the cap a fill stopped at. The reference weighs by
  // width too: `ratio_distribute(max_width - table_width, widths)`, though its
  // widths count the padding. A table that does not expand stretches nothing,
  // which is how it stays narrower than the width it was offered. The order is the reference's:
  // Rich pads an expanding table only once `table_width < max_width`, never
  // while it is collapsing a column.
  const held = holding(wanted, filled, shared);
  const stretched = distribute(
    budget - spent(wanted) - spent(filled) - spent(shared),
    seatedDemands.map((demand, index) => ({
      want: UNBOUNDED,
      weight: demand.stretch ? held[index]! : 0,
    })),
  );
  const columns = held.map((cells, index) => cells + stretched[index]!);
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

/**
 * The share of the leftover width a column's `ratio` claims: the ratio when it
 * is positive, else 0 — a zero, negative or NaN ratio claims none, and the
 * column sizes to its content. A proportion rather than a count of cells, so it
 * is never floored: `ratio: 0.5` beside `ratio: 1` takes a third, where flooring
 * it to 0 once starved it to a single `…`. Finite, for the reason `demandCells`
 * is.
 *
 * [LAW:one-source-of-truth] `Column.flexible` is this asked as a yes/no, so the
 * width division and the public flag cannot disagree about which columns are
 * elastic.
 */
const columnShare = (col: Column): number =>
  col.ratio !== undefined && col.ratio > 0 ? Math.min(col.ratio, UNBOUNDED) : 0;

export class Column {
  private _header!: RichText;
  private _footer!: RichText;
  headerStyle: string | Style;
  footerStyle: string | Style;
  style: string | Style;
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
    this.headerStyle = options?.headerStyle ?? NULL_STYLE;
    this.footerStyle = options?.footerStyle ?? NULL_STYLE;
    this.style = options?.style ?? NULL_STYLE;
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
   * assumes `embeddedText` has been through. [LAW:parse-dont-validate] The setter
   * is the border, so the guarantee holds for the object's whole lifetime and
   * the constructor is one caller of it rather than the one place it is true.
   *
   * Absent and empty are the same header, and the same footer.
   * [LAW:types-are-the-program] Rich declares `footer: RenderableType = ""`, so
   * a column always has one and `show_footer` alone decides whether it is
   * drawn. Modelling the absence as `undefined` instead made "no column has a
   * footer" a state the render path could ask about — and it did, skipping the
   * row a caller had asked for. `embeddedText` already maps nothing onto empty,
   * which is why the setters take `undefined` rather than defaulting around it.
   */
  get header(): RichText {
    return this._header;
  }

  set header(content: string | RichText | undefined) {
    this._header = embeddedText(content);
  }

  get footer(): RichText {
    return this._footer;
  }

  set footer(content: string | RichText | undefined) {
    this._footer = embeddedText(content);
  }

  get flexible(): boolean {
    return columnShare(this) > 0;
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
  readonly style: string | Style;
  readonly headerStyle: string | Style;
  readonly footerStyle: string | Style;
  readonly borderStyle: string | Style;
  readonly titleStyle: string | Style;
  readonly captionStyle: string | Style;
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
    this.title = titleVal !== undefined ? embeddedText(titleVal) : undefined;
    const captionVal = options?.caption;
    this.caption = captionVal !== undefined ? embeddedText(captionVal) : undefined;
    this.expand = options?.expand ?? false;
    this.showHeader = options?.showHeader !== false;
    this.showFooter = options?.showFooter ?? false;
    this.showLines = options?.showLines ?? false;
    this.showEdge = options?.showEdge !== false;
    this.padding = normalizePadding(options?.padding ?? [0, 1, 0, 1]);
    this.style = options?.style ?? NULL_STYLE;
    this.headerStyle = options?.headerStyle ?? "table.header";
    this.footerStyle = options?.footerStyle ?? "table.footer";
    this.borderStyle = options?.borderStyle ?? NULL_STYLE;
    this.titleStyle = options?.titleStyle ?? "table.title";
    this.captionStyle = options?.captionStyle ?? "table.caption";
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
    const resolved = cells.map(embed);

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
    const frame = this.box?.substitute(options);
    const box = (this.showHeader ? frame : frame?.plainHeaded()) ?? null;
    const borderStyle = getStyle(options, this.borderStyle);
    const border = borderStyle.isNull ? undefined : borderStyle;

    // The one division of the width every row below is measured against.
    const geometry = this._geometry(this._outerWidth(options));
    const edge = geometry.edge === 1;

    // Title
    if (this.title) {
      yield* this._renderTitle(options, this.title, geometry.totalWidth, this.titleStyle, this.titleJustify);
    }

    // Top border
    if (box && this.showEdge) {
      yield* box.getTop(geometry.cellWidths, border, edge);
    }

    // Header row
    if (this.showHeader) {
      const headerCells = this._columns.map((c) => c.header as Renderable);
      yield* this._renderRow(options, headerCells, geometry, box, "head", border, this.headerStyle);

      // Header separator
      if (box) {
        yield* box.getRow(geometry.cellWidths, "head", border, edge);
      }
    }

    // Data rows
    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx]!;
      const rowCells = this._columns.map((_, colIdx) => row.cells[colIdx] ?? embeddedText(undefined));

      const rowStyle = this.rowStyles.length > 0
        ? this.rowStyles[rowIdx % this.rowStyles.length]!
        : NULL_STYLE;

      yield* this._renderRow(options, rowCells, geometry, box, "row", border, rowStyle);

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
      yield* this._renderRow(options, footerCells, geometry, box, "foot", border, this.footerStyle);
    }

    // Bottom border
    if (box && this.showEdge) {
      yield* box.getBottom(geometry.cellWidths, border, edge);
    }

    // Caption
    if (this.caption) {
      yield* this._renderTitle(options, this.caption, geometry.totalWidth, this.captionStyle, this.captionJustify);
    }
  }

  /**
   * [LAW:one-source-of-truth] Both ends of the range are widths the geometry
   * actually produced — the maximum from the demands as they stand, the
   * minimum from the same layout with every column asking for a single cell.
   * Neither end stretches or fills: both only spend cells an offer happens to
   * leave over, and a renderable reports the width its content wants rather
   * than the width it was offered. Letting either in made the table measure
   * `Infinity` against an unbounded offer, where `withBoundedWidth` needs a
   * natural width to fall back on — an expanding table, and an empty
   * `Table.grid()`.
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
    const laidOut = layoutTable(
      outerWidth,
      demands.map((demand) => ({ ...demand, fill: 0, stretch: false })),
      this.padding,
      frame,
    ).totalWidth;
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
        fill: 0,
        ratio: 0,
        stretch: false,
      })),
      this.padding,
      frame,
    ).totalWidth;
    return {
      minimum: Math.min(maximum, Math.max(tightest, cells(this.minWidth ?? 0))),
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
   * declared width, ratio, natural content — differ only in the demand they
   * produce, and `expand` only in its `stretch`. They are resolved once, here, into uniform data, so
   * `layoutTable` runs the same apportionment for every table and no sizing
   * mode gets its own path through the width division.
   */
  private _columnDemands(): ColumnDemand[] {
    return this._columns.map((col, index) => {
      if (col.width !== undefined) {
        // [LAW:single-enforcer] floored where it is parsed, the same rule
        // `normalizePadding` applies to a negative padding side.
        const declared = demandCells(col.width);
        return { reserved: declared, want: declared, weight: 0, fill: 0, ratio: 0, stretch: false };
      }
      // A flexible column takes its share of whatever the bounded columns
      // leave; every other column asks for its natural width, whether or not a
      // neighbour is flexible. The split is the reference's —
      // `fixed_widths = [0 if column.flexible else _range.maximum ...]` — with
      // one divergence: Rich splits by ratio only when the table expands, and
      // here a ratio is honoured either way. Its bounded part is its floor —
      // the reference's `column.min_width or 1` — bid for in cells like any
      // content column, so a squeezed table still pays a declared `minWidth`.
      const share = columnShare(col);
      if (share > 0) {
        const floor = Math.max(1, demandCells(col.minWidth ?? 0));
        return { reserved: 0, want: floor, weight: floor, fill: 0, ratio: share, stretch: false };
      }
      const widest = this._widestCell(col, index);
      const natural = demandCells(this._bounded(col, widest ?? 1));
      // `expand` is a stretch rather than a larger want: the column still
      // competes for its natural width like any other, and only the cells left
      // once every column has that are shared out. A larger want looks
      // equivalent and is not — it lets a one-cell column claim cells while its
      // neighbour is still truncated. The stretch weighs by width, so the
      // widest column grows most, which is what keeps a `Progress` bar from
      // getting no more of the slack than its percentage label.
      //
      // One deliberate divergence: Rich stretches declared-width columns as
      // well, so `width: 6` under `expand` renders 21 cells wide — an option
      // quietly meaning something else, the defect rich-justify-0cr exists to
      // remove. A reservation's stretch is zero above.
      //
      // A column with no cell at all — no rows, and neither header nor footer
      // drawn — has nothing to size to, which is not sizing to nothing. The
      // reference measures it `Measurement(1, max_width)`: one cell of content,
      // and a maximum of the whole offer, so a rowless table fills it. Reading
      // "no cells" as zero sized it to a two-cell box instead. The one cell is
      // its want, so a `minWidth` is paid like any column's, and the offer is
      // its `fill`, held to its `maxWidth`.
      return {
        reserved: 0,
        want: natural,
        weight: natural,
        fill: widest === undefined ? demandCells(this._bounded(col, UNBOUNDED)) : 0,
        ratio: 0,
        stretch: this.expand,
      };
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
    for (const row of this._rows) yield row.cells[index] ?? embeddedText(undefined);
    if (this.showFooter) yield col.footer;
  }

  /**
   * The widest cell in a column, or `undefined` when the column has no cell to
   * measure. Zero is a column whose cells draw nothing — a gutter asks for its
   * padding and nothing else — and is not the same answer.
   * [LAW:types-are-the-program]
   */
  private _widestCell(col: Column, index: number): number | undefined {
    let widest: number | undefined;
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
      widest = Math.max(
        widest ?? 0,
        cell instanceof RichText ? cellLen(cell.plain) : cellLen(String(cell)),
      );
    }
    return widest;
  }

  /**
   * A natural width held to the column's own `minWidth`/`maxWidth`.
   *
   * A bound is a count of cells, read by the rule every width is read by: NaN
   * and a negative are zero cells, so a NaN floor bounds nothing and a NaN
   * ceiling is a ceiling of zero, as `width: NaN` is. A bare `Math.max` returns
   * NaN instead, and the column vanishes. [LAW:one-source-of-truth]
   */
  private _bounded(col: Column, natural: number): number {
    return Math.min(
      Math.max(natural, cells(col.minWidth ?? 0)),
      cells(col.maxWidth ?? Infinity),
    );
  }

  private *_renderRow(
    options: RenderOptions,
    cells: Renderable[],
    geometry: TableGeometry,
    box: Box | null,
    level: RowLevel,
    border: Style | undefined,
    ownStyle: string | Style,
  ): Iterable<Segment> {
    const { padLeft, padRight, columns } = geometry;
    const rowStyle = getStyle(options, ownStyle);

    // [LAW:dataflow-not-control-flow] Header, body and footer share this path;
    // the level crosses as a value the box answers with glyphs, not a branch.
    const frame = box?.getContentChars(level);

    // Render each cell onto the canvas the geometry gave its column. Columns
    // the width could not seat are absent from `columns` and so are never
    // rendered at all.
    const cellLines: Segment[][][] = columns.map((cellWidth, index) => {
      const col = this._columns[index]!;
      const cell = cells[index] ?? embed("");
      // The render's own options with the column's canvas laid over them, so a
      // cell resolves its style names against the same theme as the table. The
      // table owns the row's height: a cell inherits none, as the reference's
      // `height=None` has it.
      const segs = [...cell.render({
        ...options,
        maxWidth: cellWidth,
        justify: col.justify,
        overflow: col.overflow,
        noWrap: col.noWrap,
        height: undefined,
      })];
      return Segment.splitAndCropLines(segs, cellWidth);
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
    options: RenderOptions,
    text: RichText,
    tableWidth: number,
    ownStyle: string | Style,
    justify: "left" | "center" | "right" | "full",
  ): Iterable<Segment> {
    const style = getStyle(options, ownStyle);
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
    const rendered = [...source.render({
      ...options,
      maxWidth: tableWidth,
      justify,
      overflow: undefined,
      noWrap: false,
      height: undefined,
    })];

    // Every line the text has, because that is what the reference renders — a
    // title of "one\ntwo" occupies two lines there. Taking only the first
    // dropped the rest with no truncation mark.
    for (const line of Segment.splitLines(rendered)) {
      yield* Segment.applyStyle(line, titleStyle);
      yield Segment.line();
    }
  }

}
