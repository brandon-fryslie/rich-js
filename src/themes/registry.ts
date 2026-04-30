import { Palette } from "./palette.js";

import atomOneDark from "./data/atom-one-dark.json";
import atomOneLight from "./data/atom-one-light.json";
import catppuccinLatte from "./data/catppuccin-latte.json";
import catppuccinMocha from "./data/catppuccin-mocha.json";
import dracula from "./data/dracula.json";
import flexoki from "./data/flexoki.json";
import gruvbox from "./data/gruvbox.json";
import monokai from "./data/monokai.json";
import nord from "./data/nord.json";
import rosePine from "./data/rose-pine.json";
import rosePineDawn from "./data/rose-pine-dawn.json";
import rosePineMoon from "./data/rose-pine-moon.json";
import solarizedDark from "./data/solarized-dark.json";
import solarizedLight from "./data/solarized-light.json";
import textualAnsi from "./data/textual-ansi.json";
import textualDark from "./data/textual-dark.json";
import textualLight from "./data/textual-light.json";
import tokyoNight from "./data/tokyo-night.json";

interface ThemeJson {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: Record<string, string>;
}

/**
 * The 18 Textual theme palettes shipped with rich-js, indexed by name.
 *
 * All JSONs are statically imported. Bundle cost for the full set is
 * ~12 KB gzipped — negligible against any realistic consumer (a single
 * page load on a typical site is hundreds of times larger). The earlier
 * dynamic-import design optimized for browser tree-shaking, but the
 * primary consumers are Node CLIs where bundle weight doesn't matter,
 * and the async API forced every caller to be async for no benefit.
 *
 * [LAW:one-source-of-truth] This map is the only place theme names map
 * to data. `listThemePalettes` and `getThemePalette` both read from it.
 */
const THEME_DATA: Record<string, ThemeJson> = {
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
};

const THEME_NAMES = Object.keys(THEME_DATA).sort() as readonly string[];

export type ThemeName = keyof typeof THEME_DATA;

const cache = new Map<string, Palette>();

/**
 * Returns the static list of available theme names. Pure and synchronous.
 */
export function listThemePalettes(): readonly string[] {
  return THEME_NAMES;
}

/**
 * Returns the Palette for `name`, or `null` if unknown.
 *
 * Synchronous: theme JSONs are statically imported, so no I/O happens here.
 * The Palette itself (which requires hex-parsing 150 vars into ColorQuads)
 * is constructed lazily on first request and cached — subsequent calls
 * for the same name return the same instance.
 */
export function getThemePalette(name: string): Palette | null {
  const data = THEME_DATA[name];
  if (data === undefined) return null;

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const palette = Palette.fromHex(data.name, data.dark, data.vars);
  cache.set(name, palette);
  return palette;
}
