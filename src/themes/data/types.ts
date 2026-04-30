/**
 * Static shape of a theme palette as authored. Each `data/<name>.ts` file
 * exports one of these as its default export. The barrel (`./index.ts`)
 * collects them into a single typed map; the registry consumes that map.
 *
 * Distinct from `Palette` (the runtime class with parsed ColorQuads): this
 * type is the on-disk authoring format, hex strings included. Conversion
 * happens in `getThemePalette` via `Palette.fromHex`.
 */
export interface ThemePaletteData {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: Readonly<Record<string, string>>;
}
