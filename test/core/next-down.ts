const DOUBLE = new Float64Array(1);
const BITS = new BigUint64Array(DOUBLE.buffer);

/** The float under a positive `x`, read through its bits: what a test pins an answer "exact to the float" with. */
export function nextDown(x: number): number {
  DOUBLE[0] = x;
  BITS[0] = BITS[0]! - 1n;
  return DOUBLE[0]!;
}
