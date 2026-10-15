/**
 * The list cursor: one clamp, shared by every list that moves a selection —
 * `ListView`'s callers and `Dropdown` alike — so it has one definition.
 */

/**
 * The selection `delta` items on from `index` in a list of `length`, held to
 * the list's ends: `-Infinity` is the first item and `Infinity` the last. A
 * move that cannot go anywhere returns `index` itself, so `next === index`
 * says nothing moved and the caller can skip a repaint. An empty list has
 * nowhere to move to and returns `index`.
 */
export function moveSelection(index: number, delta: number, length: number): number {
  return length === 0 ? index : Math.max(0, Math.min(length - 1, index + delta));
}
