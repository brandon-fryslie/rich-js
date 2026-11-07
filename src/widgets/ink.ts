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
import { asIs, DRAWN_AT_TRUECOLOR, recedesFrom, textFloor, textOn, type TextFit, type TextIntent } from "../themes/text-on.js";

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

/** A widget cell's colors: its text and its ground. */
export type Inked = { readonly color: ColorSpec; readonly bgcolor: ColorSpec };

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

/** ANSI black, white, bright black and bright white: the slots a terminal draws in grey. */
const GREY_SLOTS: ReadonlySet<number> = new Set([0, 7, 8, 15]);

/** `pool` nearest `color` first, by ΔE_OK: the slot a color is written as is the one that looks most like it. */
function byNearness(pool: readonly Slot[], color: ColorRgba): Slot[] {
  const seen = Oklch.fromRgba(color);
  return pool.map((s) => ({ s, d: seen.deltaE(s.lab) })).sort((a, b) => a.d - b.d).map(({ s }) => s);
}

/**
 * The pair written by index. The ground is the indexed color nearest it, never
 * the terminal's default: a light theme in a dark terminal still paints its
 * own ground. The text is held to its floor on the ground as the terminal
 * shows both: its candidate is the slot nearest the color the theme states for
 * it, and one that misses goes to the fit with every slot, nearest first, as
 * the theme's shades — `named` takes the nearest that reads, `asIs` keeps the
 * candidate, and a color a fit makes up is written as the nearest slot that
 * reads. Text that recedes from another intent is never written in the color
 * that one is drawn in, and at sixteen colors its candidate is the slot the
 * terminal states for muted text, or else the nearest grey.
 */
function slotted(theme: TerminalTheme, text: TextIntent, rgba: ColorRgba, fit: TextFit, depth: ColorDepth, terminal: TerminalColors, table: readonly Slot[]): Inked {
  const ground = byNearness(table, rgba.compositeOver(theme.palette.get("background")))[0]!;
  const reads = (floor: number) => (s: Slot): boolean => contrastRatio(s.shown, ground.shown) >= floor;
  const write = (intent: TextIntent, pool: readonly Slot[], candidate: Slot): Slot => {
    const floor = textFloor(intent);
    if (reads(floor)(candidate)) return candidate;
    const stated = textOn(theme.palette, intent, rgba, { fit: asIs });
    const shades = [candidate, ...byNearness(pool, stated).filter((s) => s !== candidate)];
    const picked = fit({ candidate: candidate.shown, ground: ground.shown, floor, drawnAt: DRAWN_AT_TRUECOLOR, tint: stated, shades: shades.map((s) => s.shown) });
    if (picked === candidate.shown) return candidate;
    const toPicked = byNearness(pool, picked);
    return toPicked.find(reads(floor)) ?? toPicked[0]!;
  };
  const nearest = (intent: TextIntent, pool: readonly Slot[]): Slot => byNearness(pool, textOn(theme.palette, intent, rgba, { fit: asIs }))[0]!;
  const all = [slot(ColorSpec.default(), terminal.foregroundColor), ...table];
  const body = recedesFrom(text);
  if (body === undefined) return { color: write(text, all, nearest(text, all)).spec, bgcolor: ground.spec };
  // Never empty: a TerminalColors whose sixteen are all its foreground is refused when built.
  const drawnBody = write(body, all, nearest(body, all)).shown.hex;
  const apart = all.filter((s) => s.shown.hex !== drawnBody);
  const sixteen = depth === ColorDepth.STANDARD || depth === ColorDepth.WINDOWS;
  const grey = (s: Slot): boolean => s.spec.number === undefined || GREY_SLOTS.has(s.spec.number);
  const candidate = !sixteen
    ? nearest(text, apart)
    : apart.find((s) => s.spec.number !== undefined && s.spec.number === terminal.mutedSlot)
      ?? nearest(text, apart.some(grey) ? apart.filter(grey) : apart);
  return { color: write(text, apart, candidate).spec, bgcolor: ground.spec };
}
