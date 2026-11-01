/**
 * Pre-built `TerminalTheme` constants — every theme in the registry has a
 * matching `<NAME>` export here. There is no inline-only theme; the data
 * file is the single source of truth for every theme's hex values.
 *
 * [LAW:one-source-of-truth] Hex values live in `data/<name>.ts`, and a theme's
 * name means one palette: a constant here holds the very `Palette`
 * `getThemePalette(name)` returns, with the theme's background, foreground and
 * sixteen named colours beside it.
 *
 * [LAW:one-type-per-behavior] Every theme has the same shape — name,
 * `dark` flag, full Palette in the registry, `TerminalTheme` constant
 * here. Consumers can pick any theme by name without branching on which
 * APIs work for it.
 *
 * [LAW:one-way-deps] `core/color → themes/palette` remains the only edge
 * into themes/. This file imports only sibling theme modules and core
 * color primitives; nothing in `core/` imports back.
 */

import { TerminalTheme } from "../core/color.js";
import { getThemeBaseColors, getThemePalette, type ThemeName } from "./registry.js";

function defineTheme(name: ThemeName): TerminalTheme {
  const { bg, fg, ansi } = getThemeBaseColors(name);
  return new TerminalTheme(bg, fg, ansi, getThemePalette(name));
}

export const DEFAULT_TERMINAL_THEME = defineTheme("default");
export const SVG_EXPORT_THEME = defineTheme("svg-export");
export const MONOKAI = defineTheme("monokai");
export const NORD = defineTheme("nord");
export const GRUVBOX = defineTheme("gruvbox");
export const DRACULA = defineTheme("dracula");
export const TOKYO_NIGHT = defineTheme("tokyo-night");
export const FLEXOKI = defineTheme("flexoki");
export const CYBERPUNK = defineTheme("cyberpunk");
export const CATPPUCCIN_MOCHA = defineTheme("catppuccin-mocha");
export const CATPPUCCIN_LATTE = defineTheme("catppuccin-latte");
export const CATPPUCCIN_FRAPPE = defineTheme("catppuccin-frappe");
export const CATPPUCCIN_MACCHIATO = defineTheme("catppuccin-macchiato");
export const SOLARIZED_DARK = defineTheme("solarized-dark");
export const SOLARIZED_LIGHT = defineTheme("solarized-light");
export const ROSE_PINE = defineTheme("rose-pine");
export const ROSE_PINE_MOON = defineTheme("rose-pine-moon");
export const ROSE_PINE_DAWN = defineTheme("rose-pine-dawn");
export const ATOM_ONE_DARK = defineTheme("atom-one-dark");
export const ATOM_ONE_LIGHT = defineTheme("atom-one-light");
export const TEXTUAL_DARK = defineTheme("textual-dark");
export const TEXTUAL_LIGHT = defineTheme("textual-light");
export const TEXTUAL_ANSI = defineTheme("textual-ansi");
