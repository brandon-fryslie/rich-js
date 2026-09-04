/**
 * Tree — hierarchical view with guide lines.
 */

import { Segment } from "../core/segment.js";
import { cellFit, cellLen, asCellCol } from "../core/cells.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { Measurement } from "../core/measure.js";

// Guide characters
const GUIDE_BRANCH = "├── ";
const GUIDE_LAST = "└── ";
const GUIDE_VERT = "│   ";
const GUIDE_SPACE = "    ";

// ASCII fallback
const GUIDE_BRANCH_ASCII = "+-- ";
const GUIDE_LAST_ASCII = "+-- ";
const GUIDE_VERT_ASCII = "|   ";

export interface TreeOptions {
  expanded?: boolean;
  hideRoot?: boolean;
  guide_style?: string | Style;
  style?: string | Style;
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

function toRenderable(label: string | RichText | Renderable): Renderable {
  if (typeof label === "string") return new RichText(label, { end: "" });
  if (label instanceof RichText) {
    // Ensure no trailing newline in tree labels
    const copy = label.copy();
    copy.end = "";
    return copy;
  }
  return label;
}

/** One emitted row: the guides that lead it, then the label that follows them. */
interface TreeRow {
  readonly guides: Array<[string, Style | undefined]>;
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
  readonly guideStyle: Style;
  readonly style: Style;

  constructor(
    label: string | RichText | Renderable,
    options?: TreeOptions,
  ) {
    this.label = toRenderable(label);
    this.children = [];
    this.expanded = options?.expanded !== false;
    this.hideRoot = options?.hideRoot ?? false;
    this.guideStyle = resolveStyle(options?.guide_style);
    this.style = resolveStyle(options?.style);
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
    for (const row of this._rows(options.asciiOnly ?? false, [], !this.hideRoot)) {
      yield* this._renderRow(options, row);
    }
  }

  /**
   * The tree walked into the rows it emits, one row per label, guides first.
   *
   * [LAW:one-source-of-truth] The walk that decides which rows exist and what
   * leads them is here and only here. `render` turns each row into segments and
   * `measure` reads each row's width off the same sequence, so the two cannot
   * come to disagree about how many rows there are or how wide the guides on
   * them run — which they would the moment a second walk existed.
   */
  private *_rows(
    ascii: boolean,
    prefixes: string[],
    showLabel: boolean,
  ): Iterable<TreeRow> {
    const guideStyle = this.guideStyle.isNull ? undefined : this.guideStyle;

    if (showLabel) {
      yield { guides: prefixes.map((p) => [p, guideStyle]), label: this.label };
    }

    if (!this.expanded) return;

    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i]!;
      const isLast = i === this.children.length - 1;
      const branch = ascii
        ? (isLast ? GUIDE_LAST_ASCII : GUIDE_BRANCH_ASCII)
        : (isLast ? GUIDE_LAST : GUIDE_BRANCH);
      const continuation = ascii
        ? (isLast ? GUIDE_SPACE : GUIDE_VERT_ASCII)
        : (isLast ? GUIDE_SPACE : GUIDE_VERT);

      // Child label with branch guide
      const childGuideStyle = child.guideStyle.isNull ? guideStyle : child.guideStyle;

      yield {
        guides: [...prefixes, branch].map((p) => [p, childGuideStyle]),
        label: child.label,
      };

      // Grandchildren with continuation prefix
      if (child.expanded && child.children.length > 0) {
        const grandPrefixes = [...prefixes, continuation];
        for (let j = 0; j < child.children.length; j++) {
          yield* child.children[j]!._rows(ascii, grandPrefixes, true);
        }
      }
    }
  }

  /**
   * One row of the tree: its guides, then its label in whatever width the
   * guides left.
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
   * depending on label renderables to invent trailing newlines.
   */
  private *_renderRow(
    options: RenderOptions,
    row: TreeRow,
  ): Iterable<Segment> {
    let left: number = options.maxWidth;
    for (const [text, style] of row.guides) {
      const piece = cellFit(text, asCellCol(left));
      if (piece.length > 0) yield new Segment(piece, style);
      left -= cellLen(piece);
    }
    yield* row.label.render({ ...options, maxWidth: left });
    yield Segment.line();
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
    for (const row of this._rows(parsed.asciiOnly ?? false, [], !this.hideRoot)) {
      const guideWidth = row.guides.reduce((sum, [text]) => sum + cellLen(text), 0);
      natural = Math.max(natural, guideWidth + labelWidth(parsed, row.label));
    }

    const maximum = Math.min(natural, ceiling);
    // A row is its guides plus at least one cell of label — but never more than
    // this tree turned out to want, or the floor would sit above its own ceiling.
    return { minimum: Math.min(4, maximum), maximum };
  }
}
