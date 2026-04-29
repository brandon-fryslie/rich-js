import { ColorQuad, parseRgbaHex } from "../core/color.js";

/**
 * A semantic palette: a named map from variable name → ColorQuad.
 *
 * Distinct from `ColorTable` (the integer-indexed quantization LUT used by
 * the downgrade pipeline). Palettes carry aesthetic intent — `primary`,
 * `accent`, `error`, etc. — and are the foundation of the theming system.
 *
 * Storage is uniformly ColorQuad (RGBA): upstream Textual data ships
 * variables with alpha (e.g. `boost = #FFFFFF0A`) for translucent overlays,
 * and dropping alpha at the data layer would erase that intent. Alpha is
 * carried through resolution; flattening to ColorTriplet happens at the
 * render boundary, where the surface bg is known.
 *
 * Spec resolution (modifier, alpha, auto-contrast) lives in PaletteResolver,
 * not here.
 */
export class Palette {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: ReadonlyMap<string, ColorQuad>;

  constructor(
    name: string,
    dark: boolean,
    vars: ReadonlyMap<string, ColorQuad>,
  ) {
    this.name = name;
    this.dark = dark;
    // Defensive copy: ReadonlyMap is a compile-time aliasing constraint, not a
    // runtime one. Copying at the seam makes Palette genuinely immutable.
    this.vars = new Map(vars);
  }

  get(key: string): ColorQuad | undefined {
    return this.vars.get(key);
  }

  /**
   * Build a Palette from a record of hex strings (`#RRGGBB` or `#RRGGBBAA`,
   * leading `#` optional). Each value is parsed with `parseRgbaHex`, which
   * throws on malformed input — invalid theme data fails loudly rather than
   * silently truncating.
   */
  static fromHex(
    name: string,
    dark: boolean,
    vars: Record<string, string>,
  ): Palette {
    const map = new Map<string, ColorQuad>();
    for (const [k, v] of Object.entries(vars)) {
      map.set(k, parseRgbaHex(v));
    }
    return new Palette(name, dark, map);
  }
}
