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
 * floor off — at the depth the frame is written at. At a depth that writes
 * colors by index, a pair is written in the theme's own sixteen, the colors
 * the terminal shows: rounded against the stock VGA sixteen instead, a ground
 * lands in a slot the theme paints some other color, and muted text lands in
 * its text's slot on seven bundled themes, so a placeholder looks typed. Muted
 * text there is the slot the theme states for it (`TerminalTheme.mutedSlot`).
 */

import { ColorSpec, contrastRatio, type ColorDepth, type ColorRgba, type TerminalTheme } from "../core/color.js";
import { Memo, WeakMemo } from "../core/memo.js";
import { Oklch } from "../core/oklch.js";
import type { PaletteRole } from "../themes/palette.js";
import { asIs, DRAWN_AT_TRUECOLOR, textFloor, textOn, type TextFit, type TextIntent } from "../themes/text-on.js";

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

/** Where a widget's text is drawn: what a missed floor becomes, and the depth it is written at. */
export interface InkPlace {
  readonly fit: TextFit;
  readonly depth: ColorDepth;
}

/** Each intent written in another color than a second one, where both would round to one. */
const WRITTEN_APART: Partial<Record<TextIntent, TextIntent>> = { "foreground-muted": "foreground" };

/** A widget cell's colors: its text and its ground. */
export type Inked = { readonly color: ColorSpec; readonly bgcolor: ColorSpec };

// Every widget asks for its pairs on every frame, and at an indexed depth a pair
// ranks the depth's whole table; the answer is a function of these five alone.
const INKED = new WeakMemo<WeakMemo<Memo<Inked>, TextFit>, TerminalTheme>();

export function ink(theme: TerminalTheme, text: TextIntent, ground: PaletteRole, place: InkPlace): Inked {
  return INKED.get(theme, () => new WeakMemo()).get(place.fit, () => new Memo()).get(`${text} ${ground} ${place.depth}`, () => inked(theme, text, ground, place));
}

function inked(theme: TerminalTheme, text: TextIntent, ground: PaletteRole, place: InkPlace): Inked {
  const { palette } = theme;
  const rgba = palette.get(ground);
  if (rgba.alpha === 0) {
    throw new RangeError(`palette ${JSON.stringify(palette.name)}: ${JSON.stringify(ground)} is fully transparent, so it cannot be a widget's ground`);
  }
  const slots = ColorSpec.indexed(place.depth, theme);
  // [LAW:one-type-per-behavior] The depth's own discriminator: a depth that
  // writes colors itself draws the palette's; one that writes them by index
  // draws the theme's sixteen.
  return slots.length === 0
    ? { color: ColorSpec.fromRgba(textOn(palette, text, rgba, { fit: place.fit })), bgcolor: ColorSpec.fromRgba(rgba) }
    : slotted(theme, text, rgba, place, [[ColorSpec.default(), theme.foregroundColor], ...slots]);
}

type Slot = readonly [ColorSpec, ColorRgba];

/** ANSI black, white, bright black and bright white: the slots a theme draws in grey. */
const GREY_SLOTS: ReadonlySet<number> = new Set([0, 7, 8, 15]);

/**
 * The pair written by index: the ground as the slot nearest it — the theme's
 * own background is the terminal's default — and the text as the slot nearest
 * the color the theme states for it, by ΔE_OK. Where that slot misses the
 * intent's floor on the ground as the terminal shows both, the fit is handed
 * the slots, nearest first, as the theme's shades: `named` takes the nearest
 * that reads, `asIs` keeps the nearest, and a color a fit makes up is written
 * as the nearest slot that reads. Text written apart from another intent is
 * the theme's stated slot for it instead.
 */
function slotted(theme: TerminalTheme, text: TextIntent, rgba: ColorRgba, { fit, depth }: InkPlace, slots: readonly Slot[]): Inked {
  const bgcolor = ColorSpec.matchOn(rgba.compositeOver(theme.palette.get("background")), depth, theme, false);
  const shownGround = bgcolor.getTruecolor(theme, false);
  const reads = ([, shown]: Slot, floor: number): boolean => contrastRatio(shown, shownGround) >= floor;
  const write = (intent: TextIntent, pool: readonly Slot[]): Slot => {
    const stated = textOn(theme.palette, intent, rgba, { fit: asIs });
    // Nearness is ΔE_OK, so the slot a color is written as is the one that looks most like it.
    const near = (color: ColorRgba): Slot[] => {
      const seen = Oklch.fromRgba(color);
      return [...pool].sort((a, b) => seen.deltaE(Oklch.fromRgba(a[1])) - seen.deltaE(Oklch.fromRgba(b[1])));
    };
    const order = near(stated);
    const floor = textFloor(intent);
    const nearest = order[0]!;
    if (reads(nearest, floor)) return nearest;
    const picked = fit({ candidate: nearest[1], ground: shownGround, floor, drawnAt: DRAWN_AT_TRUECOLOR, tint: stated, shades: order.map(([, shown]) => shown) });
    if (picked === nearest[1]) return nearest;
    const reading = near(picked).filter((slot) => reads(slot, floor));
    return reading[0] ?? near(picked)[0]!;
  };
  const other = WRITTEN_APART[text];
  if (other === undefined) return { color: write(text, slots)[0], bgcolor };
  // [LAW:one-source-of-truth] The slot the theme states for muted text, as it
  // states it; derived only for a theme that states none: the grey slots — the
  // default, black, white and their bright forms — other than any drawn as the
  // text it is written apart from, so it goes grey and never to a hue.
  const stated = slots.find(([spec]) => spec.number !== undefined && spec.number === theme.mutedSlot);
  if (stated !== undefined) return { color: stated[0], bgcolor };
  const body = write(other, slots)[1].hex;
  const greys = slots.filter(([spec, shown]) => (spec.number === undefined || GREY_SLOTS.has(spec.number)) && shown.hex !== body);
  return { color: write(text, greys)[0], bgcolor };
}
