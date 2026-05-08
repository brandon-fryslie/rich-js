import { ColorRgba, blendRgb } from "../core/color.js";
import { alphaBlend, contrastFor } from "./colorMath.js";
import { Palette } from "./palette.js";

/**
 * Base colors required to build a full semantic palette.
 * All are ColorRgba — callers construct from whatever source (hex, HSL, etc.).
 */
export interface BaseColors {
  primary: ColorRgba;
  secondary: ColorRgba;
  accent: ColorRgba;
  success: ColorRgba;
  warning: ColorRgba;
  error: ColorRgba;
  background: ColorRgba;
  foreground: ColorRgba;
}

const MUTED_BLEND = 0.7;
const TEXT_ALPHA = 0.66;
const SURFACE_LIFT = 0.05;

type AccentKey = "primary" | "secondary" | "accent" | "success" | "warning" | "error";

const ACCENT_KEYS: AccentKey[] = ["primary", "secondary", "accent", "success", "warning", "error"];

/**
 * Build a full semantic palette from base colors.
 *
 * Derived entries follow Textual's formulas:
 * - `*-muted` = color blended 70% toward background
 * - `text-*` = contrast text tinted 66% with the accent color
 * - `surface` = background blended 5% toward foreground
 */
export function buildPalette(name: string, dark: boolean, base: BaseColors): Palette {
  const vars = new Map<string, ColorRgba>();

  // Base entries
  vars.set("background", base.background);
  vars.set("foreground", base.foreground);
  for (const key of ACCENT_KEYS) {
    vars.set(key, base[key]);
  }

  // Surface — subtle lift from background
  vars.set("surface", blendRgb(base.background, base.foreground, SURFACE_LIFT));

  // Derived: muted and text- for each accent
  const contrastText = contrastFor(base.background);
  for (const key of ACCENT_KEYS) {
    const color = base[key];
    vars.set(`${key}-muted`, blendRgb(color, base.background, MUTED_BLEND));
    vars.set(`text-${key}`, alphaBlend(color, contrastText, TEXT_ALPHA));
  }

  return new Palette(name, dark, vars);
}
