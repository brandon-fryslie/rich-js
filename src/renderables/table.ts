/**
 * Table — tabular data with headers, borders, auto-sizing, and alignment.
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, HEAVY_HEAD } from "../core/box.js";
import { RichText } from "../core/text.js";
import type { PaddingDimensions } from "./padding.js";
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

function normalizePadding(
  padding: PaddingDimensions | undefined,
): [number, number, number, number] {
  if (padding === undefined) return [0, 1, 0, 1];
  if (typeof padding === "number") return [padding, padding, padding, padding];
  if (padding.length === 2) return [padding[0], padding[1], padding[0], padding[1]];
  return padding;
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
    this.padding = normalizePadding(options?.padding);
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

    // Calculate column widths
    const totalWidth = this.tableWidth ?? (this.expand ? options.maxWidth : undefined);
    const colWidths = this._calculateWidths(options, totalWidth);
    const tableActualWidth = this._totalTableWidth(colWidths, box);
    const [_padTop, padRight, _padBottom, padLeft] = this.padding;

    // Title
    if (this.title) {
      yield* this._renderTitle(this.title, tableActualWidth, this.titleStyle, this.titleJustify);
    }

    // Top border
    if (box && this.showEdge) {
      yield* box.getTop(colWidths.map((w) => w + padLeft + padRight), border, true);
    }

    // Header row
    if (this.showHeader && this._columns.some((c) => c.header.hasContent)) {
      const headerCells = this._columns.map((c) => c.header as Renderable);
      yield* this._renderRow(headerCells, colWidths, box, border, this.headerStyle);

      // Header separator
      if (box) {
        yield* box.getRow(colWidths.map((w) => w + padLeft + padRight), "head", border, this.showEdge);
      }
    }

    // Data rows
    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx]!;
      const rowCells: Renderable[] = [];
      for (let colIdx = 0; colIdx < this._columns.length; colIdx++) {
        const cell = row.cells[colIdx];
        rowCells.push(toRenderable(cell));
      }

      const rowStyle = this.rowStyles.length > 0
        ? resolveStyle(this.rowStyles[rowIdx % this.rowStyles.length])
        : NULL_STYLE;

      yield* this._renderRow(rowCells, colWidths, box, border, rowStyle);

      // Row separator
      const showSep = this.showLines || row.endSection;
      if (showSep && box && rowIdx < this._rows.length - 1) {
        yield* box.getRow(colWidths.map((w) => w + padLeft + padRight), "row", border, this.showEdge);
      }
    }

    // Footer
    if (this.showFooter && this._columns.some((c) => c.footer)) {
      if (box) {
        yield* box.getRow(colWidths.map((w) => w + padLeft + padRight), "foot", border, this.showEdge);
      }
      const footerCells = this._columns.map((c) => (c.footer ?? new RichText("", { end: "" })) as Renderable);
      yield* this._renderRow(footerCells, colWidths, box, border, this.footerStyle);
    }

    // Bottom border
    if (box && this.showEdge) {
      yield* box.getBottom(colWidths.map((w) => w + padLeft + padRight), border, true);
    }

    // Caption
    if (this.caption) {
      yield* this._renderTitle(this.caption, tableActualWidth, this.captionStyle, this.captionJustify);
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const colWidths = this._calculateWidths(options);
    const total = this._totalTableWidth(colWidths, this.box);
    return {
      minimum: Math.max(this._columns.length * 2, this.minWidth ?? 0),
      maximum: Math.min(total, options.maxWidth),
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

  private _calculateWidths(options: RenderOptions, totalWidth?: number): number[] {
    const numCols = this._columns.length;
    if (numCols === 0) return [];

    const [_padTop, padRight, _padBottom, padLeft] = this.padding;
    const cellPad = padLeft + padRight;
    const borders = this.box
      ? (this.showEdge ? 2 : 0) + (numCols - 1)
      : 0;
    const availableWidth = (totalWidth ?? options.maxWidth) - borders - cellPad * numCols;

    const widths: number[] = new Array(numCols);

    // Fixed width columns first
    let remainingWidth = availableWidth;
    let flexCols = 0;

    for (let i = 0; i < numCols; i++) {
      const col = this._columns[i]!;
      if (col.width !== undefined) {
        widths[i] = col.width;
        remainingWidth -= col.width;
      } else {
        widths[i] = 0;
        flexCols++;
      }
    }

    // Distribute remaining width among flex columns
    if (flexCols > 0) {
      // Measure content to determine natural widths
      const naturalWidths: number[] = [];
      for (let i = 0; i < numCols; i++) {
        const col = this._columns[i]!;
        if (col.width !== undefined) {
          naturalWidths.push(col.width);
          continue;
        }
        let maxContent = cellLen(col.header.plain);
        for (const row of this._rows) {
          const cell = row.cells[i];
          const cellText = String(cell ?? "");
          maxContent = Math.max(maxContent, cellLen(cellText));
        }
        if (col.minWidth !== undefined) maxContent = Math.max(maxContent, col.minWidth);
        if (col.maxWidth !== undefined) maxContent = Math.min(maxContent, col.maxWidth);
        naturalWidths.push(maxContent);
      }

      // Check if ratio-based distribution applies
      const hasRatios = this._columns.some((c) => c.flexible);
      if (hasRatios) {
        const totalRatio = this._columns.reduce((s, c) => s + (c.ratio ?? 1), 0);
        for (let i = 0; i < numCols; i++) {
          if (this._columns[i]!.width !== undefined) continue;
          const ratio = this._columns[i]!.ratio ?? 1;
          widths[i] = Math.max(1, Math.floor(remainingWidth * ratio / totalRatio));
        }
      } else {
        // Distribute equally or by natural width
        const totalNatural = naturalWidths.reduce((s, w, i) =>
          this._columns[i]!.width !== undefined ? s : s + w, 0);

        for (let i = 0; i < numCols; i++) {
          if (this._columns[i]!.width !== undefined) continue;
          const natural = naturalWidths[i]!;
          if (totalNatural <= remainingWidth) {
            widths[i] = natural;
          } else {
            widths[i] = Math.max(1, Math.floor(remainingWidth * natural / totalNatural));
          }
        }
      }
    }

    return widths;
  }

  private _totalTableWidth(colWidths: number[], box: Box | null): number {
    const [_padTop, padRight, _padBottom, padLeft] = this.padding;
    const cellPad = padLeft + padRight;
    const contentWidth = colWidths.reduce((s, w) => s + w + cellPad, 0);
    const borders = box
      ? (this.showEdge ? 2 : 0) + (colWidths.length - 1)
      : 0;
    return contentWidth + borders;
  }

  private *_renderRow(
    cells: Renderable[],
    colWidths: number[],
    box: Box | null,
    border: Style | undefined,
    rowStyle: Style,
  ): Iterable<Segment> {
    const [_padTop, padRight, _padBottom, padLeft] = this.padding;

    // Render each cell and split into lines
    const cellLines: Segment[][][] = [];
    let maxLines = 1;

    for (let i = 0; i < this._columns.length; i++) {
      const col = this._columns[i]!;
      const cell = cells[i] ?? toRenderable("");
      const cellWidth = colWidths[i] ?? 1;

      const cellOpts: RenderOptions = {
        ...({ maxWidth: cellWidth }),
        justify: col.justify,
        overflow: col.overflow,
        noWrap: col.noWrap,
      };

      const segs = [...cell.render(cellOpts)];
      const lines = Segment.splitLines(segs);
      const adjusted = lines.map((line) =>
        Segment.adjustLineLength(line, cellWidth),
      );
      // Ensure at least one line
      const finalLines = adjusted.length > 0 ? adjusted : [[new Segment(" ".repeat(cellWidth))]];
      cellLines.push(finalLines);
      maxLines = Math.max(maxLines, finalLines.length);
    }

    // Render line by line
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      if (box && this.showEdge) {
        yield new Segment(box.left, border);
      }

      for (let colIdx = 0; colIdx < this._columns.length; colIdx++) {
        if (colIdx > 0 && box) {
          yield new Segment(box.vertical, border);
        }

        const colLines = cellLines[colIdx]!;
        const cellWidth = colWidths[colIdx] ?? 1;

        // Left padding
        if (padLeft > 0) yield new Segment(" ".repeat(padLeft));

        const line = colLines[lineIdx];
        if (line) {
          const adjusted = Segment.adjustLineLength(line, cellWidth);
          const styled = rowStyle.isNull ? adjusted : [...Segment.applyStyle(adjusted, rowStyle)];
          yield* styled;
        } else {
          yield new Segment(" ".repeat(cellWidth));
        }

        // Right padding
        if (padRight > 0) yield new Segment(" ".repeat(padRight));
      }

      if (box && this.showEdge) {
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

    if (textWidth >= tableWidth) {
      yield new Segment(plain.slice(0, tableWidth), titleStyle);
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
