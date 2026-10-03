/**
 * place — a renderable's output set down as one block inside a wider width.
 *
 * The block is placed, not its lines. The renderable is measured, drawn at the
 * width it asked for and at its own height — a region's height is dropped, as
 * the reference's `Align` drops it — and every line is padded to the widest, so the block is a
 * rectangle; only then is the rectangle padded to the offered width. A
 * multi-line paragraph keeps its own shape under `"center"` — `hi` over `hello`
 * stays a 5-cell block, centred as one — where padding each line to the full
 * width on its own would centre `hi` against the whole terminal. That is
 * Rich's `Align`, and `test/core/console.test.ts` pins it against the
 * reference's bytes.
 *
 * It lives in `core/` because `Console.print` places with it: Rich's `print`
 * wraps what it prints in `Align` for the three alignments, and `console.ts`
 * reaching for `renderables/align.ts` would be a third upward edge out of this
 * layer. [LAW:one-way-deps] `Align` is this function behind the `Renderable`
 * interface. [LAW:one-source-of-truth]
 */

import { Segment } from "./segment.js";
import { Measurement } from "./measure.js";
import type { Renderable, RenderOptions } from "./protocol.js";

export type Alignment = "left" | "center" | "right";

// The share of the spare cells that goes on the left; the rest go on the right.
// Right-alignment pads no right side at all, which is the reference's choice
// and not a zero: a line that ends at the edge carries no trailing blanks.
const PADS: Record<Alignment, (spare: number) => [left: number, right: number]> = {
  left: (spare) => [0, spare],
  center: (spare) => [Math.floor(spare / 2), spare - Math.floor(spare / 2)],
  right: (spare) => [spare, 0],
};

/**
 * `renderable`'s lines, the block they form placed by `align` in
 * `options.maxWidth`. `options.maxWidth` must be finite: the spare cells are
 * written out as spaces. A block wider than the offer — a line with nowhere to
 * break, drawn by a renderable that does not cut its own — is left unpadded at
 * its full width, for whatever holds it to crop or keep.
 */
export function placeBlock(
  renderable: Renderable,
  align: Alignment,
  options: RenderOptions,
): Segment[][] {
  // A renderable that cannot say how wide it wants to be is offered all of it
  // (`Measurement.get` answers for it), and the block is then only as wide as
  // what it actually drew.
  const width = Measurement.get(options, renderable).maximum;
  const drawn = Segment.splitLines(
    renderable.render({ ...options, maxWidth: width, height: undefined }),
  );
  const [blockWidth, height] = Segment.getShape(drawn);
  const [left, right] = PADS[align](Math.max(0, options.maxWidth - blockWidth));
  return Segment.setShape(drawn, blockWidth, height).map((line) => [...pad(left), ...line, ...pad(right)]);
}

// [LAW:dataflow-not-control-flow] no spare room is a pad of no segments, not a
// step skipped.
const pad = (cells: number): Segment[] => (cells > 0 ? [new Segment(" ".repeat(cells))] : []);
