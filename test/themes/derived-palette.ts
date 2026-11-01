import type { BaseColors } from "../../src/themes/buildPalette.js";
import { BASE_KEYS, buildPalette } from "../../src/themes/buildPalette.js";
import type { Palette } from "../../src/themes/palette.js";

/** What `buildPalette`'s rules make of a palette's eight base colours, every other role derived. */
export function derivedFrom(palette: Palette): Palette {
  return buildPalette(palette.name, palette.dark, Object.fromEntries(BASE_KEYS.map((role) => [role, palette.get(role)])) as unknown as BaseColors);
}
