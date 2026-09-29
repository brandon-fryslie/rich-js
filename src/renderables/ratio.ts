/**
 * Rich's `ratio_distribute` (rich/_ratio.py): an integer total split into
 * parts by integer ratios, each part the ceiling of its share of what the parts
 * before it left, so the parts sum to the total and the rounding lands on the
 * leftmost parts.
 *
 * The rounding is the reference's and is kept for that reason alone. A
 * largest-remainder split is fairer, and it is a different answer: 17 cells over
 * ratios 2 and 1 come out 12 + 5 here and 11 + 6 there, so a renderable that
 * stretches by the other rule cannot print the bytes Rich prints for the same
 * call.
 */
export function ratioDistribute(total: number, ratios: readonly number[]): number[] {
  let totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
  let remaining = total;
  return ratios.map((ratio) => {
    // A zero ratio sum is the reference's `else` arm: whatever is left goes to
    // the part at hand, so the total is still handed out in full.
    const part = totalRatio > 0 ? Math.ceil((ratio * remaining) / totalRatio) : remaining;
    totalRatio -= ratio;
    remaining -= part;
    return part;
  });
}
