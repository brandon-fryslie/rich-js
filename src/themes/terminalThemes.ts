/**
 * Pre-built `TerminalTheme` constants — default + the named Textual themes.
 *
 * Two groups live here:
 *
 *   1. Themes with authored data files in `./data/*.ts`. Their base colours
 *      are pulled from the data file via `getThemeBaseColors`, which parses
 *      only the 8 substrate keys (background/foreground/primary/secondary/
 *      accent/success/warning/error) — no full-palette hydration, no
 *      registry-cache pollution. Editing a hex in `data/<name>.ts` updates
 *      both the registry's full palette AND the matching `TerminalTheme`
 *      constant exported below.
 *
 *   2. Themes without a data file (`default`, `svg-export`,
 *      `catppuccin-frappe`, `catppuccin-macchiato`). These stay stated
 *      inline as `ThemeBaseColors` literals. Each one's bg/fg are stated
 *      once and forwarded by `defineTheme` to both the `TerminalTheme`
 *      constructor and the `buildPalette` base.
 *
 * [LAW:one-source-of-truth] For data-backed themes the truth lives in
 * `data/<name>.ts`; this module is a derived view. For inline themes the
 * truth lives in the `defineTheme` call below; `defineTheme` forwards
 * bg/fg into both sinks so they cannot drift.
 *
 * [LAW:one-way-deps] `core/color → themes/palette` remains the only edge
 * into themes/. This file imports only sibling theme modules and core
 * color primitives; nothing in `core/` imports back.
 *
 * Note on `ansiColors`: every preset theme uses `STANDARD_TABLE`. Theme
 * identity lives in the semantic `palette`, not in the standard ANSI
 * 16/256 LUT — `ColorSpec.parse("red")` is intentionally canonical across
 * themes, matching Textual's model.
 */

import {
  ColorRgba,
  STANDARD_TABLE,
  TerminalTheme,
} from "../core/color.js";
import { buildPalette } from "./buildPalette.js";
import { getThemeBaseColors, type ThemeBaseColors } from "./registry.js";

function defineTheme(d: ThemeBaseColors): TerminalTheme {
  return new TerminalTheme(
    d.bg,
    d.fg,
    STANDARD_TABLE,
    buildPalette(d.name, d.dark, {
      primary: d.primary,
      secondary: d.secondary,
      accent: d.accent,
      success: d.success,
      warning: d.warning,
      error: d.error,
      background: d.bg,
      foreground: d.fg,
    }),
  );
}

// --- Inline themes (no data file backing) ---

export const DEFAULT_TERMINAL_THEME = defineTheme({
  name: "default",
  dark: true,
  bg: new ColorRgba(0, 0, 0),
  fg: new ColorRgba(255, 255, 255),
  primary: new ColorRgba(0, 111, 184),
  secondary: new ColorRgba(118, 38, 113),
  accent: new ColorRgba(0, 111, 184),
  success: new ColorRgba(0, 128, 0),
  warning: new ColorRgba(128, 128, 0),
  error: new ColorRgba(128, 0, 0),
});

export const SVG_EXPORT_THEME = defineTheme({
  name: "svg-export",
  dark: true,
  bg: new ColorRgba(41, 41, 41),
  fg: new ColorRgba(197, 200, 198),
  primary: new ColorRgba(97, 175, 239),
  secondary: new ColorRgba(198, 120, 221),
  accent: new ColorRgba(86, 182, 194),
  success: new ColorRgba(152, 195, 121),
  warning: new ColorRgba(229, 192, 123),
  error: new ColorRgba(204, 85, 90),
});

export const CATPPUCCIN_FRAPPE = defineTheme({
  name: "catppuccin-frappe",
  dark: true,
  bg: new ColorRgba(48, 52, 70),
  fg: new ColorRgba(198, 208, 245),
  primary: new ColorRgba(202, 158, 230),
  secondary: new ColorRgba(239, 159, 118),
  accent: new ColorRgba(244, 184, 228),
  success: new ColorRgba(166, 209, 137),
  warning: new ColorRgba(229, 200, 144),
  error: new ColorRgba(231, 130, 132),
});

export const CATPPUCCIN_MACCHIATO = defineTheme({
  name: "catppuccin-macchiato",
  dark: true,
  bg: new ColorRgba(36, 39, 58),
  fg: new ColorRgba(202, 211, 245),
  primary: new ColorRgba(198, 160, 246),
  secondary: new ColorRgba(245, 169, 127),
  accent: new ColorRgba(245, 189, 230),
  success: new ColorRgba(166, 218, 149),
  warning: new ColorRgba(238, 212, 159),
  error: new ColorRgba(237, 135, 150),
});

// --- Data-backed themes (truth lives in src/themes/data/<name>.ts) ---

export const MONOKAI = defineTheme(getThemeBaseColors("monokai"));
export const NORD = defineTheme(getThemeBaseColors("nord"));
export const GRUVBOX = defineTheme(getThemeBaseColors("gruvbox"));
export const DRACULA = defineTheme(getThemeBaseColors("dracula"));
export const TOKYO_NIGHT = defineTheme(getThemeBaseColors("tokyo-night"));
export const FLEXOKI = defineTheme(getThemeBaseColors("flexoki"));
export const CATPPUCCIN_MOCHA = defineTheme(getThemeBaseColors("catppuccin-mocha"));
export const CATPPUCCIN_LATTE = defineTheme(getThemeBaseColors("catppuccin-latte"));
export const SOLARIZED_DARK = defineTheme(getThemeBaseColors("solarized-dark"));
export const SOLARIZED_LIGHT = defineTheme(getThemeBaseColors("solarized-light"));
export const ROSE_PINE = defineTheme(getThemeBaseColors("rose-pine"));
export const ROSE_PINE_MOON = defineTheme(getThemeBaseColors("rose-pine-moon"));
export const ROSE_PINE_DAWN = defineTheme(getThemeBaseColors("rose-pine-dawn"));
export const ATOM_ONE_DARK = defineTheme(getThemeBaseColors("atom-one-dark"));
export const ATOM_ONE_LIGHT = defineTheme(getThemeBaseColors("atom-one-light"));
export const TEXTUAL_DARK = defineTheme(getThemeBaseColors("textual-dark"));
export const TEXTUAL_LIGHT = defineTheme(getThemeBaseColors("textual-light"));
export const TEXTUAL_ANSI = defineTheme(getThemeBaseColors("textual-ansi"));
