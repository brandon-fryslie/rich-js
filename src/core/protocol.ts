/**
 * Rendering protocol interfaces — Renderable, Measurable, RenderOptions.
 * [LAW:one-source-of-truth] These interfaces are the single authority for the rendering contract.
 */

import type { Segment } from "./segment.js";
import { cellCount } from "./cells.js";

export interface RenderOptions {
  /**
   * The cells this renderable may occupy. A count of cells, so a non-negative
   * integer — but the field is a plain `number` because it is public API and a
   * caller can write anything into it. `withCellWidth` is where that becomes
   * true rather than assumed; see its comment for why every renderable must
   * call it rather than trusting this declaration.
   */
  maxWidth: number;
  minWidth?: number;
  height?: number;
  maxHeight?: number;
  isTerminal?: boolean;
  encoding?: string;
  legacyWindows?: boolean;
  asciiOnly?: boolean;
  justify?: "left" | "center" | "right" | "full";
  overflow?: "fold" | "crop" | "ellipsis";
  noWrap?: boolean;
  highlight?: unknown;
  markup?: unknown;
}

/**
 * The options a renderable should work from: the caller's, with `maxWidth`
 * parsed into an actual count of cells.
 *
 * [LAW:parse-dont-validate] The stamp has to travel, which is the whole reason
 * this returns options rather than a number. Parsing `options.maxWidth` into a
 * local leaves the caller's raw value sitting in `options` for whatever the
 * renderable forwards it to — and every renderable forwards it, to a child's
 * `render`, to `Measurement.get`, to a nested layout. `Columns` was fixed that
 * way first and still threw `Invalid array length` on a NaN width, because it
 * handed the unparsed original to `Measurement.get` and got a NaN column count
 * back. Replace the field, and nothing downstream can see the number the
 * caller actually wrote.
 *
 * [LAW:single-enforcer] This is the width checkpoint for the render contract.
 * There is no second one: a renderable that re-derives its own answer is how
 * `Panel`, `Table`, `Tree`, `Columns` and `Layout` came to disagree about what
 * a NaN width means — one collapsed to a cell of garbage, two threw, one
 * ignored the request and emitted its full natural width.
 */
export function withCellWidth(options: RenderOptions): RenderOptions {
  return { ...options, maxWidth: cellCount(options.maxWidth) };
}

/**
 * The options a renderable should *lay out against*: `withCellWidth`, with an
 * unbounded offer resolved to the renderable's own natural width.
 *
 * [LAW:parse-dont-validate] `cellCount` cannot finish the job alone. It floors
 * a negative width and NaN to zero from the number alone, but `Infinity` is not
 * a quantity it can floor — the only finite answer is "as wide as this
 * renderable's content wants", which is a question about the renderable and not
 * about the number. So the parse is completed here, where the renderable is in
 * hand, and the stamped options travel exactly as `withCellWidth`'s do.
 *
 * [LAW:single-enforcer] One checkpoint for the whole rule, not one per
 * renderable. `Panel`, `Padding`, `Columns` and `Layout` each expand into the
 * width they are offered, and each independently reached `" ".repeat(Infinity)`
 * — Columns twice over, since its column *count* is derived from the width too
 * and `new Array(Infinity)` throws a different error again.
 *
 * The natural width comes from `measure`, which every one of them already
 * implements, and the recursion terminates because `measure` reports content
 * rather than the offer: `Panel.measure({maxWidth: Infinity})` is `{9, 9}` for
 * nine cells of content and frame, not `{9, Infinity}`.
 *
 * So this belongs at the top of `render` and never at the top of `measure`:
 * `measure` is the method being asked, and asking it through here would ask it
 * with itself. `measure` parses with `withCellWidth` and reports a natural
 * width of its own — that is the half of the contract that makes this half work.
 *
 * A `maximum` of `Infinity` means the renderable genuinely cannot answer. Two
 * ways in: it wraps a `Renderable` with no `measure`, so nothing in the tree
 * knows how wide the content wants to be; or something inside it asked for an
 * unbounded width of its own, as a `Table` column declared
 * `{ ratio: Infinity }` does. [LAW:no-silent-failure] Both are unanswerable
 * rather than zero, and saying so names the cause — where `String.repeat` and
 * `new Array` only ever name their own argument.
 */
export function withBoundedWidth(
  options: RenderOptions,
  self: Measurable,
): RenderOptions {
  const parsed = withCellWidth(options);
  if (Number.isFinite(parsed.maxWidth)) return parsed;

  const natural = self.measure(parsed).maximum;
  if (!Number.isFinite(natural)) {
    throw new RangeError(
      "maxWidth is unbounded and this renderable has no natural width to fall " +
        "back on: its content does not implement measure(), or something inside " +
        "it asked for an unbounded width of its own. Render it at a finite " +
        "width, or give the content a measure() that reports a finite maximum.",
    );
  }
  return { ...parsed, maxWidth: cellCount(natural) };
}

export interface Renderable {
  render(options: RenderOptions): Iterable<Segment>;
}

export interface Measurable {
  measure(options: RenderOptions): { minimum: number; maximum: number };
}

export function isRenderable(obj: unknown): obj is Renderable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "render" in obj &&
    typeof (obj as Renderable).render === "function"
  );
}

export function isMeasurable(obj: unknown): obj is Measurable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "measure" in obj &&
    typeof (obj as Measurable).measure === "function"
  );
}
