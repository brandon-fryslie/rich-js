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
   * The sixteen colours a terminal showing this theme draws `red`, `blue`,
   * `bright_black` and the rest in. A theme without its own table would draw
   * them in the VGA defaults (`blue` as #000080), which belong to no theme.
   */
  readonly ansi: AnsiColorsData;
  readonly vars: Readonly<Record<string, string>>;
}

/**
 * ANSI colour numbers 0–15 in order: the eight normal colours, then their
 * bright forms. Named rather than positional so a data file cannot shift a
 * colour into its neighbour's slot by miscounting.
 */
export const ANSI_SLOTS = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

/** One `#RRGGBB` per ANSI colour number, keyed by `ANSI_SLOTS`. */
export type AnsiColorsData = { readonly [K in (typeof ANSI_SLOTS)[number]]: string };
