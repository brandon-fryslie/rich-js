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
