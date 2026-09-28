import { STANDARD_TABLE } from "../../core/color.js";
import { ANSI_SLOTS, type AnsiColorsData } from "./types.js";

/**
 * The VGA colours a terminal draws with no theme of its own: Rich's
 * `DEFAULT_TERMINAL_THEME`, and what `textual-ansi` spells its palette in.
 */
export const VGA_ANSI = Object.fromEntries(
  ANSI_SLOTS.map((slot, n) => [slot, STANDARD_TABLE.get(n).hex]),
) as AnsiColorsData;

/**
 * The ANSI tables Textual draws named colours in for a theme that has no
 * terminal scheme of its own: `MONOKAI` under a dark theme and `ALABASTER`
 * under a light one (`ansi_theme_dark` / `ansi_theme_light` in Textual's
 * `app.py`, values from its `_ansi_theme.py`).
 */
export const TEXTUAL_DARK_ANSI: AnsiColorsData = {
  black: "#1A1A1A",
  red: "#F4005F",
  green: "#98E024",
  yellow: "#FD971F",
  blue: "#9D65FF",
  magenta: "#F4005F",
  cyan: "#58D1EB",
  white: "#C4C5B5",
  brightBlack: "#625E4C",
  brightRed: "#F4005F",
  brightGreen: "#98E024",
  brightYellow: "#E0D561",
  brightBlue: "#9D65FF",
  brightMagenta: "#F4005F",
  brightCyan: "#58D1EB",
  brightWhite: "#F6F6EF",
};

export const TEXTUAL_LIGHT_ANSI: AnsiColorsData = {
  black: "#000000",
  red: "#AA3731",
  green: "#448C27",
  yellow: "#CB9000",
  blue: "#325CC0",
  magenta: "#7A3E9D",
  cyan: "#0083B2",
  white: "#F7F7F7",
  brightBlack: "#777777",
  brightRed: "#F05050",
  brightGreen: "#60CB00",
  brightYellow: "#FFBC5D",
  brightBlue: "#007ACC",
  brightMagenta: "#E64CE6",
  brightCyan: "#00AACB",
  brightWhite: "#F7F7F7",
};
