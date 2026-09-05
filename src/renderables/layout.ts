/**
 * Layout — divides the screen into rectangular regions.
 */

import { Segment } from "../core/segment.js";
import { RichText } from "../core/text.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { Measurement } from "../core/measure.js";
import { cellCount } from "../core/cells.js";

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
 * every ratio reaching `_distributeSpace` and `_rowBudgetFor` positive.
 */
function growthRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}

export class Layout implements Renderable, Measurable {
  name: string | undefined;
  ratio: number;
  size: number | undefined;
  minimumSize: number;
  visible: boolean;
  private _renderable: Renderable | undefined;
  private _children: Layout[];
  private _splitDirection: "column" | "row" | undefined;

  constructor(renderable?: Renderable | string, options?: LayoutOptions) {
    if (renderable !== undefined) {
      this._renderable = typeof renderable === "string"
        ? new RichText(renderable, { end: "" })
        : renderable;
    }
    this.name = options?.name;
    this.ratio = growthRatio(options?.ratio ?? 1);
    // Both are cell counts a caller supplies as a plain `number`, and they
    // reach the width arithmetic without passing through `withCellWidth`, which
    // parses only what the caller of `render` supplied. Unparsed, `size: 5.5`
    // measured 6.5 cells and `size: -5` measured -4 — a width with no meaning,
    // which a fit-mode `Panel` then tried to draw. Absence is preserved rather
    // than parsed: `undefined` selects a flex pane, and `cellCount` would read
    // it as a declared zero.
    this.size = options?.size === undefined ? undefined : cellCount(options.size);
    this.minimumSize = cellCount(options?.minimumSize ?? 1);
    this.visible = options?.visible !== false;
    this._children = [];
    this._splitDirection = undefined;
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
    this._renderable = typeof renderable === "string"
      ? new RichText(renderable, { end: "" })
      : renderable;
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
      if (this._renderable) {
        yield* Segment.cropLines(this._renderable.render(options), options.maxWidth);
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
    // Vertical stacking: each child gets full width, proportional height
    const totalHeight = options.maxHeight ?? options.height ?? 24;
    const heights = this._distributeSpace(children, totalHeight);

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const childOptions: RenderOptions = {
        ...options,
        maxHeight: heights[i],
        height: heights[i],
      };
      yield* child.render(childOptions);
    }
  }

  private *_renderRow(
    children: Layout[],
    options: RenderOptions,
  ): Iterable<Segment> {
    // Horizontal side-by-side: divide the requested width once, then merge
    // child lines. The budget arrives parsed from `render` — unparsed, a NaN
    // width made every share NaN and the merge threw `Invalid array length`.
    const widths = this._distributeSpace(children, options.maxWidth);
    const cells = children.map((child, i) => ({
      width: widths[i]!,
      lines: Segment.splitLines([
        ...child.render({ ...options, maxWidth: widths[i]! }),
      ]),
    }));
    yield* Segment.mergeHorizontal(cells);
  }

  private _distributeSpace(children: Layout[], totalSpace: number): number[] {
    const sizes: number[] = new Array(children.length).fill(0);
    let remaining = totalSpace;

    // Children that do not grow are paid first: a declared `size`, and equally
    // a `ratio` of 0, which is the caller saying this pane stays at its
    // `minimumSize`. Left in the ratio pass below, a zero-ratio child divided
    // by its own ratio and drew its minimum out of a budget the shares had
    // already spent — three panes of `zzz`/`aaaaa`/`bbbbb` consumed
    // `3 + 2*floor(T/2)` cells out of `T`, which no `T` satisfies, and the row
    // only came out right at 16 because the `Math.min(remaining, ...)` below
    // happened to clip the last share to the right number.
    const growing: number[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (child.size !== undefined) {
        sizes[i] = Math.min(child.size, remaining);
      } else if (child.ratio === 0) {
        sizes[i] = Math.min(child.minimumSize, remaining);
      } else {
        growing.push(i);
        continue;
      }
      remaining -= sizes[i]!;
    }

    // Distribute what is left by ratio. Each child's share comes off one
    // budget and is bounded by what that budget still holds: `minimumSize` is
    // what a child asks for, `remaining` is what there is to give, and the
    // second beats the first. Applied without that bound — as
    // `Math.max(minimumSize, share)` alone — every child claimed its whole
    // minimum out of a budget that could not cover one of them, so two
    // children of a Layout asked to fit one cell merged into a two-cell row.
    if (growing.length > 0 && remaining > 0) {
      const budget = remaining;
      // Every ratio in here is positive — `growthRatio` parses the rest to zero
      // at the constructor and zero is filtered out above — which is what makes
      // the division safe and `_rowBudgetFor`'s inverse of it finite.
      const totalRatio = growing.reduce(
        (s, idx) => s + children[idx]!.ratio,
        0,
      );

      for (const idx of growing) {
        const child = children[idx]!;
        const share = Math.floor(budget * child.ratio / totalRatio);
        const allocated = Math.min(remaining, Math.max(child.minimumSize, share));
        sizes[idx] = allocated;
        remaining -= allocated;
      }
    }

    return sizes;
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
    return this._splitDirection === "row"
      ? this._rowBudgetFor(visible, widths)
      : Math.max(...widths);
  }

  /**
   * The budget at which `_distributeSpace` gives every child of a row at least
   * the width it wants — the inverse of the ratio rule above, and the reason
   * this is not the sum of those widths.
   *
   * [LAW:one-source-of-truth] A growing child receives `floor(budget * ratio /
   * totalRatio)`, so to receive `want` cells it needs the budget to reach
   * `want * totalRatio / ratio`, and one budget serves them all: the row needs
   * the largest demand, never their total. Summed instead, a 1:1 split of
   * "left" and "right" reported 9 and then rendered "right" into the 4 cells
   * that `floor(9/2)` actually hands it.
   *
   * The panes that do not grow are paid first here for the same reason they
   * are paid first there — and it is the reason this divides by no zero: a
   * `ratio` of 0 never reaches the division, because a pane that does not grow
   * demands nothing of a budget for growing.
   */
  private _rowBudgetFor(children: Layout[], widths: number[]): number {
    const growing = children.filter((c) => c.size === undefined && c.ratio !== 0);
    const totalRatio = growing.reduce((sum, c) => sum + c.ratio, 0);

    let pinned = 0;
    let budget = 0;

    for (const [i, child] of children.entries()) {
      if (child.size !== undefined) {
        pinned += child.size;
      } else if (child.ratio === 0) {
        pinned += child.minimumSize;
      } else {
        const want = Math.max(child.minimumSize, widths[i]!);
        budget = Math.max(budget, Math.ceil(want * totalRatio / child.ratio));
      }
    }

    return pinned + budget;
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
