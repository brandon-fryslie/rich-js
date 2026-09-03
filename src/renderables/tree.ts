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
import { withCellWidth } from "../core/protocol.js";

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

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this._renderNode(options, [], !this.hideRoot);
  }

  private *_renderNode(
    options: RenderOptions,
    prefixes: string[],
    showLabel: boolean,
  ): Iterable<Segment> {
    const ascii = options.asciiOnly ?? false;
    const guideStyle = this.guideStyle.isNull ? undefined : this.guideStyle;

    if (showLabel) {
      yield* this._renderRow(options, prefixes.map((p) => [p, guideStyle]), this.label);
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
      const childGuideStyle = child.guideStyle.isNull ? guideStyle : (child.guideStyle.isNull ? undefined : child.guideStyle);

      yield* this._renderRow(
        options,
        [...prefixes, branch].map((p) => [p, childGuideStyle]),
        child.label,
      );

      // Render grandchildren with continuation prefix
      if (child.expanded && child.children.length > 0) {
        const grandPrefixes = [...prefixes, continuation];
        for (let j = 0; j < child.children.length; j++) {
          yield* child.children[j]!._renderNode(
            options,
            grandPrefixes,
            true,
          );
        }
      }
    }
  }

  /**
   * One row of the tree: its guides, then its label in whatever width the
   * guides left.
   *
   * [LAW:single-enforcer] Both callers route through here, so the requested
   * width is divided in exactly one place. Before this, each call site emitted
   * its guides and then handed the label `options` unchanged — the label was
   * told it had the whole outer width while the guides had already spent four
   * cells of it, so a tree at maxWidth 5 emitted rows of 9. That is the same
   * defect Panel and Table were fixed for, and the same fix: divide the
   * requested width once and let every part read its share off the division.
   *
   * [LAW:single-enforcer] Tree also owns its row boundaries here rather than
   * depending on label renderables to invent trailing newlines.
   */
  private *_renderRow(
    options: RenderOptions,
    guides: Array<[string, Style | undefined]>,
    label: Renderable,
  ): Iterable<Segment> {
    const parsed = withCellWidth(options);
    let left: number = parsed.maxWidth;
    for (const [text, style] of guides) {
      const piece = cellFit(text, asCellCol(left));
      if (piece.length > 0) yield new Segment(piece, style);
      left -= cellLen(piece);
    }
    yield* label.render({ ...parsed, maxWidth: left });
    yield Segment.line();
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    // A row is its guides plus at least one cell of label, and the ceiling is
    // parsed for the same reason the rows are: an unparsed NaN ceiling yields
    // a range no parent layout can divide.
    const ceiling: number = withCellWidth(options).maxWidth;
    return { minimum: Math.min(4, ceiling), maximum: ceiling };
  }
}
