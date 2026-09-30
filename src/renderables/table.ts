/**
 * Table — tabular data with headers, borders, auto-sizing, and alignment.
 */

import { cellCount as cells } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, HEAVY_HEAD } from "../core/box.js";
import type { RowLevel } from "../core/box.js";
import { RichText } from "../core/text.js";
import { EmbeddedText, embed } from "./embed.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import { exactWeights, ratioDistribute } from "./ratio.js";
import type {
  Renderable,
  Measurable,
  OverflowMethod,
  RenderOptions,
} from "../core/protocol.js";
import { getStyle, stackedHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { Measurement } from "../core/measure.js";

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
 *
 * `pad` is the padding the column draws either side of its content, already
 * reduced by `collapsePadding` and `padEdge`. `floor` is the part of `want`
 * that is Rich's `_range.maximum or 1`: the one cell a column with nothing at
 * all to draw is given so it does not vanish. It competes like any other cell,
 * and a squeezed table hands it back — Rich re-measures a collapsed table's
 * columns with `maximum or 0`.
 */
interface ColumnDemand {
  readonly reserved: number;
  readonly want: number;
  readonly weight: number;
  readonly fill: number;
  readonly ratio: number;
  readonly stretch: boolean;
  readonly pad: readonly [left: number, right: number];
  readonly floor: number;
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

/** `n` cells of padding, as nothing at all when `n` is zero. */
const blank = (n: number): Segment[] => (n > 0 ? [new Segment(" ".repeat(n))] : []);

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
 * The weights are read as whole numbers in one proportion (`exactWeights`) and
 * everything after is integer division.
 */
function distribute(total: number, demands: readonly Bid[]): number[] {
  const granted: number[] = demands.map(() => 0);
  const bidders = demands.flatMap((demand, index) =>
    demand.weight > 0 && demand.want > 0 ? [{ index, demand }] : [],
  );
  const weights = exactWeights(bidders.map(({ demand }) => demand.weight));
  let open = bidders.map(({ index, demand }, slot) => ({
    index,
    want: BigInt(demand.want),
    weight: weights[slot]!,
  }));
  const sum = (values: readonly bigint[]): bigint =>
    values.reduce((acc, value) => acc + value, 0n);
  // A budget past every open want grants each its want either way, and that
  // bound is what keeps an unbounded offer — `Infinity` is a legal outer width
  // — out of integer arithmetic that cannot hold it.
  const wantSum = sum(open.map(({ want }) => want));
  let remaining = total >= wantSum ? wantSum : BigInt(Math.max(0, total));

  while (open.length > 0 && remaining > 0n) {
    const weightSum = sum(open.map(({ weight }) => weight));
    const capped = open.filter(({ want, weight }) => remaining * weight >= want * weightSum);
    if (capped.length === 0) break;
    for (const { index, want } of capped) {
      granted[index] = Number(want);
      remaining -= want;
    }
    open = open.filter((bid) => !capped.includes(bid));
  }

  if (open.length > 0 && remaining > 0n) {
    const weightSum = sum(open.map(({ weight }) => weight));
    const products = open.map(({ weight }) => remaining * weight);
    const whole = products.map((product) => product / weightSum);
    const fraction = products.map((product) => product % weightSum);
    let residue = remaining - sum(whole);

    // The cells the shares left as fractions go to the largest fraction first,
    // ties to the leftmost column, so the total lands exactly on `remaining`.
    // `Number` of a nonzero difference is never 0, so the sign is exact.
    const byFraction = open
      .map((_, slot) => slot)
      .sort((a, b) => Number(fraction[b]! - fraction[a]!) || a - b);
    for (const slot of byFraction) {
      if (residue <= 0n) break;
      whole[slot]!++;
      residue--;
    }

    open.forEach(({ index }, slot) => {
      granted[index] = Number(whole[slot]!);
    });
  }

  return granted;
}

/**
 * The most padding every column can have alike: each side is granted
 * `min(want, level)`, and `level` is the highest those grants fit `budget` at.
 * A padding level is bought for every column at once or not at all, so a
 * budget too small for everyone's padding leaves it uneven by no column.
 */
function padLevel(wants: readonly number[], budget: number): number {
  const sorted = [...wants].sort((a, b) => a - b);
  let left = budget;
  for (const [rank, want] of sorted.entries()) {
    const sharing = sorted.length - rank;
    if (want * sharing > left) return Math.floor(left / sharing);
    left -= want;
  }
  return sorted.at(-1) ?? 0;
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
  /** Padding either side of each rendered column's content. */
  readonly padLeft: readonly number[];
  readonly padRight: readonly number[];
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
  frame: TableFrame,
): TableGeometry {
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

  // Padding is bought one side at a time, to one level across every seated
  // column (`padLevel`), so no column is padded while another that wants the
  // same padding goes without.
  const seatedDemands = demands.slice(0, seated);
  const takeLevelled = (wants: readonly number[]): number[] => {
    const level = padLevel(wants, budget);
    return wants.map((want) => take(Math.min(want, level)));
  };
  const padLeft = takeLevelled(seatedDemands.map((demand) => demand.pad[0]));
  const padRight = takeLevelled(seatedDemands.map((demand) => demand.pad[1]));

  // Reservations are paid in column order, each already holding the cell the
  // seating pass gave it. A budget too small to cover them all runs out
  // partway, which costs the trailing columns their width but never costs the
  // table its frame.
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
  // already holds with its padding: its natural width, since nothing is left
  // over while any column is short, or the cap a fill stopped at. The split is
  // the reference's `ratio_distribute(max_width - table_width, widths)`,
  // rounding included; the columns it runs over are this port's. A table that
  // does not expand has no column that stretches, and an empty list takes
  // nothing, which is how it stays narrower than the width it was offered. The
  // order is the reference's: Rich pads an expanding table only
  // once `table_width < max_width`, never while it is collapsing a column.
  const held = holding(wanted, filled, shared);
  const stretchers = seatedDemands.flatMap((demand, index) => (demand.stretch ? [index] : []));
  const stretches = ratioDistribute(
    // An unbounded offer is held to `UNBOUNDED`, this model's own infinity, as
    // `demandCells` holds a want: `Infinity` is not an integer to split.
    Math.min(budget - spent(wanted) - spent(filled) - spent(shared), UNBOUNDED),
    stretchers.map((index) => padLeft[index]! + held[index]! + padRight[index]!),
  );
  // A table that does not fit gives back each column's `floor`: Rich
  // re-measures a collapsed table's columns at the widths it gave them, and a
  // column with nothing to draw measures 0 there however many cells the collapse
  // left it. Those cells go unspent, as they do in Rich.
  const natural = demands.reduce(
    (sum, demand) => sum + demand.pad[0] + demand.want + demand.pad[1],
    frame.edge * 2 + Math.max(0, demands.length - 1) * frame.divider,
  );
  const squeezed = natural > outerWidth;
  const columns = held.map((width, index) =>
    squeezed ? width - Math.min(width, seatedDemands[index]!.floor) : width,
  );
  stretchers.forEach((index, slot) => {
    columns[index]! += stretches[slot]!;
  });
  const cellWidths = columns.map((width, index) => padLeft[index]! + width + padRight[index]!);

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
  overflow?: OverflowMethod;
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
  private _header!: EmbeddedText;
  private _footer!: EmbeddedText;
  headerStyle: string | Style;
  footerStyle: string | Style;
  style: string | Style;
  justify: "left" | "center" | "right" | "full";
  width: number | undefined;
  minWidth: number | undefined;
  maxWidth: number | undefined;
  ratio: number | undefined;
  noWrap: boolean;
  overflow: OverflowMethod;
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
   * The two stamped cells, stamped on assignment rather than at the constructor.
   * `Table.columns` hands out the live column and both fields are public, so a
   * constructor-only stamp held only until the first `columns[0].footer = mine`
   * — which installed content still owned by the caller into a slot every
   * reader below assumes `EmbeddedText` has been through. [LAW:parse-dont-validate] The setter
   * is the border, so the guarantee holds for the object's whole lifetime and
   * the constructor is one caller of it rather than the one place it is true.
   *
   * Absent and empty are the same header, and the same footer.
   * [LAW:types-are-the-program] Rich declares `footer: RenderableType = ""`, so
   * a column always has one and `show_footer` alone decides whether it is
   * drawn. Modelling the absence as `undefined` instead made "no column has a
   * footer" a state the render path could ask about — and it did, skipping the
   * row a caller had asked for. `EmbeddedText` already maps nothing onto empty,
   * which is why the setters take `undefined` rather than defaulting around it.
   */
  get header(): Renderable & Measurable {
    return this._header;
  }

  set header(content: string | RichText | undefined) {
    this._header = new EmbeddedText(content);
  }

  get footer(): Renderable & Measurable {
    return this._footer;
  }

  set footer(content: string | RichText | undefined) {
    this._footer = new EmbeddedText(content);
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
    // Shared, not copied: an `EmbeddedText` owns its content and never changes.
    col._header = this._header;
    col._footer = this._footer;
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
  collapsePadding?: boolean;
  padEdge?: boolean;
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
  private readonly _title: EmbeddedText | undefined;
  private readonly _caption: EmbeddedText | undefined;
  readonly expand: boolean;
  readonly showHeader: boolean;
  readonly showFooter: boolean;
  readonly showLines: boolean;
  readonly showEdge: boolean;
  readonly padding: [number, number, number, number];
  readonly collapsePadding: boolean;
  readonly padEdge: boolean;
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

  get title(): (Renderable & Measurable) | undefined {
    return this._title;
  }

  get caption(): (Renderable & Measurable) | undefined {
    return this._caption;
  }

  constructor(options?: TableOptions) {
    this._columns = [];
    this._rows = [];
    this.box = options?.box !== undefined ? options.box : HEAVY_HEAD;
    const titleVal = options?.title;
    this._title = titleVal !== undefined ? new EmbeddedText(titleVal) : undefined;
    const captionVal = options?.caption;
    this._caption = captionVal !== undefined ? new EmbeddedText(captionVal) : undefined;
    // A declared width is the table's size, not a ceiling on it: the
    // reference's `expand` is `self._expand or self.width is not None`, and a
    // port that sized to content inside it drew Rich code narrower than Rich.
    this.expand = (options?.expand ?? false) || options?.width !== undefined;
    this.showHeader = options?.showHeader !== false;
    this.showFooter = options?.showFooter ?? false;
    this.showLines = options?.showLines ?? false;
    this.showEdge = options?.showEdge !== false;
    this.padding = normalizePadding(options?.padding ?? [0, 1, 0, 1]);
    this.collapsePadding = options?.collapsePadding ?? false;
    this.padEdge = options?.padEdge ?? true;
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
    // The table's own `style` is the base its border style layers over, and
    // that is all it styles: the reference reads it as `table_style` for the
    // frame and nowhere else, so a cell is untouched by it.
    const borderStyle = getStyle(options, this.style).add(getStyle(options, this.borderStyle));
    const border = borderStyle.isNull ? undefined : borderStyle;

    // The one division of the width every row below is measured against.
    const outerWidth = this._outerWidth(options);
    const geometry = this._geometry(options, outerWidth);
    const edge = geometry.edge === 1;

    // Title
    if (this._title) {
      yield* this._renderTitle(options, this._title, geometry.totalWidth, this.titleStyle, this.titleJustify);
    }

    // Top border
    if (box && this.showEdge) {
      yield* box.getTop(geometry.cellWidths, border, edge);
    }

    // Every style a cell is drawn with, resolved once per render rather than
    // once per cell, as the reference's `_get_cells` does per column.
    const headerStyle = getStyle(options, this.headerStyle);
    const footerStyle = getStyle(options, this.footerStyle);
    const columnStyles = this._columns.map((c) => getStyle(options, c.style));
    const stripes = this.rowStyles.map((s) => getStyle(options, s));

    // Each row's padding above and below, by where it stands among every row
    // the table draws, header and footer included, as the reference counts them.
    const firstBody = this.showHeader ? 1 : 0;
    const lastRow = firstBody + this._rows.length + (this.showFooter ? 1 : 0) - 1;
    const rowPadding = (position: number) => this._rowPadding(position === 0, position === lastRow);

    // Header row
    if (this.showHeader) {
      const headerCells = this._columns.map((c) => c.header);
      const headerStyles = this._columns.map((c) => headerStyle.add(getStyle(options, c.headerStyle)));
      yield* this._renderRow(options, headerCells, headerStyles, NULL_STYLE, geometry, rowPadding(0), box, "head", border);

      // Header separator
      if (box) {
        yield* box.getRow(geometry.cellWidths, "head", border, edge);
      }
    }

    // Data rows
    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx]!;
      const rowCells = this._columns.map((_, colIdx) => row.cells[colIdx] ?? new EmbeddedText(undefined));

      const rowStyle = stripes[rowIdx % stripes.length] ?? NULL_STYLE;
      const cellStyles = columnStyles.map((s) => s.add(rowStyle));

      yield* this._renderRow(options, rowCells, cellStyles, rowStyle, geometry, rowPadding(firstBody + rowIdx), box, "row", border);

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
      const footerCells = this._columns.map((c) => c.footer);
      const footerStyles = this._columns.map((c) => footerStyle.add(getStyle(options, c.footerStyle)));
      yield* this._renderRow(options, footerCells, footerStyles, NULL_STYLE, geometry, rowPadding(lastRow), box, "foot", border);
    }

    // Bottom border
    if (box && this.showEdge) {
      yield* box.getBottom(geometry.cellWidths, border, edge);
    }

    // Caption
    if (this._caption) {
      yield* this._renderTitle(options, this._caption, geometry.totalWidth, this.captionStyle, this.captionJustify);
    }
  }

  /**
   * [LAW:one-source-of-truth] Both ends of the range are widths the geometry
   * actually produced — the maximum from the demands as they stand, the
   * minimum from the same layout with every column asking for a single cell.
   * Neither end stretches or fills into an offer: both only spend cells an
   * offer happens to leave over, and a renderable reports the width its content
   * wants rather than the width it was offered. A declared `width` is not an
   * offer, and the maximum reports it. Letting either in made the table measure
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
    const demands = this._columnDemands(options, outerWidth);
    // A declared width is the one stretch a measurement reports, because it is
    // a size the table was given rather than an offer it grew into — the
    // reference measures `self.width` as its maximum, so a `Panel` fitted round
    // a table declared at 40 is 44 wide there, not the table's content width.
    // It is laid out exactly as `render` lays it out, so the two cannot report
    // different widths; a declared width with nothing bounding it
    // (`width: Infinity` at an unbounded offer) has no size to report and falls
    // back to the content, as an unbounded `expand` does.
    const declared =
      this.tableWidth === undefined
        ? undefined
        : layoutTable(outerWidth, demands, frame).totalWidth;
    const laidOut =
      declared !== undefined && declared < UNBOUNDED
        ? declared
        : layoutTable(
            outerWidth,
            demands.map((demand) => ({ ...demand, fill: 0, stretch: false })),
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
        ...demand,
        reserved: 0,
        want: Math.min(1, demand.want),
        weight: 1,
        fill: 0,
        ratio: 0,
        stretch: false,
      })),
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

  private _geometry(options: RenderOptions, outerWidth: number): TableGeometry {
    return layoutTable(outerWidth, this._columnDemands(options, outerWidth), this._frame());
  }

  /**
   * [LAW:dataflow-not-control-flow] The three ways a column can be sized —
   * declared width, ratio, natural content — differ only in the demand they
   * produce, and `expand` only in its `stretch`. They are resolved once, here, into uniform data, so
   * `layoutTable` runs the same apportionment for every table and no sizing
   * mode gets its own path through the width division.
   *
   * Cells are measured against the width left once the frame is paid, as the
   * reference's `_measure_column` measures them. Padding and the floor are laid
   * over whichever sizing the column has: they are the same for all three.
   */
  private _columnDemands(options: RenderOptions, outerWidth: number): ColumnDemand[] {
    const frame = this._frame();
    const inner = {
      ...options,
      maxWidth: Math.max(0, outerWidth - frame.edge * 2 - frame.divider * Math.max(0, this._columns.length - 1)),
    };
    return this._columns.map((col, index) => {
      const pad = this._columnPadding(index);
      const sizing = this._columnSizing(col, index, inner);
      const floor = pad[0] + sizing.want + pad[1] === 0 ? 1 : 0;
      return { ...sizing, want: sizing.want + floor, pad, floor };
    });
  }

  private _columnSizing(
    col: Column,
    index: number,
    options: RenderOptions,
  ): Omit<ColumnDemand, "pad" | "floor"> {
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
    const widest = this._widestCell(col, index, options);
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
  }

  /**
   * The padding either side of column `index`'s content, and above and below
   * one row of cells: the reference's `get_padding`. `collapsePadding` lets a
   * cell's left padding and its row's bottom padding merge into the padding
   * beside and below them; `padEdge: false` drops every side that meets the
   * table's edge. Each side is the configured padding unless one of those two
   * reduces it.
   */
  private _columnPadding(index: number): readonly [left: number, right: number] {
    const [, right, , left] = this.padding;
    const first = index === 0;
    const last = index === this._columns.length - 1;
    const collapsed = this.collapsePadding && !first ? Math.max(0, left - right) : left;
    return [!this.padEdge && first ? 0 : collapsed, !this.padEdge && last ? 0 : right];
  }

  private _rowPadding(first: boolean, last: boolean): readonly [top: number, bottom: number] {
    const [top, , bottom] = this.padding;
    const collapsed = this.collapsePadding && !last ? Math.max(0, top - bottom) : bottom;
    return [!this.padEdge && first ? 0 : top, !this.padEdge && last ? 0 : collapsed];
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
    for (const row of this._rows) yield row.cells[index] ?? new EmbeddedText(undefined);
    if (this.showFooter) yield col.footer;
  }

  /**
   * The widest cell in a column, or `undefined` when the column has no cell to
   * measure. Zero is a column whose cells draw nothing — a gutter asks for its
   * padding and nothing else — and is not the same answer.
   * [LAW:types-are-the-program]
   */
  private _widestCell(col: Column, index: number, options: RenderOptions): number | undefined {
    let widest: number | undefined;
    for (const cell of this._columnCells(col, index)) {
      // The stamped cell, so the width a column asks for is the width its text
      // will occupy — measuring the raw value sized this column to
      // `[red]Solo[/red]`, fifteen cells for four cells of text.
      // [LAW:one-source-of-truth] Measured as the cell measures itself, so a
      // multi-line cell asks for its widest line and a `Panel` for its frame;
      // one that cannot measure itself asks for every cell there is, as in Rich.
      widest = Math.max(widest ?? 0, Measurement.get(options, cell).maximum);
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
    styles: Style[],
    rowStyle: Style,
    geometry: TableGeometry,
    [top, bottom]: readonly [number, number],
    box: Box | null,
    level: RowLevel,
    border: Style | undefined,
  ): Iterable<Segment> {
    const { padLeft, padRight, columns } = geometry;

    // [LAW:dataflow-not-control-flow] Header, body and footer share this path;
    // the level crosses as a value the box answers with glyphs, not a branch.
    const frame = box?.getContentChars(level);

    // A divider drawn in blanks is part of the row's stripe, so it carries the
    // row's background under the border's own style; one drawn in ink is the
    // frame's alone. Header and footer rows have no row style, as in the
    // reference, so their dividers are the border's either way.
    const divider = frame && (frame.vertical.trim() === ""
      ? new Segment(frame.vertical, rowStyle.backgroundStyle.add(border))
      : new Segment(frame.vertical, border));

    // Render each cell onto the canvas the geometry gave its column. Columns
    // the width could not seat are absent from `columns` and so are never
    // rendered at all.
    const cellLines: Segment[][][] = columns.map((cellWidth, index) => {
      const col = this._columns[index]!;
      const cell = cells[index] ?? embed("");
      // The render's own options with the column's canvas laid over them, so a
      // cell resolves its style names against the same theme as the table. A
      // table stacks its cells, so each is handed the table's rows as a
      // ceiling, never a region to fill — the `Height` contract's
      // `stackedHeight`, where the reference hands a cell `height=None`.
      // No highlighter: a cell's string is drawn plain, as Rich's column
      // `highlight=False` draws it.
      const segs = [...cell.render({
        ...options,
        highlighter: undefined,
        maxWidth: cellWidth,
        justify: col.justify,
        overflow: col.overflow,
        noWrap: col.noWrap,
        height: stackedHeight(options.height),
      })];
      // The padding above and below is part of the cell, as the reference's
      // `Padding` makes it: blank lines the cell's style covers.
      const padLine = (): Segment[] => [new Segment(" ".repeat(cellWidth))];
      return [
        ...Array.from({ length: top }, padLine),
        ...Segment.splitAndCropLines(segs, cellWidth),
        ...Array.from({ length: bottom }, padLine),
      ];
    });
    const maxLines = cellLines.reduce((most, lines) => Math.max(most, lines.length), 1);
    // How many blank lines stand above each cell's content. A header sits on
    // the row's floor, so its column labels line up over the data, and every
    // other row starts at the top — the reference forces both.
    const drop = cellLines.map((lines) => (level === "head" ? maxLines - lines.length : 0));

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      if (frame && geometry.edge === 1) {
        yield new Segment(frame.left, border);
      }

      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        if (colIdx > 0 && divider) {
          yield divider;
        }

        const cellWidth = columns[colIdx]!;
        const style = styles[colIdx]!;

        // A cell with fewer lines than the row contributes blanks, so every
        // column spans the same number of rows and the frame stays rectangular.
        const line = cellLines[colIdx]![lineIdx - drop[colIdx]!] ?? [new Segment(" ".repeat(cellWidth))];

        // The cell's style is the base its content's own spans layer over, and
        // it covers the whole cell — its left and right padding and its blank
        // lines too, as the reference's does — so a background fills the column
        // rather than sitting behind the text alone.
        yield* Segment.applyStyle(
          [...blank(padLeft[colIdx]!), ...line, ...blank(padRight[colIdx]!)],
          style.isNull ? undefined : style,
        );
      }

      if (frame && geometry.edge === 1) {
        yield new Segment(frame.right, border);
      }
      yield Segment.line();
    }
  }

  private *_renderTitle(
    options: RenderOptions,
    text: EmbeddedText,
    tableWidth: number,
    ownStyle: string | Style,
    justify: "left" | "center" | "right" | "full",
  ): Iterable<Segment> {
    const style = getStyle(options, ownStyle);
    const titleStyle = style.isNull ? undefined : style;

    // The table owns the canvas; the caller's text still says how it meets the
    // edge. A `RichText`'s own `justify` and `overflow` outrank the options
    // `render` is handed, so `titleJustify` would lose to a property the caller
    // may not know it set, and an `"ignore"` title would have no edge and run
    // straight through the frame. Every other method, and `noWrap`, cuts within
    // the bound, so those stay theirs. `text` hands back a copy to clear them
    // on. [LAW:one-source-of-truth]
    //
    // Never highlighted, and markup as the console says: Rich draws a title
    // and caption through `render_str(highlight=False)`.
    const source = text.text({ ...options, highlighter: undefined });
    source.justify = undefined;
    if (source.overflow === "ignore") source.overflow = undefined;

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
