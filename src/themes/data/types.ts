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
  readonly vars: Readonly<Record<string, string>>;
}
