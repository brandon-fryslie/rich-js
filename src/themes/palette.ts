import type { ColorTriplet } from "../core/color.js";

/**
 * A semantic palette: a named map from variable name → ColorTriplet.
 *
 * Distinct from `ColorTable` (the integer-indexed quantization LUT used by
 * the downgrade pipeline). Palettes carry aesthetic intent — `primary`,
 * `accent`, `error`, etc. — and are the foundation of the theming system.
 *
 * Storage is uniformly ColorTriplet; consumers that load from hex JSON
 * parse to triplets at load time. Spec resolution (modifier, alpha,
 * auto-contrast) lives in PaletteResolver, not here.
 */
export class Palette {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: ReadonlyMap<string, ColorTriplet>;

  constructor(
    name: string,
    dark: boolean,
    vars: ReadonlyMap<string, ColorTriplet>,
  ) {
    this.name = name;
    this.dark = dark;
    this.vars = vars;
  }

  get(key: string): ColorTriplet | undefined {
    return this.vars.get(key);
  }
}
