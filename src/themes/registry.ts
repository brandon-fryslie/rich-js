import { ColorRgba, parseRgbHex, parseRgbaHex } from "../core/color.js";
import { Palette } from "./palette.js";
import { THEMES, type ThemeName, type ThemePaletteData } from "./data/index.js";

export type { ThemeName };

const THEME_NAMES = Object.freeze(Object.keys(THEMES).sort() as readonly ThemeName[]);

const cache = new Map<ThemeName, Palette>();

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

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const palette = hydrate(THEMES[name]);
  cache.set(name, palette);
  return palette;
}

function isThemeName(name: string): name is ThemeName {
  return Object.hasOwn(THEMES, name);
}

/**
 * Parse a `ThemePaletteData`'s hex strings into a Palette of ColorRgba.
 *
 * [LAW:single-enforcer] Hex → ColorRgba conversion for theme data lives
 * here, not on Palette. Keeping the parser in this module preserves the
 * `core/color → themes/palette` one-way edge (palette.ts must not import
 * ColorRgba as a value, or it cycles with core/color's own use of Palette
 * for INTERNAL_DEFAULT_THEME).
 */
function hydrate(data: ThemePaletteData): Palette {
  const map = new Map<string, ColorRgba>();
  for (const [k, v] of Object.entries(data.vars)) {
    map.set(k, parseHex(v, data.name, k));
  }
  return new Palette(data.name, data.dark, map);
}

function parseHex(value: string, theme: string, key: string): ColorRgba {
  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (hex.length === 6) return parseRgbHex(hex);
  if (hex.length === 8) return parseRgbaHex(hex);
  throw new Error(
    `Theme ${theme}: var ${key} has invalid hex ${JSON.stringify(value)} ` +
      `(expected #RRGGBB or #RRGGBBAA)`,
  );
}
