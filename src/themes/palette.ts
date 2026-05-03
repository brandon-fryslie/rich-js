import type { ColorRgba } from "../core/color.js";

/**
 * A semantic palette: a named map from variable name → ColorRgba.
 *
 * Distinct from `ColorTable` (the integer-indexed quantization LUT used by
 * the downgrade pipeline). Palettes carry aesthetic intent — `primary`,
 * `accent`, `error`, etc. — and are the foundation of the theming system.
 *
 * Storage is uniformly ColorRgba; consumers that load from hex JSON
 * parse to ColorRgba at load time. Spec resolution (modifier, alpha,
 * auto-contrast) lives in PaletteResolver, not here.
 */
export class Palette {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: ReadonlyMap<string, ColorRgba>;

  constructor(
    name: string,
    dark: boolean,
    vars: ReadonlyMap<string, ColorRgba>,
  ) {
    this.name = name;
    this.dark = dark;
    // Defensive copy: ReadonlyMap is a compile-time aliasing constraint, not a
    // runtime one. Copying at the seam makes Palette genuinely immutable.
    this.vars = new Map(vars);
  }

  get(key: string): ColorRgba | undefined {
    return this.vars.get(key);
  }
}
