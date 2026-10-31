import { ColorParseError, ColorRgba, ColorTable, parseHexColor } from "../core/color.js";
import { drawnOn, type BaseRole, type Palette } from "./palette.js";
import { buildPalette, type StatedRoles } from "./buildPalette.js";
import { THEMES, type ThemeName, type ThemePaletteData } from "./data/index.js";
import { ANSI_SLOTS } from "./data/types.js";
import { Memo } from "../core/memo.js";

export type { ThemeName };

const THEME_NAMES = Object.freeze(Object.keys(THEMES).sort() as readonly ThemeName[]);

// Fewer themes than a Memo holds, so it never clears and a name keeps one
// Palette — test/themes/registry.test.ts holds that.
const cache = new Memo<Palette, ThemeName>();

/**
 * Returns the static list of available theme names. Pure and synchronous.
 */
export function listThemePalettes(): readonly ThemeName[] {
  return THEME_NAMES;
}

/**
 * Returns the Palette for `name`, or `null` if unknown.
 *
 * Synchronous: theme data is bundled at compile time via the data barrel,
 * so no I/O happens here. The Palette itself (which requires hex-parsing
 * ~150 vars into ColorRgba values) is constructed lazily on first request
 * and cached — subsequent calls for the same name return the same instance.
 */
export function getThemePalette(name: ThemeName): Palette;
export function getThemePalette(name: string): Palette | null;
export function getThemePalette(name: string): Palette | null {
  if (!isThemeName(name)) return null;

  return cache.get(name, () => hydrate(THEMES[name]));
}

function isThemeName(name: string): name is ThemeName {
  return Object.hasOwn(THEMES, name);
}

/**
 * The eight base colors every theme must declare, and its ANSI table. Returned by
 * `getThemeBaseColors` for callers (notably `terminalThemes.ts`) that only
 * need the substrate and would otherwise fill the registry cache.
 */
export interface ThemeBaseColors {
  readonly name: string;
  readonly dark: boolean;
  readonly bg: ColorRgba;
  readonly fg: ColorRgba;
  readonly primary: ColorRgba;
  readonly secondary: ColorRgba;
  readonly accent: ColorRgba;
  readonly success: ColorRgba;
  readonly warning: ColorRgba;
  readonly error: ColorRgba;
  readonly ansi: ColorTable;
}

/**
 * Read just the eight base colors from a theme's data file. Cheap — parses
 * 8 hex strings, allocates no Palette, touches no cache. Use this when you
 * want a `TerminalTheme`-shaped substrate without forcing the full ~150-var
 * palette through the registry's hydration path.
 */
export function getThemeBaseColors(name: ThemeName): ThemeBaseColors {
  const data = THEMES[name];
  const bg = parseHex(data.vars.background, data.name, "background");
  // The colours `getThemePalette(name)` hands out for the same names: drawn on
  // the theme's own background, as a Palette draws every colour it holds.
  const draw = drawnOn(data.name, bg);
  const base = (key: BaseRole): ColorRgba => draw(parseHex(data.vars[key], data.name, key));
  return {
    name: data.name,
    dark: data.dark,
    bg,
    fg: base("foreground"),
    primary: base("primary"),
    secondary: base("secondary"),
    accent: base("accent"),
    success: base("success"),
    warning: base("warning"),
    error: base("error"),
    ansi: new ColorTable(ANSI_SLOTS.map((slot) => parseOpaqueHex(data.ansi[slot], data.name, `ansi.${slot}`))),
  };
}

/**
 * Parse a `ThemePaletteData`'s hex strings into a Palette of ColorRgba.
 *
 * [LAW:single-enforcer] Hex → ColorRgba conversion for theme data lives
 * here, not on Palette; what a theme does not state, `buildPalette` derives.
 */
function hydrate(data: ThemePaletteData): Palette {
  const stated = Object.entries(data.vars).map(([role, hex]) => [role, parseHex(hex, data.name, `var ${role}`)]);
  return buildPalette(data.name, data.dark, Object.fromEntries(stated) as StatedRoles);
}

// Theme data is authored, so a malformed colour names the theme and the key it
// sits under; the grammar itself is `parseHexColor`'s.
function parseHex(value: string, theme: string, key: string): ColorRgba {
  try {
    return parseHexColor(value);
  } catch (cause) {
    if (!(cause instanceof ColorParseError)) throw cause;
    throw new Error(`Theme ${theme}: ${key}: ${cause.message}`, { cause });
  }
}

/**
 * An ANSI slot is a colour a terminal paints, never a blend, so it takes no
 * alpha: `flattenAlpha` leaves a STANDARD spec alone and would pass one through.
 */
function parseOpaqueHex(value: string, theme: string, key: string): ColorRgba {
  const color = parseHex(value, theme, key);
  if (color.alpha !== 1) {
    throw new Error(`Theme ${theme}: ${key} has alpha in ${JSON.stringify(value)} (expected #RRGGBB)`);
  }
  return color;
}
