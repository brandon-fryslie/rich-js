import { Palette } from "./palette.js";
import { THEMES, type ThemeName } from "./data/index.js";

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
 * 150 vars into ColorQuads) is constructed lazily on first request and
 * cached — subsequent calls for the same name return the same instance.
 */
export function getThemePalette(name: ThemeName): Palette;
export function getThemePalette(name: string): Palette | null;
export function getThemePalette(name: string): Palette | null {
  if (!isThemeName(name)) return null;

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const data = THEMES[name];
  const palette = Palette.fromHex(data.name, data.dark, data.vars);
  cache.set(name, palette);
  return palette;
}

function isThemeName(name: string): name is ThemeName {
  return Object.hasOwn(THEMES, name);
}
