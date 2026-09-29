/**
 * widgetAt — which widget drew a cell of a painted frame, and where in its
 * own output that cell sits.
 *
 * A widget stamps every cell it draws (`WidgetBase.render`), the stamp rides
 * through every container on the cell's `Style`, and the frame a screen paints
 * is therefore its own hit map: nothing lays widgets out a second time to
 * answer "what is under the pointer", so the answer cannot disagree with what
 * the user sees. Z-order is paint order — whoever painted a cell last owns it.
 */

import { Segment } from "../core/segment.js";
import type { Anchor } from "../core/anchor.js";
import { WidgetBase } from "./widget-base.js";
import type { InteractiveWidget } from "./types.js";

/** A pointer position resolved to the widget that drew it. */
export interface WidgetHit {
  readonly widget: InteractiveWidget;
  /** Column of the cell in the widget's own output. */
  readonly col: number;
  /** Row of the cell in the widget's own output. */
  readonly row: number;
}

/**
 * The innermost widget that drew the cell at column `x` of row `y` of
 * `frame`, or `undefined` when no widget drew it. A widget nested inside
 * another widget's output wins over the one containing it.
 */
export function widgetAt(
  frame: readonly (readonly Segment[])[],
  x: number,
  y: number,
): WidgetHit | undefined {
  let hit: WidgetHit | undefined;
  // [LAW:parse-dont-validate] An anchor's owner is any object; only a
  // WidgetBase stamps as a widget, so this is where `object` becomes a widget.
  for (let a: Anchor | undefined = Segment.anchorAt(frame, x, y); a; a = a.inner) {
    if (a.owner instanceof WidgetBase) hit = { widget: a.owner, col: a.col, row: a.row };
  }
  return hit;
}
