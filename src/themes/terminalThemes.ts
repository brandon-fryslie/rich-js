/**
 * Pre-built `TerminalTheme` constants — default + 18 Textual-derived themes.
 *
 * Lives here (not in `core/color.ts`) because each theme uses `buildPalette` to
 * derive its semantic palette, and `buildPalette` itself depends on
 * `core/color.ts`. Keeping presets out of core breaks the cycle while
 * preserving a single one-way edge `core/color → themes/palette` (used only
 * for the small `INTERNAL_DEFAULT_THEME` substrate inside `getTruecolor`).
 *
 * [LAW:one-way-deps] core/color → themes/palette is the only edge into themes/.
 * The reverse cycle through `TerminalTheme` presets has been broken by
 * extracting them here; nothing in `core/color.ts` imports this file.
 *
 * [LAW:one-source-of-truth] Each preset's background and foreground are stated
 * once and forwarded by `defineTheme` to both the `TerminalTheme` constructor
 * (substrate colours) and the `buildPalette` base (semantic-palette baseline).
 * This forecloses the drift the previous shape allowed, where the two copies
 * could be edited independently.
 *
 * Note on `ansiColors`: every preset theme uses `STANDARD_TABLE` for its
 * `ansiColors` field. Theme identity in this codebase lives in the semantic
 * `palette` (primary, accent, text-*, surface, ...), not in the standard ANSI
 * 16/256 LUT. `ColorSpec.parse("red")` is intentionally canonical across
 * themes — the same way Textual itself models theming.
 */

import {
  ColorRgba,
  STANDARD_TABLE,
  TerminalTheme,
} from "../core/color.js";
import { buildPalette } from "./buildPalette.js";

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

export const MONOKAI = defineTheme({
  name: "monokai",
  isDark: true,
  bg: new ColorRgba(39, 40, 34),
  fg: new ColorRgba(214, 214, 214),
  primary: new ColorRgba(174, 129, 255),
  secondary: new ColorRgba(249, 38, 114),
  accent: new ColorRgba(102, 217, 239),
  success: new ColorRgba(166, 226, 46),
  warning: new ColorRgba(253, 151, 31),
  error: new ColorRgba(249, 38, 114),
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

export const NORD = defineTheme({
  name: "nord",
  isDark: true,
  bg: new ColorRgba(46, 52, 64),
  fg: new ColorRgba(216, 222, 233),
  primary: new ColorRgba(136, 192, 208),
  secondary: new ColorRgba(129, 161, 193),
  accent: new ColorRgba(180, 142, 173),
  success: new ColorRgba(163, 190, 140),
  warning: new ColorRgba(235, 203, 139),
  error: new ColorRgba(191, 97, 106),
});

export const GRUVBOX = defineTheme({
  name: "gruvbox",
  isDark: true,
  bg: new ColorRgba(40, 40, 40),
  fg: new ColorRgba(251, 241, 199),
  primary: new ColorRgba(133, 165, 152),
  secondary: new ColorRgba(168, 154, 133),
  accent: new ColorRgba(250, 189, 47),
  success: new ColorRgba(184, 187, 38),
  warning: new ColorRgba(254, 128, 25),
  error: new ColorRgba(251, 73, 52),
});

export const DRACULA = defineTheme({
  name: "dracula",
  isDark: true,
  bg: new ColorRgba(40, 42, 54),
  fg: new ColorRgba(248, 248, 242),
  primary: new ColorRgba(189, 147, 249),
  secondary: new ColorRgba(98, 114, 164),
  accent: new ColorRgba(255, 121, 198),
  success: new ColorRgba(80, 250, 123),
  warning: new ColorRgba(255, 184, 108),
  error: new ColorRgba(255, 85, 85),
});

export const TOKYO_NIGHT = defineTheme({
  name: "tokyo-night",
  isDark: true,
  bg: new ColorRgba(26, 27, 38),
  fg: new ColorRgba(169, 177, 214),
  primary: new ColorRgba(187, 154, 247),
  secondary: new ColorRgba(122, 162, 247),
  accent: new ColorRgba(255, 158, 100),
  success: new ColorRgba(158, 206, 106),
  warning: new ColorRgba(224, 175, 104),
  error: new ColorRgba(247, 118, 142),
});

export const FLEXOKI = defineTheme({
  name: "flexoki",
  isDark: true,
  bg: new ColorRgba(16, 15, 15),
  fg: new ColorRgba(255, 252, 240),
  primary: new ColorRgba(32, 94, 166),
  secondary: new ColorRgba(36, 131, 123),
  accent: new ColorRgba(155, 118, 200),
  success: new ColorRgba(102, 128, 11),
  warning: new ColorRgba(173, 131, 1),
  error: new ColorRgba(175, 48, 41),
});

export const CATPPUCCIN_MOCHA = defineTheme({
  name: "catppuccin-mocha",
  isDark: true,
  bg: new ColorRgba(24, 24, 37),
  fg: new ColorRgba(205, 214, 244),
  primary: new ColorRgba(245, 194, 231),
  secondary: new ColorRgba(203, 166, 247),
  accent: new ColorRgba(250, 179, 135),
  success: new ColorRgba(171, 233, 179),
  warning: new ColorRgba(250, 227, 176),
  error: new ColorRgba(242, 143, 173),
});

export const CATPPUCCIN_LATTE = defineTheme({
  name: "catppuccin-latte",
  isDark: false,
  bg: new ColorRgba(239, 241, 245),
  fg: new ColorRgba(76, 79, 105),
  primary: new ColorRgba(136, 57, 239),
  secondary: new ColorRgba(220, 138, 120),
  accent: new ColorRgba(254, 100, 11),
  success: new ColorRgba(64, 160, 43),
  warning: new ColorRgba(223, 142, 29),
  error: new ColorRgba(210, 15, 57),
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

export const SOLARIZED_DARK = defineTheme({
  name: "solarized-dark",
  isDark: true,
  bg: new ColorRgba(0, 43, 54),
  fg: new ColorRgba(131, 148, 150),
  primary: new ColorRgba(38, 139, 210),
  secondary: new ColorRgba(42, 161, 152),
  accent: new ColorRgba(108, 113, 196),
  success: new ColorRgba(133, 153, 0),
  warning: new ColorRgba(203, 75, 22),
  error: new ColorRgba(220, 50, 47),
});

export const SOLARIZED_LIGHT = defineTheme({
  name: "solarized-light",
  isDark: false,
  bg: new ColorRgba(253, 246, 227),
  fg: new ColorRgba(88, 110, 117),
  primary: new ColorRgba(38, 139, 210),
  secondary: new ColorRgba(42, 161, 152),
  accent: new ColorRgba(108, 113, 196),
  success: new ColorRgba(133, 153, 0),
  warning: new ColorRgba(203, 75, 22),
  error: new ColorRgba(220, 50, 47),
});

export const ROSE_PINE = defineTheme({
  name: "rose-pine",
  isDark: true,
  bg: new ColorRgba(25, 23, 36),
  fg: new ColorRgba(224, 222, 244),
  primary: new ColorRgba(196, 167, 231),
  secondary: new ColorRgba(49, 116, 143),
  accent: new ColorRgba(235, 188, 186),
  success: new ColorRgba(156, 207, 216),
  warning: new ColorRgba(246, 193, 119),
  error: new ColorRgba(235, 111, 146),
});

export const ROSE_PINE_MOON = defineTheme({
  name: "rose-pine-moon",
  isDark: true,
  bg: new ColorRgba(35, 33, 54),
  fg: new ColorRgba(224, 222, 244),
  primary: new ColorRgba(196, 167, 231),
  secondary: new ColorRgba(62, 143, 176),
  accent: new ColorRgba(234, 154, 151),
  success: new ColorRgba(156, 207, 216),
  warning: new ColorRgba(246, 193, 119),
  error: new ColorRgba(235, 111, 146),
});

export const ROSE_PINE_DAWN = defineTheme({
  name: "rose-pine-dawn",
  isDark: false,
  bg: new ColorRgba(250, 244, 237),
  fg: new ColorRgba(87, 82, 121),
  primary: new ColorRgba(144, 122, 169),
  secondary: new ColorRgba(40, 105, 131),
  accent: new ColorRgba(215, 130, 126),
  success: new ColorRgba(86, 148, 159),
  warning: new ColorRgba(234, 157, 52),
  error: new ColorRgba(180, 99, 122),
});

export const ATOM_ONE_DARK = defineTheme({
  name: "atom-one-dark",
  isDark: true,
  bg: new ColorRgba(40, 44, 52),
  fg: new ColorRgba(171, 178, 191),
  primary: new ColorRgba(97, 175, 239),
  secondary: new ColorRgba(198, 120, 221),
  accent: new ColorRgba(163, 120, 194),
  success: new ColorRgba(98, 240, 98),
  warning: new ColorRgba(222, 178, 91),
  error: new ColorRgba(240, 98, 98),
});

export const ATOM_ONE_LIGHT = defineTheme({
  name: "atom-one-light",
  isDark: false,
  bg: new ColorRgba(250, 250, 250),
  fg: new ColorRgba(56, 58, 66),
  primary: new ColorRgba(64, 120, 242),
  secondary: new ColorRgba(166, 38, 164),
  accent: new ColorRgba(191, 146, 50),
  success: new ColorRgba(108, 242, 63),
  warning: new ColorRgba(216, 217, 56),
  error: new ColorRgba(242, 63, 63),
});
