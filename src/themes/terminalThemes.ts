/**
 * Pre-built `TerminalTheme` constants — every theme in the registry has a
 * matching `<NAME>` export here. There is no inline-only theme; the data
 * file is the single source of truth for every theme's hex values.
 *
 * Editing `data/<name>.ts` updates both the registry's full ~150-var
 * palette (via `getThemePalette(name)`) AND the matching `TerminalTheme`
 * constant exported below (via `getThemeBaseColors(name)`, which pulls
 * just the 8 substrate keys). The two views never drift because both
 * derive from the same authored data.
 *
 * [LAW:one-source-of-truth] Hex values live in `data/<name>.ts`. This
 * module is a derived view that builds a `TerminalTheme` from each
 * theme's eight base colors via `buildPalette` for the substrate palette
 * and `STANDARD_TABLE` for the ANSI substrate.
 *
 * [LAW:one-type-per-behavior] Every theme has the same shape — name,
 * `dark` flag, full Palette in the registry, `TerminalTheme` constant
 * here. Consumers can pick any theme by name without branching on which
 * APIs work for it.
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

export const DEFAULT_TERMINAL_THEME = defineTheme(getThemeBaseColors("default"));
export const SVG_EXPORT_THEME = defineTheme(getThemeBaseColors("svg-export"));
export const MONOKAI = defineTheme(getThemeBaseColors("monokai"));
export const NORD = defineTheme(getThemeBaseColors("nord"));
export const GRUVBOX = defineTheme(getThemeBaseColors("gruvbox"));
export const DRACULA = defineTheme(getThemeBaseColors("dracula"));
export const TOKYO_NIGHT = defineTheme(getThemeBaseColors("tokyo-night"));
export const FLEXOKI = defineTheme(getThemeBaseColors("flexoki"));
export const CATPPUCCIN_MOCHA = defineTheme(getThemeBaseColors("catppuccin-mocha"));
export const CATPPUCCIN_LATTE = defineTheme(getThemeBaseColors("catppuccin-latte"));
export const CATPPUCCIN_FRAPPE = defineTheme(getThemeBaseColors("catppuccin-frappe"));
export const CATPPUCCIN_MACCHIATO = defineTheme(getThemeBaseColors("catppuccin-macchiato"));
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
