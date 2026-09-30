/**
 * The size of the terminal every demo page opens. A printed demo lays its rows
 * out to fit it, and the tests that check they fit read it from here.
 *
 * [LAW:one-source-of-truth] The demo shell's `__DEMO_COLS__` / `__DEMO_ROWS__`
 * placeholders are filled from this by vite.config.demos.ts, so a resize is
 * this file and every check that depends on the size follows it.
 */
export const DEMO_TERMINAL = { cols: 100, rows: 30 } as const;
