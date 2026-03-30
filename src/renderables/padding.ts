/**
 * Padding — wraps a renderable with whitespace padding on all four sides.
 */

import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable } from "../core/protocol.js";

export type PaddingDimensions =
  | number
  | [number, number]
  | [number, number, number, number];

function normalizePadding(
  padding: PaddingDimensions,
): [number, number, number, number] {
  if (typeof padding === "number") {
    return [padding, padding, padding, padding];
  }
  if (padding.length === 2) {
    return [padding[0], padding[1], padding[0], padding[1]];
  }
  return padding;
}

export class Padding implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly style: Style;
  readonly expand: boolean;

  constructor(
    renderable: Renderable,
    padding: PaddingDimensions,
    options?: { style?: string | Style; expand?: boolean },
  ) {
    const [top, right, bottom, left] = normalizePadding(padding);
    this.renderable = renderable;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
    this.style = resolveStyle(options?.style);
    this.expand = options?.expand !== false;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const maxWidth = options.maxWidth;
    const horizontalPad = this.left + this.right;
    const innerWidth = Math.max(1, maxWidth - horizontalPad);

    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: innerWidth,
    };

    const segments = [...this.renderable.render(innerOptions)];
    const lines = Segment.splitLines(segments);

    const style = this.style.isNull ? undefined : this.style;
    const leftPadStr = " ".repeat(this.left);
    const blankLine = " ".repeat(maxWidth);

    // Top padding
    for (let i = 0; i < this.top; i++) {
      yield new Segment(blankLine, style);
      yield Segment.line();
    }

    // Content lines with left/right padding
    for (const line of lines) {
      if (this.left > 0) yield new Segment(leftPadStr, style);
      yield* line;
      // Pad to fill remaining width
      const lineWidth = Segment.getLineLength(line);
      const remaining = this.expand
        ? innerWidth - lineWidth + this.right
        : this.right;
      if (remaining > 0) yield new Segment(" ".repeat(remaining), style);
      yield Segment.line();
    }

    // Bottom padding
    for (let i = 0; i < this.bottom; i++) {
      yield new Segment(blankLine, style);
      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const horizontalPad = this.left + this.right;
    if (isMeasurable(this.renderable)) {
      const measurement = Measurement.get(options, this.renderable);
      return {
        minimum: measurement.minimum + horizontalPad,
        maximum: measurement.maximum + horizontalPad,
      };
    }
    return { minimum: horizontalPad, maximum: options.maxWidth };
  }
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}
