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
 *
 * Text is held to its floor through the widget's `TextFit` — `asIs` turns the
 * floor off — at the depth and on the terminal the frame is written for, by
 * `writeText`, the one engine every caller of `textOn` shares.
 */

import type { ColorDepth, TerminalColors, TerminalTheme } from "../core/color.js";
import type { PaletteRole } from "../themes/palette.js";
import { writeText, type TextFit, type TextIntent, type WrittenText } from "../themes/text-on.js";

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

/**
 * Where a widget's text is drawn: what a missed floor becomes, the depth it is
 * written at, and the terminal that shows it — the one the depth assumes where
 * none is named.
 */
export interface InkPlace {
  readonly fit: TextFit;
  readonly depth: ColorDepth;
  readonly terminal?: TerminalColors;
}

/** A widget cell's colors: `writeText`'s pair. */
export type Inked = WrittenText;

export function ink(theme: TerminalTheme, text: TextIntent, ground: PaletteRole, { fit, depth, terminal }: InkPlace): Inked {
  const rgba = theme.palette.get(ground);
  if (rgba.alpha === 0) {
    throw new RangeError(`palette ${JSON.stringify(theme.palette.name)}: ${JSON.stringify(ground)} is fully transparent, so it cannot be a widget's ground`);
  }
  return writeText(theme.palette, text, rgba, { fit, drawnAt: { depth, terminal } });
}
