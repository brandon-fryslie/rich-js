// Barrel: collects every per-theme file into a single typed map. The 18
// imports below are the *only* place this list of names is hardcoded —
// everything else (registry, ThemeName type) is derived from `THEMES`,
// so adding a theme means: drop a new file, add it here, done.

import type { ThemePaletteData } from "./types.js";

import atomOneDark from "./atom-one-dark.js";
import atomOneLight from "./atom-one-light.js";
import catppuccinLatte from "./catppuccin-latte.js";
import catppuccinMocha from "./catppuccin-mocha.js";
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
import textualAnsi from "./textual-ansi.js";
import textualDark from "./textual-dark.js";
import textualLight from "./textual-light.js";
import tokyoNight from "./tokyo-night.js";

/**
 * The 18 bundled Textual theme palettes, keyed by name. `as const` preserves
 * the literal-type keys so `ThemeName` (below) is `"atom-one-dark" | "..."`,
 * not `string` — callers passing an unknown name fail at compile time.
 */
export const THEMES = {
  "atom-one-dark": atomOneDark,
  "atom-one-light": atomOneLight,
  "catppuccin-latte": catppuccinLatte,
  "catppuccin-mocha": catppuccinMocha,
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
  "textual-ansi": textualAnsi,
  "textual-dark": textualDark,
  "textual-light": textualLight,
  "tokyo-night": tokyoNight,
} as const satisfies Record<string, ThemePaletteData>;

export type ThemeName = keyof typeof THEMES;

export type { ThemePaletteData };
