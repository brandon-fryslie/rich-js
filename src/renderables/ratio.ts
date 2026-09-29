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
 *
 * The arithmetic is the reference's too: Python's integers are exact at any
 * size, and a double's `ratio * remaining` rounds once it passes 2^53, so the
 * parts stopped summing to the total near `Number.MAX_SAFE_INTEGER`. `BigInt`
 * refuses a ratio that is not whole with a RangeError, and the reference takes
 * only whole ones.
 */
export function ratioDistribute(total: number, ratios: readonly number[]): number[] {
  const whole = ratios.map((ratio) => BigInt(ratio));
  let totalRatio = whole.reduce((sum, ratio) => sum + ratio, 0n);
  let remaining = BigInt(total);
  return whole.map((ratio) => {
    // A zero ratio sum is the reference's `else` arm: whatever is left goes to
    // the part at hand, so the total is still handed out in full.
    const part = totalRatio > 0n ? ceilDiv(ratio * remaining, totalRatio) : remaining;
    totalRatio -= ratio;
    remaining -= part;
    return Number(part);
  });
}

/** Python's `ceil(a / b)` for a positive `b`: `BigInt` division truncates toward zero. */
function ceilDiv(a: bigint, b: bigint): bigint {
  const quotient = a / b;
  return a % b > 0n ? quotient + 1n : quotient;
}
