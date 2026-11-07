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
 * colors by index, a pair is chosen among the colors the frame's terminal
 * shows at those indices: rounded against the stock VGA sixteen instead, a
 * ground lands in a slot the terminal paints some other color, and muted text
 * lands in its text's slot on seven bundled themes, so a placeholder looks
 * typed. At sixteen colors muted text starts from the slot the terminal states
 * for it (`TerminalColors.mutedSlot`).
 */

import { ColorDepth, ColorSpec, contrastRatio, resolveTerminal, type ColorRgba, type TerminalColors, type TerminalTheme } from "../core/color.js";
import { Memo, WeakMemo } from "../core/memo.js";
import { Oklch } from "../core/oklch.js";
import type { PaletteRole } from "../themes/palette.js";
import { asIs, DRAWN_AT_TRUECOLOR, recedesFrom, textFloor, textOn, textTint, type TextFit, type TextIntent } from "../themes/text-on.js";

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
 * none is named (`resolveTerminal`).
 */
export interface InkPlace {
  readonly fit: TextFit;
  readonly depth: ColorDepth;
  readonly terminal?: TerminalColors;
}

/** A widget cell's colors: its text and its ground, and `dim` where the table had no color for text that recedes. */
export type Inked = { readonly color: ColorSpec; readonly bgcolor: ColorSpec; readonly dim?: true };

// Every widget asks for its pairs on every frame, and at an indexed depth a pair
// ranks the depth's whole table; the answer is a function of these alone.
const INKED = new WeakMemo<WeakMemo<WeakMemo<Memo<Inked>, TerminalColors>, TextFit>, TerminalTheme>();

export function ink(theme: TerminalTheme, text: TextIntent, ground: PaletteRole, { fit, depth, terminal }: InkPlace): Inked {
  const shownBy = resolveTerminal(terminal, depth);
  return INKED.get(theme, () => new WeakMemo())
    .get(fit, () => new WeakMemo())
    .get(shownBy, () => new Memo())
    .get(`${text} ${ground} ${depth}`, () => inked(theme, text, ground, fit, depth, shownBy));
}

function inked(theme: TerminalTheme, text: TextIntent, ground: PaletteRole, fit: TextFit, depth: ColorDepth, terminal: TerminalColors): Inked {
  const { palette } = theme;
  const rgba = palette.get(ground);
  if (rgba.alpha === 0) {
    throw new RangeError(`palette ${JSON.stringify(palette.name)}: ${JSON.stringify(ground)} is fully transparent, so it cannot be a widget's ground`);
  }
  const table = slotsOf(terminal, depth);
  // [LAW:one-type-per-behavior] The depth's own discriminator: a depth that
  // writes colors itself draws the palette's; one that writes them by index
  // draws the terminal's table.
  return table.length === 0
    ? { color: ColorSpec.fromRgba(textOn(palette, text, rgba, { fit })), bgcolor: ColorSpec.fromRgba(rgba) }
    : slotted(theme, text, rgba, fit, depth, terminal, table);
}

/** A color a depth writes by index: how it is written, what the terminal shows, and that in OKLab. */
interface Slot {
  readonly spec: ColorSpec;
  readonly shown: ColorRgba;
  readonly lab: Oklch;
}

const slot = (spec: ColorSpec, shown: ColorRgba): Slot => ({ spec, shown, lab: Oklch.fromRgba(shown) });

// [LAW:one-source-of-truth] `ColorSpec.indexed`'s table, each color's OKLab
// taken once per terminal and depth rather than on every comparison.
const SLOTS = new WeakMemo<Memo<readonly Slot[]>, TerminalColors>();
const slotsOf = (terminal: TerminalColors, depth: ColorDepth): readonly Slot[] =>
  SLOTS.get(terminal, () => new Memo()).get(`${depth}`, () => ColorSpec.indexed(depth, terminal).map(([spec, shown]) => slot(spec, shown)));

// How much chroma a slot may add past the color it stands for, and what each
// unit beyond that costs against ΔE_OK: a grey stays grey, a hue keeps its hue.
const HUE_SLACK = 0.04;
const HUE_COST = 10;

/**
 * The slot of `pool` that stands for `color`: nearest by ΔE_OK, a slot that
 * adds a hue `color` lacks counted that much further off, so a dark grey
 * ground is never written as the table's maroon or navy.
 */
function nearest(pool: readonly Slot[], color: ColorRgba): Slot | undefined {
  const seen = Oklch.fromRgba(color);
  let best: Slot | undefined;
  let bestCost = Infinity;
  for (const s of pool) {
    const cost = seen.deltaE(s.lab) + HUE_COST * Math.max(0, s.lab.c - seen.c - HUE_SLACK);
    if (cost < bestCost) [best, bestCost] = [s, cost];
  }
  return best;
}

/**
 * The pair written by index. The ground is the indexed color that stands for
 * it, never the terminal's default — with a terminal named or not — so a light
 * theme on a dark terminal still paints its own ground; where none is named,
 * the VGA sixteen the depth assumes are what it stands among. Text is never
 * written in its ground's color, disabled text with no floor included. Its
 * candidate is the slot standing for the color the theme states; one that
 * misses its floor goes to the fit, tinted as the intent tints, and a color
 * the fit makes up is written as the slot that stands for it among those that
 * read. Text that recedes from another intent is written in a slot other than
 * the terminal's default and that intent's, standing off its ground less than
 * that intent does; at sixteen colors its candidate is the slot the terminal
 * states for muted text.
 */
function slotted(theme: TerminalTheme, text: TextIntent, rgba: ColorRgba, fit: TextFit, depth: ColorDepth, terminal: TerminalColors, table: readonly Slot[]): Inked {
  const { palette } = theme;
  const ground = nearest(table, rgba.compositeOver(palette.get("background")))!;
  const contrast = (s: Slot): number => contrastRatio(s.shown, ground.shown);
  const stated = (intent: TextIntent): ColorRgba => textOn(palette, intent, rgba, { fit: asIs });
  const write = (intent: TextIntent, pool: readonly Slot[], candidate: Slot): Slot | undefined => {
    const floor = textFloor(intent);
    if (contrast(candidate) >= floor) return candidate;
    // The theme's shades are the pool, nearest the stated color first, as `named` reads them.
    const seen = Oklch.fromRgba(stated(intent));
    const shades = [...pool].sort((a, b) => seen.deltaE(a.lab) - seen.deltaE(b.lab)).map((s) => s.shown);
    const picked = fit({ candidate: candidate.shown, ground: ground.shown, floor, drawnAt: DRAWN_AT_TRUECOLOR, tint: textTint(palette, intent, rgba), shades });
    return picked === candidate.shown ? candidate : nearest(pool.filter((s) => contrast(s) >= floor), picked);
  };
  const visible = [slot(ColorSpec.default(), terminal.foregroundColor), ...table].filter((s) => s.shown.hex !== ground.shown.hex);
  const drawn = (intent: TextIntent): Slot => {
    // Where no slot reads, the one standing furthest off the ground: the most legible the table has.
    return write(intent, visible, nearest(visible, stated(intent))!) ?? visible.reduce((a, b) => (contrast(b) > contrast(a) ? b : a));
  };
  const body = recedesFrom(text);
  if (body === undefined) return { color: drawn(text).spec, bgcolor: ground.spec };
  const over = drawn(body);
  const receding = table.filter((s) => s.shown.hex !== ground.shown.hex && s.shown.hex !== over.shown.hex && contrast(s) < contrast(over));
  const sixteen = depth === ColorDepth.STANDARD || depth === ColorDepth.WINDOWS;
  const candidate = (sixteen ? receding.find((s) => s.spec.number === terminal.mutedSlot) : undefined) ?? nearest(receding, stated(text));
  const chosen = candidate === undefined ? undefined : write(text, receding, candidate);
  // A table with no slot that both recedes and reads has no room for muted
  // text, and SGR's own answer is the text it recedes from, dimmed.
  return chosen === undefined ? { color: over.spec, bgcolor: ground.spec, dim: true } : { color: chosen.spec, bgcolor: ground.spec };
}
