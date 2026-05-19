// Barrel: collects every per-theme file into a single typed map. `ThemeName`
// and the registry's name list are *derived* from `THEMES`, so the keys
// below define the canonical name set for the registry. Adding a theme:
//   1. drop a new `data/<name>.ts` file,
//   2. add it here,
//   3. (optional) add a matching `<NAME>` export in `terminalThemes.ts`
//      if you want a pre-built `TerminalTheme` constant alongside the
//      registry palette. Without step 3 the theme is still fully usable
//      via `getThemePalette(name)`.

import type { ThemePaletteData } from "./types.js";

import atomOneDark from "./atom-one-dark.js";
import atomOneLight from "./atom-one-light.js";
import catppuccinFrappe from "./catppuccin-frappe.js";
import catppuccinLatte from "./catppuccin-latte.js";
import catppuccinMacchiato from "./catppuccin-macchiato.js";
import catppuccinMocha from "./catppuccin-mocha.js";
import defaultTheme from "./default.js";
import dracula from "./dracula.js";
import flexoki from "./flexoki.js";
import gruvbox from "./gruvbox.js";
import monokai from "./monokai.js";
import nord from "./nord.js";
import rosePine from "./rose-pine.js";
import rosePineDawn from "./rose-pine-dawn.js";
import rosePineMoon from "./rose-pine-moon.js";
import solarizedDark from "./solarized-dark.js";
import solarizedLight from "./solarized-light.js";
import svgExport from "./svg-export.js";
import textualAnsi from "./textual-ansi.js";
import textualDark from "./textual-dark.js";
import textualLight from "./textual-light.js";
import tokyoNight from "./tokyo-night.js";

/**
 * All bundled theme palettes, keyed by name (20 Textual-ported + 2 rich-js
 * synthetic: `default` and `svg-export`). `as const` preserves the literal-
 * type keys so `ThemeName` (below) is `"atom-one-dark" | "..."`, not
 * `string`. Callers must type their input as `ThemeName` explicitly to get
 * compile-time safety; `getThemePalette(string)` still returns nullable.
 */
export const THEMES = {
  "atom-one-dark": atomOneDark,
  "atom-one-light": atomOneLight,
  "catppuccin-frappe": catppuccinFrappe,
  "catppuccin-latte": catppuccinLatte,
  "catppuccin-macchiato": catppuccinMacchiato,
  "catppuccin-mocha": catppuccinMocha,
  "default": defaultTheme,
  "dracula": dracula,
  "flexoki": flexoki,
  "gruvbox": gruvbox,
  "monokai": monokai,
  "nord": nord,
  "rose-pine": rosePine,
  "rose-pine-dawn": rosePineDawn,
  "rose-pine-moon": rosePineMoon,
  "solarized-dark": solarizedDark,
  "solarized-light": solarizedLight,
  "svg-export": svgExport,
  "textual-ansi": textualAnsi,
  "textual-dark": textualDark,
  "textual-light": textualLight,
  "tokyo-night": tokyoNight,
} as const satisfies Record<string, ThemePaletteData>;

export type ThemeName = keyof typeof THEMES;

export type { ThemePaletteData };
