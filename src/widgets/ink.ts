/**
 * ink — the color pair a widget cell is drawn in: a ground from one theme's
 * palette, and the text that theme draws on it.
 *
 * A palette's colors are chosen against that palette's own background. A
 * foreground drawn over whatever the terminal shows is readable only when the
 * terminal happens to match the theme — the default theme's white text
 * vanished into a light terminal. With both halves taken from the theme, a
 * widget looks the same on every terminal, so it is readable on all of them
 * exactly when its theme is readable against itself.
 *
 * [LAW:types-are-the-program] The foreground is a text intent and the ground a
 * palette role, so a widget cannot draw half a pair, nor draw its text in a
 * bare accent: a full `primary` button's label is `text` on `primary`, the
 * rule Textual draws it by.
 * [LAW:single-enforcer] Every widget resolves its colors here, and this is
 * where a ground that draws no color (a theme's fully transparent "no
 * background") is reported.
 */

import { ColorSpec, type TerminalTheme } from "../core/color.js";
import type { PaletteRole } from "../themes/palette.js";
import { textOn, type TextIntent } from "../themes/text-on.js";

/** A text intent and the ground it is drawn on: the two halves `ink` takes. */
export type InkPair = readonly [text: TextIntent, ground: PaletteRole];

/** The variants a Button and a Toggle are drawn in. */
export type InkVariant = "default" | "primary" | "success" | "warning" | "danger";

/**
 * Each variant's two states in Textual's pairings. `quiet` is a flat control:
 * the accent's text on its muted form. `lit` is the full accent with `text` on
 * it; `text-*` is mostly accent and would vanish on a full accent ground, which
 * is why `lit` does not reuse it. [LAW:one-source-of-truth] A Button at rest
 * and a Toggle switched off are one look, and so are a hovered Button and a
 * Toggle switched on.
 */
export const VARIANT_INK: Readonly<Record<InkVariant, { readonly quiet: InkPair; readonly lit: InkPair }>> = {
  default: { quiet: ["foreground", "surface"], lit: ["text", "primary"] },
  primary: { quiet: ["text-primary", "primary-muted"], lit: ["text", "primary"] },
  success: { quiet: ["text-success", "success-muted"], lit: ["text", "success"] },
  warning: { quiet: ["text-warning", "warning-muted"], lit: ["text", "warning"] },
  danger: { quiet: ["text-error", "error-muted"], lit: ["text", "error"] },
};

export function ink(
  theme: TerminalTheme,
  text: TextIntent,
  ground: PaletteRole,
): { color: ColorSpec; bgcolor: ColorSpec } {
  const { palette } = theme;
  const rgba = palette.get(ground);
  if (rgba.alpha === 0) {
    throw new RangeError(`palette ${JSON.stringify(palette.name)}: ${JSON.stringify(ground)} is fully transparent, so it cannot be a widget's ground`);
  }
  return { color: ColorSpec.fromRgba(textOn(palette, text, rgba)), bgcolor: ColorSpec.fromRgba(rgba) };
}
