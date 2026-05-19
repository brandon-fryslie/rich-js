/**
 * Pre-built `TerminalTheme` constants — default + the named Textual themes.
 *
 * Two groups live here:
 *
 *   1. Themes with authored data files in `./data/*.ts`. Their base colours
 *      are pulled out of the registry's `Palette` so the data file is the
 *      single source of truth — editing a hex in `data/<name>.ts` updates
 *      both the registry's full palette AND the matching `TerminalTheme`
 *      constant exported below.
 *
 *   2. Themes without a data file (`default`, `svg-export`,
 *      `catppuccin-frappe`, `catppuccin-macchiato`). These stay stated
 *      inline. Each one's bg/fg are stated once and forwarded by
 *      `defineTheme` to both the `TerminalTheme` constructor and the
 *      `buildPalette` base.
 *
 * [LAW:one-source-of-truth] For data-backed themes the truth lives in
 * `data/<name>.ts`; this module is a derived view. For inline themes the
 * truth lives in the `defineTheme` call below; `defineTheme` forwards
 * bg/fg into both sinks so they cannot drift.
 *
 * [LAW:one-way-deps] `core/color → themes/palette` remains the only edge
 * into themes/. This file imports only sibling theme modules and core color
 * primitives; nothing in `core/` imports back.
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
import { getThemePalette, type ThemeName } from "./registry.js";

interface ThemeDef {
  readonly name: string;
  readonly isDark: boolean;
  readonly bg: ColorRgba;
  readonly fg: ColorRgba;
  readonly primary: ColorRgba;
  readonly secondary: ColorRgba;
  readonly accent: ColorRgba;
  readonly success: ColorRgba;
  readonly warning: ColorRgba;
  readonly error: ColorRgba;
}

function defineTheme(d: ThemeDef): TerminalTheme {
  return new TerminalTheme(
    d.bg,
    d.fg,
    STANDARD_TABLE,
    buildPalette(d.name, d.isDark, {
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

/**
 * Derive a `ThemeDef` from a data-backed Palette. Throws if any of the eight
 * required base vars is missing — invalid data fails loud at module init
 * rather than producing a half-built theme.
 */
function defFromData(name: ThemeName): ThemeDef {
  const palette = getThemePalette(name);
  const must = (key: string): ColorRgba => {
    const v = palette.get(key);
    if (!v) {
      throw new Error(
        `Theme ${palette.name}: required var "${key}" missing from data/${name}.ts`,
      );
    }
    return v;
  };
  return {
    name: palette.name,
    isDark: palette.dark,
    bg: must("background"),
    fg: must("foreground"),
    primary: must("primary"),
    secondary: must("secondary"),
    accent: must("accent"),
    success: must("success"),
    warning: must("warning"),
    error: must("error"),
  };
}

// --- Inline themes (no data file backing) ---

export const DEFAULT_TERMINAL_THEME = defineTheme({
  name: "default",
  isDark: true,
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
  isDark: true,
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
  isDark: true,
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
  isDark: true,
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

export const MONOKAI = defineTheme(defFromData("monokai"));
export const NORD = defineTheme(defFromData("nord"));
export const GRUVBOX = defineTheme(defFromData("gruvbox"));
export const DRACULA = defineTheme(defFromData("dracula"));
export const TOKYO_NIGHT = defineTheme(defFromData("tokyo-night"));
export const FLEXOKI = defineTheme(defFromData("flexoki"));
export const CATPPUCCIN_MOCHA = defineTheme(defFromData("catppuccin-mocha"));
export const CATPPUCCIN_LATTE = defineTheme(defFromData("catppuccin-latte"));
export const SOLARIZED_DARK = defineTheme(defFromData("solarized-dark"));
export const SOLARIZED_LIGHT = defineTheme(defFromData("solarized-light"));
export const ROSE_PINE = defineTheme(defFromData("rose-pine"));
export const ROSE_PINE_MOON = defineTheme(defFromData("rose-pine-moon"));
export const ROSE_PINE_DAWN = defineTheme(defFromData("rose-pine-dawn"));
export const ATOM_ONE_DARK = defineTheme(defFromData("atom-one-dark"));
export const ATOM_ONE_LIGHT = defineTheme(defFromData("atom-one-light"));
export const TEXTUAL_DARK = defineTheme(defFromData("textual-dark"));
export const TEXTUAL_LIGHT = defineTheme(defFromData("textual-light"));
export const TEXTUAL_ANSI = defineTheme(defFromData("textual-ansi"));
