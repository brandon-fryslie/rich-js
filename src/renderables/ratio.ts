import type { CellCol } from "../core/cells.js";

/**
 * Rich's `_ratio.py`: integer totals split into parts by ratio, in exact
 * arithmetic, each by the reference's own rounding.
 *
 * The rounding is the reference's and is kept for that reason alone. A
 * largest-remainder split is fairer, and it is a different answer: 17 cells
 * over ratios 2 and 1 are 12 + 5 by `ratioDistribute` and 11 + 6 by largest
 * remainder, and 5 cells at 1:1 are 2 + 3 by `ratioResolve` and 3 + 2 by
 * largest remainder with ties to the left. A renderable that splits by any
 * other rule cannot print the bytes Rich prints for the same call.
 *
 * The arithmetic is the reference's too: Python's integers and `Fraction`s are
 * exact at any size, and a double's `ratio * remaining` rounds once it passes
 * 2^53, so the parts stopped summing to the total near
 * `Number.MAX_SAFE_INTEGER`.
 */

/**
 * Rich's `ratio_distribute`: each part the ceiling of its share of what the
 * parts before it left, and never below its minimum, so the rounding lands on
 * the leftmost parts. The parts sum to the total whenever the minimums leave
 * room; a minimum that does not fit is paid anyway, as the reference pays it,
 * and the parts then overrun the total. The ratios are weights in one exact
 * proportion (`exactWeights`), so a fractional one divides as it reads, where
 * the reference takes only whole ones.
 */
export function ratioDistribute(
  total: number,
  ratios: readonly number[],
  minimums: readonly number[] = ratios.map(() => 0),
): number[] {
  const weights = exactWeights(ratios);
  let totalRatio = weights.reduce((sum, ratio) => sum + ratio, 0n);
  let remaining = BigInt(total);
  return weights.map((ratio, index) => {
    // A zero ratio sum is the reference's `else` arm: whatever is left goes to
    // the part at hand, so the total is still handed out in full.
    const share = totalRatio > 0n ? ceilDiv(ratio * remaining, totalRatio) : remaining;
    const minimum = BigInt(minimums[index]!);
    const part = share > minimum ? share : minimum;
    totalRatio -= ratio;
    remaining -= part;
    return Number(part);
  });
}

/** Python's `ceil(a / b)` for a positive `b`: `BigInt` division truncates toward zero, which is the ceiling for a negative `a`. */
function ceilDiv(a: bigint, b: bigint): bigint {
  const quotient = a / b;
  return a % b > 0n ? quotient + 1n : quotient;
}

declare const _weight: unique symbol;

/** A share weight: positive and finite, or 0 for a part that does not grow. */
export type Weight = number & { readonly [_weight]: true };

/**
 * A share weight, not a cell count: fractions divide space meaningfully, so
 * this parses where `cellCount` would floor. A weight that cannot name a share
 * — negative, NaN, infinite — reads as zero, which already means "this part
 * does not grow" and is set aside before any division.
 */
export function shareWeight(ratio: number): Weight {
  return (Number.isFinite(ratio) && ratio > 0 ? ratio : 0) as Weight;
}

/**
 * One region a `ratioResolve` total is split into: a declared `size`, or —
 * undefined — a share by `ratio`, never below `minimumSize`. A `ratio` of 0 is
 * a part that does not grow and takes its `minimumSize`.
 */
export interface Edge {
  readonly size: CellCol | undefined;
  readonly ratio: Weight;
  readonly minimumSize: CellCol;
}

/** Whether an edge takes a share by ratio; one that does not is paid `size ?? minimumSize`. */
const grows = (edge: Edge): boolean => edge.size === undefined && edge.ratio !== 0;

/**
 * Rich's `ratio_resolve`: `total` cells split across `edges`, the declared
 * sizes paid first and what is left shared by ratio.
 *
 * A growing edge whose share would not reach its `minimumSize` is paid that
 * minimum and the rest are shared again without it, one edge at a time, first
 * in order first. The shares then round by carrying each fraction into the edge
 * after it, so they sum to what was left and the spare cells land on the
 * rightmost edges: 5 cells at 1:1 are 2 + 3.
 *
 * Three departures, all the port's, not the reference's. Nothing is paid past
 * what `total` still holds: Rich hands every edge its minimum even when that
 * overruns the total and leaves the overflow for the screen to clip; here an
 * edge is paid out of what is left, so the parts never sum past `total` and two
 * panes of a layout asked to fit one cell cannot merge into a two-cell row. And
 * a declared `size` of 0 is a pane of no cells, where Rich's `edge.size or
 * None` reads it as undeclared and lets the pane grow. And a `ratio` of 0 is
 * paid its minimum before any share is cut, where Rich keeps it among the
 * growing parts and counts it as 1 in the sum (`edge.ratio or 1`), which thins
 * every other share and can leave cells unassigned.
 */
export function ratioResolve(total: number, edges: readonly Edge[]): number[] {
  const sizes = edges.map(() => 0);
  let remaining = total;
  const pay = (index: number, cells: number): void => {
    sizes[index] = Math.min(cells, remaining);
    remaining -= sizes[index]!;
  };

  const growing: number[] = [];
  edges.forEach((edge, index) => {
    if (grows(edge)) growing.push(index);
    else pay(index, edge.size ?? edge.minimumSize);
  });

  const weights = exactWeights(growing.map((index) => edges[index]!.ratio));
  let open = growing.map((index, slot) => ({
    index,
    weight: weights[slot]!,
    minimum: BigInt(edges[index]!.minimumSize),
  }));

  // `remaining * weight / sum` is the edge's share; compared across the
  // division so the test is exact. A budget already spent fails every edge's
  // test, which pays each its minimum out of nothing — zero, the clip above.
  let sum = open.reduce((acc, { weight }) => acc + weight, 0n);
  const firstShort = (): (typeof open)[number] | undefined =>
    open.find(({ weight, minimum }) => BigInt(remaining) * weight <= minimum * sum);
  for (let short = firstShort(); short !== undefined; short = firstShort()) {
    pay(short.index, Number(short.minimum));
    sum -= short.weight;
    open = open.filter((edge) => edge !== short);
  }

  // Carrying each edge's fraction into the next is the same as flooring the
  // running total of the shares: an edge gets the whole cells its share moves
  // that running total across.
  const budget = BigInt(remaining);
  let weightSoFar = 0n;
  let cellsSoFar = 0n;
  for (const { index, weight } of open) {
    const before = cellsSoFar;
    weightSoFar += weight;
    cellsSoFar = (budget * weightSoFar) / sum;
    sizes[index] = Number(cellsSoFar - before);
  }
  return sizes;
}

/**
 * A `total` at which `ratioResolve` gives every growing edge at least
 * `wants[i]` cells, and every other edge its declared size or minimum.
 *
 * [LAW:one-source-of-truth] It inverts the split above and sits beside it for
 * that reason. A growing edge is never handed less than the floor of its share,
 * `total * ratio / totalRatio`, because the running total it is carved from
 * floors once on each side. So a budget at which every share's floor reaches
 * its want is enough, and one budget serves them all: the row needs the largest
 * such demand, never their total.
 *
 * Enough, and not always the least. Carried rounding hands spare cells to the
 * right, so "left" and "right" at 1:1 fit in 9, as 4 + 5, where this answers
 * 10. The least total is no closed formula's answer — an edge's cells are not
 * monotone in the total — and searching for it costs a split per cell climbed,
 * a climb that grows with how far apart the ratios are. The spare cells are
 * cheaper.
 *
 * At that budget every share already covers its edge's minimum — the want
 * includes it — so the re-share pass pays at most an edge whose share is
 * exactly that minimum, which leaves every other share where it was. A want is
 * whole cells, a fraction rounded up; an unbounded one, a pane with no width of
 * its own offered all of it, is an unbounded budget, given before the exact
 * arithmetic, which has no infinity.
 */
export function ratioBudget(edges: readonly Edge[], wants: readonly number[]): number {
  const growing = edges.flatMap((edge, index) => (grows(edge) ? [index] : []));
  const owed = growing.map((index) => Math.ceil(Math.max(edges[index]!.minimumSize, wants[index]!)));
  if (!owed.every(Number.isFinite)) return Infinity;

  const weights = exactWeights(growing.map((index) => edges[index]!.ratio));
  const sum = weights.reduce((acc, weight) => acc + weight, 0n);
  const pinned = edges.reduce(
    (acc, edge) => acc + (grows(edge) ? 0 : (edge.size ?? edge.minimumSize)),
    0,
  );
  const budget = owed.reduce((most, cells, slot) => {
    const need = ceilDiv(BigInt(cells) * sum, weights[slot]!);
    return need > most ? need : most;
  }, 0n);
  return pinned + Number(budget);
}

/**
 * Weights as integers in one exact proportion. Each is read as the decimal it
 * prints as — the number its caller wrote, `0.1` rather than the binary double
 * nearest it — and all are scaled by the one power of ten that makes them
 * whole, so `0.1 : 0.3 : 1` is exactly `1 : 3 : 10`. A weight that does not
 * print as a decimal, `Infinity`, is refused by `BigInt` with a SyntaxError:
 * each caller parses its weights finite first, and this is the loud end of
 * that.
 *
 * The common exponent is accumulated rather than spread into `Math.max`: a
 * layout holds as many panes as its caller made, and one argument per pane
 * overruns the engine's argument limit.
 */
export function exactWeights(weights: readonly number[]): bigint[] {
  const decimals = weights.map((weight) => {
    const [digits = "", power = "0"] = String(weight).split("e");
    const [whole = "", fraction = ""] = digits.split(".");
    return { mantissa: BigInt(whole + fraction), exponent: fraction.length - Number(power) };
  });
  const common = decimals.reduce((most, { exponent }) => Math.max(most, exponent), 0);
  return decimals.map(({ mantissa, exponent }) => mantissa * 10n ** BigInt(common - exponent));
}
