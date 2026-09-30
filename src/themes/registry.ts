import { ColorRgba, ColorTable, parseRgbHex, parseRgbaHex } from "../core/color.js";
import { Palette, drawnOn } from "./palette.js";
import { THEMES, type ThemeName, type ThemePaletteData } from "./data/index.js";
import { ANSI_SLOTS } from "./data/types.js";

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
 * The eight base colors every theme must declare, and its ANSI table. Returned by
 * `getThemeBaseColors` for callers (notably `terminalThemes.ts`) that only
 * need the substrate and would otherwise pay the cost of hydrating the
 * full ~150-var palette and polluting the registry cache.
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
  const bg = requireBaseVar(data, "background");
  // The colours `getThemePalette(name)` hands out for the same names: drawn on
  // the theme's own background, as a Palette draws every colour it holds.
  const draw = drawnOn(bg);
  const base = (key: string): ColorRgba => draw(key, requireBaseVar(data, key));
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

function requireBaseVar(data: ThemePaletteData, key: string): ColorRgba {
  const v = data.vars[key];
  if (v === undefined) {
    throw new Error(
      `Theme ${data.name}: required base var "${key}" missing from data file`,
    );
  }
  return parseHex(v, data.name, key);
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

// [LAW:single-enforcer] This is the loud-failure boundary for theme hex
// data. `parseRgbHex`/`parseRgbaHex` in core/color.ts trust their input
// shape (they assume the caller validated); here we are the caller from
// the untrusted side (authored data files) and the place that has to
// reject `"0G"`, `""`, `"#GGGGGG"`, etc.
const HEX_RE = /^[0-9a-fA-F]+$/;

/**
 * An ANSI slot is a colour a terminal paints, never a blend, so it takes no
 * alpha: `flattenAlpha` leaves a STANDARD spec alone and would pass one through.
 */
function parseOpaqueHex(value: string, theme: string, key: string): ColorRgba {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    throw new Error(`Theme ${theme}: ${key} has invalid hex ${JSON.stringify(value)} (expected #RRGGBB)`);
  }
  return parseRgbHex(value.slice(1));
}

function parseHex(value: string, theme: string, key: string): ColorRgba {
  const hex = value.startsWith("#") ? value.slice(1) : value;
  if ((hex.length !== 6 && hex.length !== 8) || !HEX_RE.test(hex)) {
    throw new Error(
      `Theme ${theme}: var ${key} has invalid hex ${JSON.stringify(value)} ` +
        `(expected #RRGGBB or #RRGGBBAA)`,
    );
  }
  return hex.length === 6 ? parseRgbHex(hex) : parseRgbaHex(hex);
}
