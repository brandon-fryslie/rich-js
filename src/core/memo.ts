/**
 * memo — a string-keyed memo with a size bound: the one cache shape for a
 * pure computation whose keys a long-running host derives without end. A
 * statusline daemon redrawing a time-varying colour parses a new hex string,
 * matches a new RGB triple, measures a new cell, on every frame; a memo that
 * never evicts grows by one entry per frame for the life of the process.
 */

// [LAW:single-enforcer] The one size policy for every memo in the library.
// Clearing at the cap rather than evicting least-recently-used: a refill costs
// one recomputation per key, and a clear needs no bookkeeping on the hit path.
export const MEMO_MAX = 4096;

/**
 * `get(key, compute)` returns the value remembered for `key`, computing and
 * remembering it on a miss. Holds at most `MEMO_MAX` entries. `compute` must
 * be a pure function of `key`, so a value recomputed after a clear is the one
 * that was dropped.
 */
export class Memo<V extends NonNullable<unknown>> {
  private readonly entries = new Map<string, V>();

  get size(): number {
    return this.entries.size;
  }

  get(key: string, compute: (key: string) => V): V {
    const remembered = this.entries.get(key);
    if (remembered !== undefined) return remembered;
    if (this.entries.size >= MEMO_MAX) this.entries.clear();
    const value = compute(key);
    this.entries.set(key, value);
    return value;
  }
}
