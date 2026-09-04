/**
 * Padding — wraps a renderable with whitespace padding on all four sides.
 */

import { Segment } from "../core/segment.js";
import { cellCount } from "../core/cells.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth, withCellWidth } from "../core/protocol.js";

export type PaddingDimensions =
  | number
  | [number, number]
  | [number, number, number, number];

/**
 * Parses the shapes a caller may write padding in — one number, a vertical/
 * horizontal pair, or all four sides — into the four-sided form every
 * renderable indexes by, flooring each side at zero.
 *
 * [LAW:parse-dont-validate] This is the one crossing between the public
 * padding vocabulary and the internal tuple, which is why the floor lives
 * here and nowhere downstream: past this point `" ".repeat(left)` is safe in
 * any renderable without asking what the caller passed. A negative side used
 * to reach the renderers, where `Panel` drew content rows wider than its own
 * border and `Table` threw outright.
 */
export function normalizePadding(
  padding: PaddingDimensions,
): [number, number, number, number] {
  // A padding side is a count of cells like any other, so it is parsed by the
  // same rule rather than by a second copy of it: a fractional side reaches
  // `" ".repeat`, which truncates, while the rows around it are measured
  // arithmetically — so the padding and the border disagree and the frame
  // breaks. `cellCount`'s header carries why the comparison, not `Math.max`.
  const side = cellCount;
  const sides: readonly [number, number, number, number] =
    typeof padding === "number"
      ? [padding, padding, padding, padding]
      : padding.length === 2
        ? [padding[0], padding[1], padding[0], padding[1]]
        : padding;
  return [side(sides[0]), side(sides[1]), side(sides[2]), side(sides[3])];
}

/** The three spans of a padded row, summing to exactly the requested width. */
interface PaddingGeometry {
  readonly left: number;
  readonly contentWidth: number;
  readonly right: number;
}

/**
 * Divides the requested width once into the three spans a padded row is made
 * of, in the order they are worth spending cells on.
 *
 * The three used to be derived separately and disagree where it matters:
 * `render` took the canvas as `Math.max(1, maxWidth - left - right)`, which
 * clamps *up*, so a padding of 1 inside a 2-cell request drew 3-cell content
 * rows beside 2-cell blank rows — an open frame the terminal then soft-wraps.
 * Content takes its first cell before padding takes any, for the reason
 * `layoutPanel` gives: a squeeze should cost you the decoration, not the thing
 * being decorated.
 */
function layoutPadding(
  outerWidth: number,
  leftWanted: number,
  rightWanted: number,
): PaddingGeometry {
  let budget: number = cellCount(outerWidth);
  const take = (want: number): number => {
    const got = Math.min(want, budget);
    budget -= got;
    return got;
  };

  const firstContentCell = take(1);
  const left = take(leftWanted);
  const right = take(rightWanted);

  return { left, contentWidth: firstContentCell + budget, right };
}

/** The full width of a padded row — the division, added back up. */
function rowWidth(geometry: PaddingGeometry): number {
  return geometry.left + geometry.contentWidth + geometry.right;
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

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    const geometry = layoutPadding(options.maxWidth, this.left, this.right);

    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: geometry.contentWidth,
    };

    const segments = [...this.renderable.render(innerOptions)];
    const lines = Segment.splitLines(segments);

    const style = this.style.isNull ? undefined : this.style;
    // Zero-length spans need no branch to suppress: the wire boundary drops
    // empty segments, so a padding the width could not afford emits nothing.
    const leftPad = new Segment(" ".repeat(geometry.left), style);
    const rightPad = new Segment(" ".repeat(geometry.right), style);
    const blankLine = new Segment(" ".repeat(rowWidth(geometry)), style);

    for (let i = 0; i < this.top; i++) {
      yield blankLine;
      yield Segment.line();
    }

    for (const line of lines) {
      yield leftPad;
      // `expand` is the pad half of this call; the crop half is unconditional,
      // because a child that ignored the canvas it was handed (a Table at its
      // natural width) would otherwise burst the padding around it.
      yield* Segment.adjustLineLength(
        line,
        geometry.contentWidth,
        style,
        this.expand,
      );
      yield rightPad;
      yield Segment.line();
    }

    for (let i = 0; i < this.bottom; i++) {
      yield blankLine;
      yield Segment.line();
    }
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    const options = withCellWidth(rawOptions);
    const geometry = layoutPadding(options.maxWidth, this.left, this.right);
    const overhead = geometry.left + geometry.right;

    if (isMeasurable(this.renderable)) {
      const measurement = Measurement.get(
        { ...options, maxWidth: geometry.contentWidth },
        this.renderable,
      );
      // The ceiling is what was offered, and it wins over what the child asks
      // for: a range whose floor sits above its own ceiling — this returned
      // {8, 8} for three cells of padding inside a two-cell offer — is one no
      // parent layout can divide.
      const maximum = Math.min(options.maxWidth, measurement.maximum + overhead);
      return {
        minimum: Math.min(measurement.minimum + overhead, maximum),
        maximum,
      };
    }
    return { minimum: overhead, maximum: options.maxWidth };
  }
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}
