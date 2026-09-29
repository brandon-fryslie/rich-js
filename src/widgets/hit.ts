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

/**
 * Where `widget`'s output starts in `frame` — the cell its own row 0, column
 * 0 falls on — read off the first cell it drew, or `undefined` when it drew
 * none.
 */
export function originOf(
  frame: readonly (readonly Segment[])[],
  widget: InteractiveWidget,
): { x: number; y: number } | undefined {
  for (let y = 0; y < frame.length; y++) {
    let start = 0;
    for (const segment of frame[y]!) {
      for (let a = segment.style?.anchor; a; a = a.inner) {
        if (a.owner === widget) return { x: start - a.col, y: y - a.row };
      }
      start += segment.cellLength;
    }
  }
  return undefined;
}

/**
 * Whether `widget` drew the cell at column `x` of row `y` of `frame`, itself
 * or through a widget nested in its output.
 */
export function drew(
  frame: readonly (readonly Segment[])[],
  widget: InteractiveWidget,
  x: number,
  y: number,
): boolean {
  for (let a = Segment.anchorAt(frame, x, y); a; a = a.inner) if (a.owner === widget) return true;
  return false;
}

/**
 * Where `widget`'s footprint sits in `frame`: the cell its row 0, column 0
 * falls on, and how many of its rows the frame shows down to its lowest — or
 * `undefined` when the frame does not show its row 0.
 */
export function footprintOf(
  frame: readonly (readonly Segment[])[],
  widget: InteractiveWidget,
): { x: number; y: number; rows: number } | undefined {
  let origin: { x: number; y: number } | undefined;
  let rows = 0;
  for (let y = 0; y < frame.length; y++) {
    let start = 0;
    for (const segment of frame[y]!) {
      for (let a = segment.style?.anchor; a; a = a.inner) {
        if (a.owner !== widget) continue;
        if (a.row === 0 && !origin) origin = { x: start - a.col, y };
        rows = Math.max(rows, a.row + 1);
      }
      start += segment.cellLength;
    }
  }
  return origin && { ...origin, rows };
}

/** Every owner that drew a cell of `frame`, at every depth of nesting. */
export function ownersOn(frame: readonly (readonly Segment[])[]): Set<object> {
  const owners = new Set<object>();
  for (const line of frame) {
    for (const segment of line) {
      for (let a = segment.style?.anchor; a; a = a.inner) owners.add(a.owner);
    }
  }
  return owners;
}
