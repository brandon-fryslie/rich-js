/**
 * Anchor — where a cell sat in the output of the thing that drew it.
 *
 * A widget nested inside a `Layout` cell inside a `Panel` does not know where
 * it lands on screen, and nothing can tell it before it renders: `Align`
 * centres each line only after rendering it, so the lines of one widget can
 * start at different columns, and a `Viewport` shows whichever of its
 * content's rows its offset selects. An origin handed down through the render
 * options would be a number each container has to compute before it knows
 * the answer, and one more thing every container must forward correctly.
 *
 * So the position travels up instead, on the cells themselves. The owner
 * stamps each segment of its output with its row and column there
 * (`Segment.anchorLines`), the stamp rides on the segment's `Style`, which
 * every container already carries through untouched, and whoever holds the
 * composed frame reads any cell's owner and position straight off it
 * (`Segment.anchorAt`). Containers do nothing, so no container can get it
 * wrong.
 *
 * [LAW:single-enforcer] Two things can falsify a stamp. Cutting a segment in
 * two starts the right half at a later column than the stamp names:
 * `Segment.splitCells` is where a segment is cut, and it shifts the right
 * half's anchor (`shiftAnchor`); a crop that keeps the left half keeps a stamp
 * that is already true. Laying the text out again moves every cell: a
 * `RichText` does that, so it admits no anchor (`admitStyle` in `./text.ts`),
 * and the owner that renders it stamps what it draws.
 */

/**
 * The position of a segment's first cell in its owner's output, and the
 * anchor that segment carried before this owner stamped it — the owner nested
 * inside this one, if any. Innermost last: follow `inner` to reach the owner
 * that drew the cell itself.
 */
export interface Anchor {
  /** The thing that drew this cell, compared by identity. */
  readonly owner: object;
  readonly row: number;
  readonly col: number;
  readonly inner: Anchor | undefined;
}

/**
 * The anchor of the cell `cells` to the right of the one `anchor` names, at
 * every level of the nesting — each level names the same cell.
 */
export function shiftAnchor(anchor: Anchor, cells: number): Anchor {
  return {
    owner: anchor.owner,
    row: anchor.row,
    col: anchor.col + cells,
    inner: anchor.inner && shiftAnchor(anchor.inner, cells),
  };
}
