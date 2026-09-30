/**
 * Layout — divides the screen into rectangular regions.
 */

import { Segment } from "../core/segment.js";
import { embed } from "./embed.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import {
  fitHeight,
  isMeasurable,
  regionRows,
  stackedHeight,
  withBoundedWidth,
  withCellWidth,
} from "../core/protocol.js";
import { Measurement } from "../core/measure.js";
import { cellCount } from "../core/cells.js";
import type { CellCol } from "../core/cells.js";
import { ratioBudget, ratioResolve } from "./ratio.js";

export interface LayoutOptions {
  name?: string;
  ratio?: number;
  size?: number;
  minimumSize?: number;
  visible?: boolean;
}

/**
 * A share weight, not a cell count: fractions divide space meaningfully, so
 * this parses where `cellCount` would floor. A weight that cannot name a share
 * — negative, NaN, infinite — reads as zero, which already means "this pane
 * does not grow" and is filtered out before any division. That is what makes
 * every ratio reaching `ratioResolve` and `ratioBudget` positive.
 */
function growthRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}

/**
 * A pane rendered into a region of `rows` and held to exactly that many lines,
 * or — with `rows` undefined — rendered under the layout's own budget, as a
 * ceiling, at its natural height.
 *
 * [LAW:single-enforcer] The region's setter shapes it (`fitHeight`). Forwarded
 * unshaped, a pane whose content ran short pulled every pane below it up, and
 * one that ran long pushed them down.
 */
function paneLines(
  pane: Layout,
  options: RenderOptions,
  rows: number | undefined,
): Segment[][] {
  const height = rows === undefined ? stackedHeight(options.height) : { rows, exact: true };
  return fitHeight(Segment.splitLines(pane.render({ ...options, height })), height);
}

export class Layout implements Renderable, Measurable {
  name: string | undefined;
  visible: boolean;
  private _ratio!: number;
  private _size: CellCol | undefined;
  private _minimumSize!: CellCol;
  private _renderable: Renderable | undefined;
  private _children: Layout[];
  private _splitDirection: "column" | "row" | undefined;

  constructor(renderable?: Renderable | string, options?: LayoutOptions) {
    if (renderable !== undefined) {
      this._renderable = embed(renderable);
    }
    this.name = options?.name;
    this.ratio = options?.ratio ?? 1;
    this.size = options?.size;
    this.minimumSize = options?.minimumSize ?? 1;
    this.visible = options?.visible !== false;
    this._children = [];
    this._splitDirection = undefined;
  }

  /**
   * The three declared numbers, parsed on assignment rather than at the
   * constructor. All three are public and a caller reaches them long after
   * construction — `layout.getByName("pane")!.ratio = -1` walked straight past a
   * constructor-only parse and put a negative weight back into the division that
   * `ratioResolve` and `ratioBudget` are written to trust.
   *
   * [LAW:parse-dont-validate] The setter is the border, so the guarantee holds
   * for the object's whole lifetime and nothing downstream re-checks. `size` and
   * `minimumSize` are cell counts; `ratio` is a share weight and keeps its
   * fractions. Absence is preserved rather than parsed: an undefined `size`
   * selects a flex pane, and `cellCount` would read it as a declared zero.
   */
  get ratio(): number {
    return this._ratio;
  }

  set ratio(value: number) {
    this._ratio = growthRatio(value);
  }

  get size(): CellCol | undefined {
    return this._size;
  }

  set size(value: number | undefined) {
    this._size = value === undefined ? undefined : cellCount(value);
  }

  get minimumSize(): CellCol {
    return this._minimumSize;
  }

  set minimumSize(value: number) {
    this._minimumSize = cellCount(value);
  }

  get children(): Layout[] {
    return this._children;
  }

  /**
   * Whether this layout draws `_renderable` or its children.
   *
   * [LAW:one-source-of-truth] `render` and `_naturalWidth` must answer this the
   * same way. Asked separately they did not: `_naturalWidth` read it off the
   * *visible* children, so a layout holding content and a single hidden child
   * reported that content's width while `render` emitted nothing at all, and a
   * fit-mode `Panel` framed twelve cells of air.
   */
  private get _isLeaf(): boolean {
    return this._children.length === 0;
  }

  splitColumn(...layouts: Layout[]): void {
    this._children = layouts;
    this._splitDirection = "column";
  }

  splitRow(...layouts: Layout[]): void {
    this._children = layouts;
    this._splitDirection = "row";
  }

  update(renderable: Renderable | string): void {
    this._renderable = embed(renderable);
  }

  getByName(name: string): Layout | undefined {
    if (this.name === name) return this;
    for (const child of this._children) {
      const found = child.getByName(name);
      if (found) return found;
    }
    return undefined;
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    if (!this.visible) return;

    // Parsed once at the top of the layout rather than at the row split below,
    // because a column split forwards the width to its children untouched and
    // would otherwise hand each of them the caller's raw number.
    const options = withBoundedWidth(rawOptions, this);

    if (this._isLeaf) {
      // Cropped rather than forwarded: a leaf hands its content the offer and
      // content is free to ignore it, and a pane wider than the region it was
      // given is the one thing a layout may never emit — in a row split it
      // overwrites the pane beside it. The row path already crops each share,
      // so this is the same rule at the one place that skipped it.
      // Every line ended, as the split paths below end theirs: embedding
      // cleared the content's own `end`, and a leaf stacked in a `Group` is
      // still a region of lines.
      if (this._renderable) {
        for (const line of Segment.splitLines(Segment.cropLines(this._renderable.render(options), options.maxWidth))) {
          yield* line;
          yield Segment.line();
        }
      }
      return;
    }

    const visibleChildren = this._children.filter((c) => c.visible);
    if (visibleChildren.length === 0) return;

    if (this._splitDirection === "row") {
      yield* this._renderRow(visibleChildren, options);
    } else {
      yield* this._renderColumn(visibleChildren, options);
    }
  }

  private *_renderColumn(
    children: Layout[],
    options: RenderOptions,
  ): Iterable<Segment> {
    // Each pane gets full width and its share of the region. With no region —
    // a ceiling, or no budget at all — a pane's share is its declared `size`,
    // and a pane without one takes its content's height.
    const region = regionRows(options.height);
    const shares = region === undefined
      ? children.map((child) => child.size)
      : ratioResolve(region, children);

    for (let i = 0; i < children.length; i++) {
      for (const line of paneLines(children[i]!, options, shares[i])) {
        yield* line;
        yield Segment.line();
      }
    }
  }

  private *_renderRow(
    children: Layout[],
    options: RenderOptions,
  ): Iterable<Segment> {
    // Horizontal side-by-side: divide the requested width once, then merge
    // child lines. The budget arrives parsed from `render` — unparsed, a NaN
    // width made every share NaN and the merge threw `Invalid array length`.
    // Every pane stands in the whole region, and with none the merge pads the
    // row to its tallest pane.
    const widths = ratioResolve(options.maxWidth, children);
    const region = regionRows(options.height);
    const cells = children.map((child, i) => ({
      width: widths[i]!,
      lines: paneLines(child, { ...options, maxWidth: widths[i]! }, region),
    }));
    yield* Segment.mergeHorizontal(cells);
  }

  /**
   * The width this layout would take if nothing constrained it: its content's
   * for a leaf, its children's laid out the way the split lays them out.
   *
   * A `size` counts only across a row, which is the one direction in which it
   * is a width — down a column the same field is a height, and reading it as a
   * width there would report a two-line pane as two cells wide.
   */
  private _naturalWidth(options: RenderOptions): number {
    if (!this.visible) return 0;

    if (this._isLeaf) {
      if (this._renderable === undefined) return 0;
      // A leaf whose content cannot measure itself has no width of its own to
      // report, so it reports the offer — unbounded included, which is where
      // `withBoundedWidth` says so rather than inventing a number.
      return isMeasurable(this._renderable)
        ? Measurement.get(options, this._renderable).maximum
        : options.maxWidth;
    }

    const visible = this._children.filter((c) => c.visible);
    if (visible.length === 0) return 0;

    const widths = visible.map((c) => c._naturalWidth(options));
    if (this._splitDirection === "row") return ratioBudget(visible, widths);

    // Accumulated, not spread: a column split holds as many children as a caller
    // made, and `Math.max(...widths)` passes one argument per child, so a
    // generated dashboard deep enough overruns the engine's argument limit and
    // throws out of `measure()`.
    let widest = 0;
    for (const width of widths) widest = Math.max(widest, width);
    return widest;
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // `minimumSize` is what this layout asks for and the ceiling is what it was
    // offered; the ceiling wins. Unclamped, a layout measured into no width
    // reported the range 1..0 — a floor above its own ceiling, which the parent
    // that asked cannot divide.
    //
    // The ceiling alone was not the answer either: a layout that reported the
    // whole offer as its maximum told every parent it wanted all of it, so
    // `Panel` in fit mode drew its frame at the full console width around a
    // layout of two short panes, and an unbounded offer came back unbounded.
    const parsed = withCellWidth(rawOptions);
    const maximum = Math.min(this._naturalWidth(parsed), parsed.maxWidth);
    return { minimum: Math.min(this.minimumSize, maximum), maximum };
  }
}
