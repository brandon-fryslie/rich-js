/**
 * HotContext — what a program sees as `import.meta.hot`: the part of Vite's
 * and Bun's hot module replacement API a docs card's live terminal gives it
 * (docs/.vitepress/hot-runtime.ts).
 *
 * A program that calls `accept()` is re-run in place when the card is edited:
 * the process, its terminal and the screen stay, the timers and listeners the
 * old version left are cleared, and each file runs again with the `data` its
 * `dispose` callbacks wrote. A program that never accepts is restarted, as one
 * is in Vite when an edit reaches no accepting module.
 *
 * It departs from Vite in one place: `accept()` in any file accepts an edit to
 * any file, because every file runs again, not only the one that changed.
 *
 * Where no host replaces modules — Node, the build — `import.meta.hot` is
 * undefined, so a program writes every use with `?.` and runs unchanged.
 *
 * [LAW:one-source-of-truth] The one declaration of the shape: the ambient
 * `ImportMeta` programs type-check against (import-meta-hot.d.ts) and the
 * runtime that implements it both read this.
 */
export interface HotContext {
  /** This file's own record, the same object in every version of the program. */
  readonly data: Record<string, unknown>;
  /** Re-run the program in place when it is edited, rather than restart it. */
  accept(): void;
  /** `callback` runs before the next version does, with `data`, to carry state into it. */
  dispose(callback: (data: Record<string, unknown>) => void): void;
}
