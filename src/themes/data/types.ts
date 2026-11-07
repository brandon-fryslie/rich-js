import type { BaseRole, PaletteRole } from "../palette.js";

/**
 * Static shape of a theme palette as authored. Each `data/<name>.ts` file
 * exports one of these as its default export. The barrel (`./index.ts`)
 * collects them into a single typed map; the registry consumes that map.
 *
 * Distinct from `Palette` — this is the on-disk authoring format (hex
 * strings); `Palette` is the runtime form (parsed ColorRgba values). The
 * registry's `getThemePalette` is the single boundary that hydrates one
 * into the other.
 */
export interface ThemePaletteData {
  readonly name: string;
  readonly dark: boolean;
  /**
   * The sixteen colors a terminal showing this theme draws `red`, `blue`,
   * `bright_black` and the rest in. A theme without its own table would draw
   * them in the VGA defaults (`blue` as #000080), which belong to no theme.
   */
  readonly ansi: AnsiColorsData;
  /**
   * The one of `ansi` this theme draws muted text in — a placeholder, a
   * continuation marker — where a terminal shows only those sixteen. Chosen by
   * hand, because rounding the theme's muted color lands it in its text's
   * slot on several themes, and the slot nearest it by distance is often a
   * hue: a slot that reads as receding, apart from the text, at its floor.
   */
  readonly ansiMuted: AnsiSlot;
  /** The base roles and any other role this theme states; the rest are derived. */
  readonly vars: Readonly<Record<BaseRole, string> & Partial<Record<PaletteRole, string>>>;
}

/**
 * ANSI color numbers 0–15 in order: the eight normal colors, then their
 * bright forms. Named rather than positional so a data file cannot shift a
 * color into its neighbour's slot by miscounting.
 */
export const ANSI_SLOTS = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

/** One of the sixteen ANSI colors, by name. */
export type AnsiSlot = (typeof ANSI_SLOTS)[number];

/** One `#RRGGBB` per ANSI color number, keyed by `ANSI_SLOTS`. */
export type AnsiColorsData = { readonly [K in (typeof ANSI_SLOTS)[number]]: string };
