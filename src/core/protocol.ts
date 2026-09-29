/**
 * Rendering protocol interfaces — Renderable, Measurable, RenderOptions.
 * [LAW:one-source-of-truth] These interfaces are the single authority for the rendering contract.
 */

import type { Segment } from "./segment.js";
import { cellCount } from "./cells.js";
import { DEFAULT_THEME, type Style, type StyleSyntaxError, type Theme } from "./style.js";
import type { ColorDepth } from "./color.js";

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
  /**
   * The rows this renderable may occupy. Absent, nothing limits them.
   */
  height?: Height;
  isTerminal?: boolean;
  encoding?: string;
  legacyWindows?: boolean;
  asciiOnly?: boolean;
  justify?: "left" | "center" | "right" | "full";
  overflow?: "fold" | "crop" | "ellipsis";
  noWrap?: boolean;
  highlight?: unknown;
  markup?: unknown;
  /**
   * The depth the output will be encoded at, `null` when it carries no colour.
   * A renderable choosing between two ways of drawing something — the strip's
   * arrow or its divider — decides on the colours the terminal will draw at
   * this depth, which at 256 colours or fewer are not the colours it was
   * handed. Absent means truecolor.
   */
  colorSystem?: ColorDepth | null;
  /**
   * The names a style string may use. A `Console` passes its own; absent, the
   * built-in defaults apply. Read it through `getStyle` rather than directly.
   */
  theme?: Theme;
  /**
   * Called each time a render degrades a style string it cannot parse to
   * unstyled, once per resolution — a style the render reads twice is reported
   * twice. Absent, the failure passes silently. A handler that throws makes
   * the render strict: the error leaves `render`.
   */
  onStyleError?: StyleErrorHandler;
  /**
   * Told of each owner that stamps its output (`core/anchor`) as it starts to
   * render, so the calls arrive in document order: a container's children in
   * the order it renders them, an owner before the owners nested in it. A
   * container forwards it by passing its options on, which every container
   * does. An owner rendered twice is told twice. A render made to measure is
   * not drawing and is not told (`measuring`).
   */
  onDraw?: (owner: object) => void;
}

/**
 * A vertical budget: a count of rows, and whether they are a region the
 * renderable stands in or a ceiling it stays under.
 *
 * `exact: true` is a region — a `Layout` pane, a full-screen frame. The output
 * is exactly `rows` tall. A renderable may fill the region — a layout divides
 * it, a frame can stretch to its last row — or ignore it and emit its natural
 * height; either way, whoever set the region shapes what comes back to it
 * (`fitHeight`). Setting a region is a promise to shape, so no renderable pads
 * or crops itself to one.
 *
 * `exact: false` is a ceiling — the terminal an inline print lands on. Content
 * keeps its natural height beneath it, and nothing pads up to the ceiling.
 * Output taller than the ceiling is its setter's to handle: an inline `Live`
 * applies its `verticalOverflow`, and a print lets the terminal scroll it.
 *
 * A renderable passing its whole space to one child must forward the budget
 * less the rows it draws itself, and of the same kind (`insetHeight`). One
 * stacking several children must hand each the rows as a ceiling
 * (`stackedHeight`): any one of them may use all of it, and none may claim it
 * as its region. Forwarded unchanged, a layout nested in a panel fills the
 * panel's whole region and the region's crop takes the panel's bottom border.
 *
 * [LAW:types-are-the-program] One field, because the fact is one count and one
 * bit about it. As two numbers, `height` and `maxHeight`, it admitted a region
 * taller than its ceiling and a region with no ceiling at all, and the one
 * reader in the library resolved them `maxHeight ?? height` — the ceiling ahead
 * of the region it contains.
 *
 * There is no vertical `Measurable`. A parent chooses widths from its
 * children's measurements before any of them renders; nothing chooses rows
 * that way, because a renderable's height is a consequence of the width it
 * renders at. Rendering and counting the lines is the measurement.
 */
export interface Height {
  readonly rows: number;
  readonly exact: boolean;
}

/**
 * The budget a renderable hands the one child filling its space: its own, less
 * the `rows` it draws itself, and of the same kind.
 */
export function insetHeight(height: Height | undefined, rows: number): Height | undefined {
  return height && { rows: cellCount(height.rows - rows), exact: height.exact };
}

/**
 * The budget a renderable hands each of several children it stacks: its rows,
 * as a ceiling.
 */
export function stackedHeight(height: Height | undefined): Height | undefined {
  return height && { rows: cellCount(height.rows), exact: false };
}

/**
 * The rows a region holds, parsed as a cell count, or `undefined` when there
 * is no region to fill: a ceiling, no budget, or a region of `Infinity` rows,
 * which names no count — as an unbounded width resolves to a natural one in
 * `withBoundedWidth`.
 */
export function regionRows(height: Height | undefined): number | undefined {
  return height?.exact && height.rows !== Infinity ? cellCount(height.rows) : undefined;
}

/**
 * What came back from a child, held to the region `height` names — blank rows
 * padded below, overflow cropped from the bottom — or left at its own height
 * when `height` is no region. This is the shaping a region's setter owes.
 */
export function fitHeight(lines: Segment[][], height: Height | undefined): Segment[][] {
  const rows = regionRows(height) ?? lines.length;
  const fitted = lines.slice(0, rows);
  while (fitted.length < rows) fitted.push([]);
  return fitted;
}

/**
 * Receives a style error a render would otherwise absorb: the parse failure,
 * and the whole style string it came from — the error names only the token
 * that failed, and `"bold rd"` loses its `bold` too.
 *
 * [LAW:no-mode-explosion] Strict mode is not a second option beside this one.
 * It is a handler that throws, so there is no "strict and a callback" state
 * whose order anyone has to define.
 */
export type StyleErrorHandler = (error: StyleSyntaxError, style: string) => void;

/**
 * The style a `string | Style` stands for in this render.
 *
 * [LAW:single-enforcer] Every renderable resolves a style name here, at render
 * time, because only the render knows whose theme it is drawing for. Resolved
 * when a renderable was built instead, a name was fixed to the built-in
 * defaults before any `Console` could offer its theme, and `new Console({
 * theme })` changed nothing.
 */
export function getStyle(options: RenderOptions, style: string | Style): Style {
  return (options.theme ?? DEFAULT_THEME).resolve(style);
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
/**
 * `options` as a measurement is asked with. A `measure` that renders to learn
 * its shape draws nothing on the frame, so it reports no owner to `onDraw` —
 * one that did would put a widget in document order at the moment a
 * container measured it, and keep one the frame then cropped away.
 *
 * [LAW:single-enforcer] Every measurement starts here: `Measurement.get` and
 * `withBoundedWidth` ask through it, and each `measure` passes it on.
 */
export function measuring(options: RenderOptions): RenderOptions {
  return { ...options, onDraw: undefined };
}

export function withBoundedWidth(
  options: RenderOptions,
  self: Measurable,
): RenderOptions {
  const parsed = withCellWidth(options);
  if (Number.isFinite(parsed.maxWidth)) return parsed;

  const natural = self.measure(measuring(parsed)).maximum;
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

/**
 * What the wheel scrolls: an owner of anchors on the frame (`./anchor.ts`)
 * that moves by lines. `canScrollBy` says whether `scrollBy` with the same
 * `lines` would move it; one that would not passes the wheel outward.
 */
export interface Scrollable {
  canScrollBy(lines: number): boolean;
  scrollBy(lines: number): void;
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

export function isScrollable(obj: object): obj is Scrollable {
  return (
    "canScrollBy" in obj &&
    typeof (obj as Scrollable).canScrollBy === "function" &&
    "scrollBy" in obj &&
    typeof (obj as Scrollable).scrollBy === "function"
  );
}
