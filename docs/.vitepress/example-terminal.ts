/**
 * The terminal every docs example runs in, static or live, and the theme it is
 * drawn in under each site colour mode.
 *
 * [LAW:one-source-of-truth] The build-time runner and the live terminal on the
 * page both read these, so an example's static output and its live run are the
 * same terminal: one width, one environment, one pair of themes.
 */
import { ATOM_ONE_DARK, ATOM_ONE_LIGHT } from "../../src/themes/terminalThemes.js";

/**
 * 75 columns is what the docs content column holds in the code font at 1440px
 * wide. Where the column is narrower an output that wide shrinks its font to
 * fit (custom.css, `.rich-example-output`), down to a floor below which it
 * scrolls; it never reflows. The environment is exactly this: nothing from the build
 * machine's or the browser's passes through.
 */
export const EXAMPLE_TERMINAL = {
  columns: 75,
  rows: 24,
  isTTY: true,
  env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
} as const;

/**
 * How long a static example may run, at build time and as a reader's edit in
 * the browser. Its point is what it prints, not when; one that waits on
 * something is `live`. At build time this catches a run that waits, not one
 * that spins, since a synchronous loop never yields to the timer; in the
 * browser the program runs in a worker, which is ended at this limit either way.
 */
export const STATIC_RUN_LIMIT_MS = 5_000;

/** The site's colour modes, each with the terminal theme its output is drawn in. */
export const EXAMPLE_THEMES = { light: ATOM_ONE_LIGHT, dark: ATOM_ONE_DARK } as const;
