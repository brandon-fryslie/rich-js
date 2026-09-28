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
 * wide. Where the column is narrower the output's font shrinks to fit it
 * (custom.css, `.rich-example`), down to a floor below which it scrolls; it
 * never reflows. The environment is exactly this: nothing from the build
 * machine's or the browser's passes through.
 */
export const EXAMPLE_TERMINAL = {
  columns: 75,
  rows: 24,
  isTTY: true,
  env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
} as const;

/** The site's colour modes, each with the terminal theme its output is drawn in. */
export const EXAMPLE_THEMES = { light: ATOM_ONE_LIGHT, dark: ATOM_ONE_DARK } as const;
