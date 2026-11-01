import type { BaseColors } from "../../src/themes/buildPalette.js";
import { buildPalette } from "../../src/themes/buildPalette.js";
import type { BaseRole, Palette } from "../../src/themes/palette.js";

export const BASE_ROLES = ["primary", "secondary", "accent", "success", "warning", "error", "background", "foreground"] as const satisfies readonly BaseRole[];

/** What `buildPalette`'s rules make of a palette's eight base colours, every other role derived. */
export function derivedFrom(palette: Palette): Palette {
  return buildPalette(palette.name, palette.dark, Object.fromEntries(BASE_ROLES.map((role) => [role, palette.get(role)])) as unknown as BaseColors);
}
