/**
 * Tree — hierarchical view with guide lines.
 */

import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

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
      // Render prefix
      for (const prefix of prefixes) {
        yield new Segment(prefix, guideStyle);
      }
      // [LAW:single-enforcer] Tree owns its row boundaries explicitly instead
      // of depending on label renderables to invent trailing newlines.
      yield* this.label.render(options);
      yield Segment.line();
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

      // Render child label
      for (const prefix of prefixes) {
        yield new Segment(prefix, childGuideStyle);
      }
      yield new Segment(branch, childGuideStyle);
      yield* child.label.render(options);
      yield Segment.line();

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

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 4, maximum: options.maxWidth };
  }
}
