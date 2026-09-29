/**
 * Tree — hierarchical view with guide lines.
 */

import { Segment } from "../core/segment.js";
import { cellFit, cellLen, asCellCol } from "../core/cells.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import { embed } from "./embed.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { getStyle, isMeasurable, stackedHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { Measurement } from "../core/measure.js";

/**
 * The glyphs one level of guide is drawn with: the branch on the row of the
 * child it leads to, and what stands in that column on every row after it —
 * the child's later label lines and all of its descendants. A child's `rest` is
 * the rail when siblings follow it and blank when it is the last.
 */
interface GuideGlyphs {
  readonly fork: { readonly first: string; readonly rest: string };
  readonly end: { readonly first: string; readonly rest: string };
}

const UNICODE_GUIDES: GuideGlyphs = {
  fork: { first: "├── ", rest: "│   " },
  end: { first: "└── ", rest: "    " },
};

const ASCII_GUIDES: GuideGlyphs = {
  fork: { first: "+-- ", rest: "|   " },
  end: { first: "`-- ", rest: "    " },
};

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
  readonly first: string;
  readonly rest: string;
  /**
   * The guide styles of every node from the root down to the one whose children
   * this column joins, outermost first, as given — stacked at render, so a
   * deeper node's guide style refines its ancestors' rather than replacing
   * them, as in Rich. Left unresolved because `measure` walks the rows too, and
   * a width needs no theme.
   */
  readonly styles: ReadonlyArray<string | Style>;
}

/** One label and the guides that lead each of its lines. */
interface TreeRow {
  readonly guides: readonly Guide[];
  readonly label: Renderable;
}

/**
 * How wide a label wants to be. A label with no `measure` cannot say, and the
 * offer is the honest stand-in — including when the offer is unbounded, which
 * is where `withBoundedWidth` reports it rather than guessing a number.
 */
function labelWidth(options: RenderOptions, label: Renderable): number {
  if (!isMeasurable(label)) return options.maxWidth;
  return Measurement.get(options, label).maximum;
}

export class Tree implements Renderable, Measurable {
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
    for (const row of this._walk(options)) {
      yield* this._renderRow(options, row);
    }
  }

  /**
   * The rows `render` and `measure` both read, entered in exactly one place so
   * the two cannot start the walk differently. A hidden root takes its own row
   * and the column its children hang from with it, as Rich does — its children
   * stand at the left edge, and its guide style still reaches their guides.
   */
  private _walk(options: RenderOptions): TreeRow[] {
    const rows = [...this._rows(options.asciiOnly ? ASCII_GUIDES : UNICODE_GUIDES, [], [])];
    return this.hideRoot ? rows.slice(1).map((row) => ({ ...row, guides: row.guides.slice(1) })) : rows;
  }

  /**
   * The tree walked into the rows it emits, one row per label, guides first.
   *
   * [LAW:one-source-of-truth] The walk that decides which rows exist and what
   * leads them is here and only here. `render` turns each row into segments and
   * `measure` reads each row's width off the same sequence, so the two cannot
   * come to disagree about how many rows there are or how wide the guides on
   * them run — which they would the moment a second walk existed.
   *
   * [LAW:dataflow-not-control-flow] Every node, at every depth, is walked by
   * this one recursion: its children get the columns above it, settled, plus a
   * branch of their own, so no depth is drawn by a rule of its own.
   */
  private *_rows(
    glyphs: GuideGlyphs,
    guides: readonly Guide[],
    inherited: ReadonlyArray<string | Style>,
  ): Iterable<TreeRow> {
    yield { guides, label: this.label };

    const children = this.expanded ? this.children : [];
    const styles = [...inherited, this.guideStyle];
    const above = guides.map((guide) => ({ ...guide, first: guide.rest }));
    for (let i = 0; i < children.length; i++) {
      const branch = i === children.length - 1 ? glyphs.end : glyphs.fork;
      yield* children[i]!._rows(glyphs, [...above, { ...branch, styles }], styles);
    }
  }

  /**
   * One row of the tree: its label in whatever width the guides left, each of
   * the label's lines led by the guides.
   *
   * [LAW:single-enforcer] The row's width is divided in exactly one place, here.
   * Before this, each call site emitted its guides and then handed the label
   * `options` unchanged — the label was told it had the whole outer width while
   * the guides had already spent four cells of it, so a tree at maxWidth 5
   * emitted rows of 9. That is the same defect Panel and Table were fixed for,
   * and the same fix: divide the requested width once and let every part read
   * its share off the division. `options` arrives parsed from `render`.
   *
   * [LAW:single-enforcer] Tree also owns its row boundaries here rather than
   * depending on label renderables to invent trailing newlines: the label's
   * output is cut into lines and every line ends where Tree ends it. A label
   * that emits nothing still holds its row, and one that ends in a newline of
   * its own does not add a blank one.
   */
  private *_renderRow(
    options: RenderOptions,
    row: TreeRow,
  ): Iterable<Segment> {
    const styles = row.guides.map((guide) => Style.combine(guide.styles.map((style) => getStyle(options, style))));
    const width = Math.max(0, options.maxWidth - row.guides.reduce((sum, guide) => sum + cellLen(guide.first), 0));
    // The guides are cropped by `cellFit`; the label is cropped too, so a label
    // that ignores the width it is handed cannot push the row past the offer the
    // guides were fitted into.
    const lines = Segment.splitLines(
      Segment.cropLines(row.label.render({ ...options, maxWidth: width, height: stackedHeight(options.height) }), width),
    );
    if (lines.length === 0) lines.push([]);
    for (let i = 0; i < lines.length; i++) {
      let left: number = options.maxWidth;
      for (let g = 0; g < row.guides.length; g++) {
        const piece = cellFit(i === 0 ? row.guides[g]!.first : row.guides[g]!.rest, asCellCol(left));
        if (piece.length > 0) yield new Segment(piece, styles[g]);
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
    // offer came back unbounded.
    let natural = 0;
    for (const row of this._walk(parsed)) {
      const guideWidth = row.guides.reduce((sum, guide) => sum + cellLen(guide.first), 0);
      natural = Math.max(natural, guideWidth + labelWidth(parsed, row.label));
    }

    const maximum = Math.min(natural, ceiling);
    // A row is its guides plus at least one cell of label — but never more than
    // this tree turned out to want, or the floor would sit above its own ceiling.
    return { minimum: Math.min(4, maximum), maximum };
  }
}
