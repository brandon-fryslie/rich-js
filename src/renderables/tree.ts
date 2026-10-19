/**
 * Tree — hierarchical view with guide lines.
 */

import { Segment } from "../core/segment.js";
import { cellFit, cellLen, asCellCol } from "../core/cells.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import { embed } from "./embed.js";
import type {
  Composite,
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle, render, stackedHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { Measurement } from "../core/measure.js";

/**
 * What one column of guide draws on one row: a branch to the child on this row
 * (`fork` when siblings follow it, `end` when it is the last), the rail an open
 * sibling list keeps (`continue`), or nothing (`space`).
 */
type GuideRole = "fork" | "end" | "continue" | "space";

/** The glyph each role is drawn with, in one weight of line. */
type GuideGlyphs = Readonly<Record<GuideRole, string>>;

/** Every glyph of every set is this wide, so a row's guides are as wide however they are drawn. */
const GUIDE_CELLS = 4;

const LIGHT_GUIDES: GuideGlyphs = { fork: "├── ", end: "└── ", continue: "│   ", space: "    " };
const HEAVY_GUIDES: GuideGlyphs = { fork: "┣━━ ", end: "┗━━ ", continue: "┃   ", space: "    " };
const DOUBLE_GUIDES: GuideGlyphs = { fork: "╠══ ", end: "╚══ ", continue: "║   ", space: "    " };
const ASCII_GUIDES: GuideGlyphs = { fork: "+-- ", end: "`-- ", continue: "|   ", space: "    " };

/**
 * The guide attributes a glyph set stands for, switched off on the guide itself
 * as Rich's `remove_guide_styles` does: a bold guide is drawn heavy, not bold.
 */
const REMOVE_GUIDE_STYLES = new Style({ bold: false, underline2: false });

const guideGlyphs = (glyphs: GuideGlyphs): string => Object.values(glyphs).join("");

/**
 * The glyphs a column of guide is drawn with, read off its resolved guide style
 * as Rich does: heavy when bold, double when underline2, light otherwise — and
 * ASCII whenever the terminal cannot draw the chosen set.
 */
function glyphsFor(options: RenderOptions, style: Style): GuideGlyphs {
  const weight = style.bold === true ? HEAVY_GUIDES : style.underline2 === true ? DOUBLE_GUIDES : LIGHT_GUIDES;
  return drawable(options, weight, ASCII_GUIDES, guideGlyphs);
}

export interface TreeOptions {
  expanded?: boolean;
  hideRoot?: boolean;
  guide_style?: string | Style;
  style?: string | Style;
}

/**
 * One column of guide on a row. A label taller than one line draws `first`
 * beside its first line and `rest` beside every line after it; a column an
 * ancestor opened has already settled, and draws `rest` on both.
 */
interface Guide {
  readonly first: GuideRole;
  readonly rest: GuideRole;
  /**
   * The guide styles of every node from the root down to the one whose children
   * this column joins, outermost first, as given — stacked at render, so a
   * deeper node's guide style refines its ancestors' rather than replacing
   * them, as in Rich. Left unresolved, with the glyphs it picks, because
   * `measure` walks the rows too, and a width needs no theme.
   */
  readonly styles: ReadonlyArray<string | Style>;
}

/**
 * What a label drew, as `Segment.splitRows` cuts it: a label that yields
 * nothing but carriers — a lifecycle not yet entered, under `frameAt` — draws
 * no row, and its carriers are kept so the tree still says when it changes.
 */
type Drawn = Readonly<ReturnType<typeof Segment.splitRows>>;

/** What a label drew when nothing was drawn. */
const NOTHING_DRAWN: Drawn = { lines: [], carriers: [] };

/**
 * A label drawn for its place in the tree: under `styles`, the stack its row
 * resolves, with `columns` of guide before it. The walk is handed one, so
 * `render` and `measure` read one walk each asking its own question of it.
 */
type DrawLabel = (label: Renderable, styles: ReadonlyArray<string | Style>, columns: number) => Drawn;

/** The cells a row with `columns` of guide leaves its label. */
const labelRoom = (options: RenderOptions, columns: number): number =>
  Math.max(0, options.maxWidth - columns * GUIDE_CELLS);

/**
 * `label` drawn in `width` cells, as both `render` and `measure` draw it, so
 * whether it draws a row is answered once. Cropped, so a label that ignores the
 * width it is handed cannot push the row past the offer the guides were fitted
 * into. No highlighter: a label is drawn plain, as Rich's `Tree` hands its
 * labels `highlight=False`.
 */
function drawLabel(options: RenderOptions, label: Renderable, width: number): Iterable<Segment> {
  const labelOptions = { ...options, highlight: false, maxWidth: width, height: stackedHeight(options.height) };
  return Segment.cropLines(render(label, labelOptions), width);
}

/** One label, what it drew, and the guides that lead each of its lines. */
interface TreeRow extends Drawn {
  readonly guides: readonly Guide[];
  readonly label: Renderable;
  /**
   * The styles of every node from the root down to this one, outermost first,
   * as given — stacked at render the way a guide's are, so a node's style
   * reaches every row beneath it and a deeper node's refines it, as in Rich.
   */
  readonly styles: ReadonlyArray<string | Style>;
}

/** How wide a label wants to be. */
function labelWidth(options: RenderOptions, label: Renderable): number {
  return Measurement.get(options, label).maximum;
}

/** Whether a row is drawn: a subtree with one takes a place among its siblings. */
const isDrawn = (row: Drawn): boolean => row.lines.length > 0;

export class Tree implements Renderable, Measurable, Composite {
  readonly label: Renderable;
  readonly children: Tree[];
  expanded: boolean;
  readonly hideRoot: boolean;
  readonly guideStyle: string | Style;
  readonly style: string | Style;

  constructor(
    label: string | RichText | Renderable,
    options?: TreeOptions,
  ) {
    this.label = embed(label);
    this.children = [];
    this.expanded = options?.expanded !== false;
    this.hideRoot = options?.hideRoot ?? false;
    this.guideStyle = options?.guide_style ?? NULL_STYLE;
    this.style = options?.style ?? NULL_STYLE;
  }

  add(label: string | RichText | Renderable, options?: TreeOptions): Tree {
    const child = new Tree(label, {
      guide_style: options?.guide_style,
      style: options?.style,
      expanded: options?.expanded,
    });
    this.children.push(child);
    return child;
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    const resolve = (styles: ReadonlyArray<string | Style>): Style =>
      Style.combine(styles.map((style) => getStyle(options, style)));
    // [LAW:single-enforcer] The row's width is divided in exactly one place,
    // here. Before this, each call site emitted its guides and then handed the
    // label `options` unchanged — the label was told it had the whole outer
    // width while the guides had already spent four cells of it, so a tree at
    // maxWidth 5 emitted rows of 9. That is the same defect Panel and Table
    // were fixed for, and the same fix: divide the requested width once and
    // let every part read its share off the division.
    //
    // The guides are cropped by `cellFit`, the label by `drawLabel`. The
    // node's style sits under the label's own, as Rich's `Styled` puts it, so
    // markup in the label still wins.
    const draw: DrawLabel = (label, styles, columns) =>
      Segment.splitRows([...Segment.applyStyle(drawLabel(options, label, labelRoom(options, columns)), resolve(styles))]);
    for (const row of this._walk(draw)) {
      yield* this._renderRow(options, resolve, row);
    }
  }

  // Every label `render` draws, from the same walk, handed a draw that yields
  // nothing: which labels the walk holds does not depend on what they draw.
  // Not `children`, which is the subtrees, as Rich names them.
  *contents(): Iterable<Renderable> {
    for (const row of this._walk(() => NOTHING_DRAWN)) yield row.label;
  }

  /**
   * The rows `render` and `measure` both read, entered in exactly one place so
   * the two cannot start the walk differently. A hidden root takes its own row
   * and the column its children hang from with it, as Rich does — its children
   * stand at the left edge, and its guide style still reaches their guides.
   */
  private _walk(draw: DrawLabel): TreeRow[] {
    return this.hideRoot
      ? this._subtrees(0, draw, [this.guideStyle], [this.style]).flat()
      : this._rows(0, draw, [], []);
  }

  /**
   * This node's subtree walked into the rows it emits, one row per label,
   * guides first, each guide column counted from this node.
   *
   * [LAW:one-source-of-truth] The walk that decides which rows exist and what
   * leads them is here and only here. `render` turns each row into segments and
   * `measure` reads each row's width off the same sequence, so the two cannot
   * come to disagree about how many rows there are or how wide the guides on
   * them run — which they would the moment a second walk existed.
   *
   * [LAW:dataflow-not-control-flow] Every node, at every depth, is walked by
   * this one recursion: each child's rows get a branch column of their own,
   * settled below the first of them drawn, so no depth is drawn by a rule of
   * its own. A node's style and its guide style are handed down the same way,
   * as one more entry on the stack its ancestors built.
   *
   * The branch is chosen once every child is drawn: a subtree that draws no row
   * takes no place among its siblings, so the last one that draws a row ends
   * the branch, and the branch stands on a subtree's first drawn row — a child
   * that drew nothing above children that did leaves them on its branch, not
   * the sibling's before it. Rich chooses it from the children alone, and
   * draws a fork over a last child that drew nothing — an element not yet
   * arrived, or gone.
   */
  private _rows(
    columns: number,
    draw: DrawLabel,
    inheritedGuideStyles: ReadonlyArray<string | Style>,
    inheritedStyles: ReadonlyArray<string | Style>,
  ): TreeRow[] {
    const styles = [...inheritedStyles, this.style];
    const guideStyles = [...inheritedGuideStyles, this.guideStyle];
    const own: TreeRow = { guides: [], label: this.label, styles, ...draw(this.label, styles, columns) };
    const subtrees = this._subtrees(columns + 1, draw, guideStyles, styles);
    const firsts = subtrees.map((rows) => rows.findIndex(isDrawn));
    const last = firsts.reduce((found, first, i) => (first >= 0 ? i : found), -1);
    const branched = subtrees.flatMap((rows, i) => {
      const branch: Guide = i < last
        ? { first: "fork", rest: "continue", styles: guideStyles }
        : { first: "end", rest: "space", styles: guideStyles };
      const settled: Guide = { ...branch, first: branch.rest };
      return rows.map((row, r) => ({ ...row, guides: [r === firsts[i] ? branch : settled, ...row.guides] }));
    });
    return [own, ...branched];
  }

  /** Each of this node's children walked into its rows, `columns` of guide before each child's own. */
  private _subtrees(
    columns: number,
    draw: DrawLabel,
    guideStyles: ReadonlyArray<string | Style>,
    styles: ReadonlyArray<string | Style>,
  ): TreeRow[][] {
    const children = this.expanded ? this.children : [];
    return children.map((child) => child._rows(columns, draw, guideStyles, styles));
  }

  /**
   * One row of the tree: each of the label's lines led by the guides, and the
   * carriers of a label that drew no row passed on with no row around them.
   *
   * [LAW:single-enforcer] Tree owns its row boundaries here rather than
   * depending on label renderables to invent trailing newlines: the label's
   * output is cut into lines and every line ends where Tree ends it. A label
   * that emits nothing — one left no column, say — has no row, and one
   * that ends in a newline of its own gets the blank row that line is, as in
   * Rich — padded to the label's width when the label is justified.
   *
   * The node's background alone reaches under the guides, so a row with a
   * background is filled from its first guide to the end of its label.
   */
  private *_renderRow(
    options: RenderOptions,
    resolve: (styles: ReadonlyArray<string | Style>) => Style,
    row: TreeRow,
  ): Iterable<Segment> {
    const style = resolve(row.styles);
    const drawn = row.guides.map((guide) => {
      const guideStyle = resolve(guide.styles);
      return {
        glyphs: glyphsFor(options, guideStyle),
        style: style.backgroundStyle.add(guideStyle).add(REMOVE_GUIDE_STYLES),
      };
    });
    yield* row.carriers;
    const lines = row.lines;
    for (let i = 0; i < lines.length; i++) {
      let left: number = options.maxWidth;
      for (let g = 0; g < row.guides.length; g++) {
        const { glyphs, style: guideStyle } = drawn[g]!;
        const piece = cellFit(glyphs[i === 0 ? row.guides[g]!.first : row.guides[g]!.rest], asCellCol(left));
        if (piece.length > 0) yield new Segment(piece, guideStyle);
        left -= cellLen(piece);
      }
      yield* lines[i]!;
      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    // The ceiling is parsed for the same reason the rows are: an unparsed NaN
    // ceiling yields a range no parent layout can divide.
    const parsed = withCellWidth(options);
    const ceiling: number = parsed.maxWidth;

    // The widest row the walk emits, not the offer. Reported as the offer, a
    // tree told any parent that asked "I want all of it" — so `Panel` in fit
    // mode drew a 40-cell frame around nine cells of tree, and an unbounded
    // offer came back unbounded. A row the walk does not draw wants nothing,
    // and whether a label draws a row is asked at the width it wants, no more
    // than the offer leaves it: the width the tree, drawn at what this
    // reports, hands it. A label wants at least one column, as its row does,
    // because under one column nothing draws — a label of no width included.
    // A label with no width of its own under no offer cannot be asked at any
    // width; it takes its row, and the tree reports the unbounded width
    // `withBoundedWidth` refuses by name.
    const widths = new Map<Renderable, number>();
    const widthOf = (label: Renderable): number => {
      const width = widths.get(label) ?? Math.max(1, labelWidth(parsed, label));
      widths.set(label, width);
      return width;
    };
    const draw: DrawLabel = (label, _styles, columns) => {
      const width = Math.min(labelRoom(parsed, columns), widthOf(label));
      return Number.isFinite(width) ? Segment.splitRows([...drawLabel(parsed, label, width)]) : { lines: [[]], carriers: [] };
    };
    let natural = 0;
    for (const row of this._walk(draw).filter(isDrawn)) {
      natural = Math.max(natural, row.guides.length * GUIDE_CELLS + widthOf(row.label));
    }

    const maximum = Math.min(natural, ceiling);
    // A row is its guides plus at least one cell of label — but never more than
    // this tree turned out to want, or the floor would sit above its own ceiling.
    return { minimum: Math.min(4, maximum), maximum };
  }
}
