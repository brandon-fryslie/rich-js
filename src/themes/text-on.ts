/**
 * Text on a ground: the color a theme's text draws in on the background it
 * actually sits on.
 *
 * Textual's `$text`, `$text-muted` and `$text-disabled` are not colors but
 * rules: a slightly translucent black or white, whichever contrasts with the
 * background the text is on. Baked once against a palette's `background`, they
 * are wrong on every other ground a consumer paints — a ladder rung, a muted
 * accent, a full accent fill — and every consumer that paints one rebuilds the
 * rule by hand. So the rule lives here, as a function of the ground, and the
 * palette holds no frozen copy of it. The theme's fixed text colors
 * (`foreground`, `foreground-muted`, `text-<accent>`) are palette colors, held
 * by `buildPalette` to read on the grounds Textual promises them; here they
 * are drawn on any ground.
 *
 * Each intent is a candidate and a floor. The candidate is measured on the
 * ground as the terminal draws the pair; one that clears the floor is drawn as
 * it is, and one that does not is handed to a `TextFit`, which decides what the
 * text becomes instead. [LAW:single-enforcer] The floor is decided here, once;
 * a fit only answers what to draw when it is missed.
 * [LAW:one-type-per-behavior] A fit is a value — `slide`, `named`, `tinted` and
 * `asIs` ship, and a caller's own function is one more with no change here.
 */

import { ColorDepth, ColorRgba, ColorSpec, resolveTerminal, roundingDistance, type TerminalColors } from "../core/color.js";
import { Memo, WeakMemo } from "../core/memo.js";
import { alphaBlend, compositedColor, contrastFor, contrastRatio, ensureContrast } from "./colorMath.js";
import type { AccentRole, Palette, PaletteRole } from "./palette.js";

/**
 * Where text will be drawn: the depth the output is encoded at, and the
 * terminal that draws it when that is known. At sixteen colors a terminal
 * paints each slot in its own theme's color, so a floor is measured in
 * `terminal`'s sixteen; without one, in the VGA defaults. Both are facts about
 * the one place the text lands, so they arrive together.
 */
export interface DrawnAt {
  readonly depth: ColorDepth;
  readonly terminal?: TerminalColors;
}

export const DRAWN_AT_TRUECOLOR: DrawnAt = { depth: ColorDepth.TRUECOLOR };

/** Textual's ground-relative weights. */
export type NeutralIntent = "text" | "text-muted" | "text-disabled";

/**
 * What a fit is handed: the candidate that missed its floor, the ground, and
 * what the intent offers to replace it. Every color is opaque and on the
 * ground: the candidate and shades composited onto it, the ground onto the
 * palette's background.
 */
export interface TextRequest {
  readonly candidate: ColorRgba;
  readonly ground: ColorRgba;
  readonly floor: number;
  readonly drawnAt: DrawnAt;
  /** The color the intent is tinted toward: the accent for `text-<accent>`, the text color itself otherwise. */
  readonly tint: ColorRgba;
  /** The colors the theme names for this intent: its own color first, then its shades, nearest first. */
  readonly shades: readonly ColorRgba[];
}

/** What text missing its floor becomes. */
export type TextFit = (request: TextRequest) => ColorRgba;

/** Whether `fg` clears `floor` on an opaque `ground` as the terminal draws the pair. */
export function readsOn(fg: ColorRgba, ground: ColorRgba, floor: number, drawnAt: DrawnAt = DRAWN_AT_TRUECOLOR): boolean {
  return drawnContrast(fg, ground, drawnAt) >= floor;
}

function drawnContrast(fg: ColorRgba, ground: ColorRgba, { depth, terminal }: DrawnAt): number {
  const shown = (color: ColorRgba) => compositedColor(color.compositeOver(ground), depth, undefined, terminal);
  return contrastRatio(shown(fg), shown(ground));
}

/** The candidate standing furthest off the ground as drawn. */
function furthest(candidates: readonly ColorRgba[], ground: ColorRgba, drawnAt: DrawnAt): ColorRgba {
  // A fit that hands `named` a request of its own may have filtered every
  // shade away; there is then no color the theme chose. [LAW:no-silent-failure]
  if (candidates.length === 0) throw new RangeError("named: the request names no shades, so there is no color of the theme's to choose");
  const scored = candidates.map((color) => ({ color, contrast: drawnContrast(color, ground, drawnAt) }));
  return scored.reduce((best, c) => (c.contrast > best.contrast ? c : best)).color;
}

/**
 * The candidate's lightness moved until it clears the floor, hue kept: the text
 * stays recognizably its color and gets as light or dark as it must.
 */
export const slide: TextFit = ({ candidate, ground, floor, drawnAt }) =>
  ensureContrast(candidate, ground, floor, drawnAt.depth, undefined, drawnAt.terminal);

/**
 * The first color the theme names for the intent that clears the floor, or the
 * one standing furthest off the ground where none does: never a color the
 * theme did not choose, so an error stays the theme's own red, at the cost of
 * the floor on a ground none of its reds read on.
 */
export const named: TextFit = ({ shades, ground, floor, drawnAt }) =>
  shades.find((shade) => readsOn(shade, ground, floor, drawnAt)) ?? furthest(shades, ground, drawnAt);

// Textual's `text-<accent>`: the contrast text tinted 66% with the accent.
const TEXTUAL_TINT = 0.66;
const TINT_STEPS = 24;

/**
 * Textual's own recipe for `text-<accent>`, run on this ground: the ground's
 * contrast pole tinted with the intent's color, at the largest share up to
 * Textual's 66% that clears the floor. The text keeps as much of its hue as the
 * ground allows and goes no further from the pole than Textual's own text
 * does; at no share it is the pole, the most legible text there is. Shares are
 * tried whole steps apart rather than bisected, because below truecolor the
 * drawn contrast need not fall monotonically as the tint grows.
 */
export const tinted: TextFit = ({ tint, ground, floor, drawnAt }) => {
  const pole = contrastFor(ground);
  const shares = Array.from({ length: TINT_STEPS + 1 }, (_, i) => TEXTUAL_TINT * (1 - i / TINT_STEPS));
  return shares.map((share) => alphaBlend(tint, pole, share)).find((c) => readsOn(c, ground, floor, drawnAt)) ?? pole;
};

/**
 * The candidate as the theme states it, floor or no floor: contrast checking
 * turned off. [LAW:dataflow-not-control-flow] Off is a fit like the others, so
 * turning it off changes a value, never which code runs.
 */
export const asIs: TextFit = ({ candidate }) => candidate;

/** The fits that ship, by name: what a setting that names a fit is read through. */
export const TEXT_FITS = { slide, named, tinted, asIs } as const satisfies Record<string, TextFit>;


// WCAG's floors: AA for body text, AA-large for de-emphasized text, which is
// meant to recede, and none for disabled text, which WCAG exempts and which
// must look unavailable.
const BODY = 4.5;
const RECEDING = 3;
const EXEMPT = 0;

/** Textual's alpha for each ground-relative weight, and the floor it is held to. */
const RELATIVE: Readonly<Record<NeutralIntent, { readonly alpha: number; readonly floor: number }>> = {
  text: { alpha: 0.87, floor: BODY },
  "text-muted": { alpha: 0.6, floor: RECEDING },
  "text-disabled": { alpha: 0.38, floor: EXEMPT },
};

/** `color` at `alpha`, its channels kept. */
export const withAlpha = (color: ColorRgba, alpha: number): ColorRgba => new ColorRgba(color.red, color.green, color.blue, alpha);

/** Disabled text in a theme's `foreground`: Textual's tint, before any ground. */
export const disabledInk = (foreground: ColorRgba): ColorRgba => withAlpha(foreground, RELATIVE["text-disabled"].alpha);

/** Textual's ground-relative weights, by name. */
export const NEUTRAL_INTENTS = Object.keys(RELATIVE) as readonly NeutralIntent[];

/** The alpha Textual draws a ground-relative weight at. */
export function neutralAlpha(intent: NeutralIntent): number {
  return RELATIVE[intent].alpha;
}

/**
 * Why `name` is no palette color, where it names text drawn relative to its
 * ground — Textual's `text`, `text-muted`, `text-disabled` and every `on-*` —
 * and the empty string otherwise. What every lookup that misses one says, so a
 * theme stating one and a template reading one are pointed at the same place.
 */
export function groundRelativeHint(name: string): string {
  const relative = (NEUTRAL_INTENTS as readonly string[]).includes(name) || name.startsWith("on-");
  return relative ? " — text drawn relative to its ground is `textOn(palette, intent, ground)`, not a palette color" : "";
}

/**
 * A ground-relative weight on an opaque ground with no palette: the contrast
 * pole at Textual's alpha, slid to its floor where the ground is mid-toned.
 * What `buildPalette` derives its component text roles from, so a cursor's
 * text is this same rule on the cursor.
 */
export function neutralText(intent: NeutralIntent, ground: ColorRgba): ColorRgba {
  const { alpha, floor } = RELATIVE[intent];
  return ensureContrast(withAlpha(contrastFor(ground), alpha), ground, floor);
}

/**
 * What an intent is on one ground: the candidate `textOn` measures, and what a
 * fit reads when it misses. The fit's half is a thunk, so a candidate that
 * reads — the common case, on every frame a widget draws — builds no shades.
 */
interface Spec {
  readonly candidate: ColorRgba;
  readonly miss: () => { readonly tint: ColorRgba; readonly shades: readonly ColorRgba[] };
}
/** An intent: the floor it is held to, and what it is on a ground. */
interface IntentRule {
  readonly floor: number;
  readonly on: (palette: Palette, ground: ColorRgba) => Spec;
  /**
   * The intent this one recedes from: where a terminal draws only a table of
   * colors, it is never drawn in the color that one is, so it still reads as
   * less than it.
   */
  readonly recedesFrom?: "foreground" | "text";
  /**
   * The intent this one is held past on every ground: it clears the contrast
   * that intent's candidate draws there by `HELD_PAST_MARGIN`, as well as its
   * own floor.
   */
  readonly heldPast?: "foreground-disabled";
}

const RUNGS = [1, 2, 3] as const;

/**
 * `root` and its ladder, nearest rungs first: each step out tries both
 * directions before the next, so the first shade that reads is the one closest
 * to the theme's color, whichever side it is on. At one step, the direction
 * toward the pole that reads on `ground` is tried first.
 */
function ladder(palette: Palette, root: "foreground" | "background" | AccentRole, ground: ColorRgba): ColorRgba[] {
  const [near, far] = contrastFor(ground).red === 255 ? (["lighten", "darken"] as const) : (["darken", "lighten"] as const);
  return [palette.get(root), ...RUNGS.flatMap((n) => [palette.get(`${root}-${near}-${n}`), palette.get(`${root}-${far}-${n}`)])];
}

/** The neutrals a theme names, its own colors for the weight first. */
const neutralShades = (palette: Palette, ground: ColorRgba, own: readonly PaletteRole[]): ColorRgba[] => [
  ...own.map((role) => palette.get(role)),
  ...ladder(palette, "foreground", ground),
  ...ladder(palette, "background", ground),
];

/**
 * Disabled text in the theme's own foreground: Textual's translucent
 * foreground, composited on this ground. The palette's `foreground-disabled` is
 * that tint already drawn on `background`, so on any other ground it is the
 * wrong color — the very defect this module removes — and under a floor of
 * none nothing would catch it.
 */
const disabled = (own: readonly PaletteRole[]): IntentRule => ({
  floor: RELATIVE["text-disabled"].floor,
  on: (palette, ground) => ({
    candidate: disabledInk(palette.get("foreground")),
    miss: () => ({ tint: palette.get("foreground"), shades: neutralShades(palette, ground, own) }),
  }),
});

/** A palette's fixed text color: drawn as the theme names it. */
const fixed = (role: PaletteRole, floor: number, own: readonly PaletteRole[]): IntentRule => ({
  floor,
  on: (palette, ground) => ({
    candidate: palette.get(role),
    miss: () => ({ tint: palette.get(role), shades: neutralShades(palette, ground, own) }),
  }),
});

/** A ground-relative weight: Textual's translucent pole on this ground. */
const relative = (intent: NeutralIntent, own: readonly PaletteRole[]): IntentRule => ({
  floor: RELATIVE[intent].floor,
  on: (palette, ground) => ({
    candidate: withAlpha(contrastFor(ground), RELATIVE[intent].alpha),
    miss: () => ({ tint: contrastFor(ground), shades: neutralShades(palette, ground, own) }),
  }),
});

/** An accent's text: the palette's `text-<accent>`, tinted toward the accent. */
const accent = (role: AccentRole): IntentRule => ({
  floor: BODY,
  on: (palette, ground) => ({
    candidate: palette.get(`text-${role}`),
    miss: () => ({ tint: palette.get(role), shades: [palette.get(`text-${role}`), ...ladder(palette, role, ground)] }),
  }),
});

/**
 * Every text a theme consumer may draw: Textual's fixed text colors, its
 * ground-relative weights, and each accent's tinted text.
 * [LAW:types-are-the-program] A bare accent is not here, so text in `primary`
 * cannot be asked for: Textual draws an accent as a fill or a border, and its
 * text as `text-primary`.
 */
const INTENTS = {
  foreground: fixed("foreground", BODY, []),
  "foreground-muted": {
    ...fixed("foreground-muted", RECEDING, ["foreground-muted", "background-muted"]),
    recedesFrom: "foreground",
    // Muted is secondary text and disabled is text that cannot be used.
    heldPast: "foreground-disabled",
  },
  "foreground-disabled": disabled(["foreground-disabled"]),
  text: relative("text", []),
  "text-muted": { ...relative("text-muted", ["foreground-muted", "background-muted"]), recedesFrom: "text" },
  "text-disabled": relative("text-disabled", ["foreground-disabled"]),
  "text-primary": accent("primary"),
  "text-secondary": accent("secondary"),
  "text-accent": accent("accent"),
  "text-success": accent("success"),
  "text-warning": accent("warning"),
  "text-error": accent("error"),
} as const satisfies Record<string, IntentRule>;

export type TextIntent = keyof typeof INTENTS;

/**
 * The contrast `intent` is held to on any ground before it is held past another
 * intent: the WCAG floor. What `textOn` holds it to on one ground is `floorOn`.
 */
export function textFloor(intent: TextIntent): number {
  return INTENTS[intent].floor;
}

/** The ink each intent an intent may be held past draws in, in a theme whose foreground is `foreground`. */
const HELD_PAST_INK: Record<NonNullable<IntentRule["heldPast"]>, (foreground: ColorRgba) => ColorRgba> = {
  "foreground-disabled": disabledInk,
};

/** How much more contrast an intent holds on a ground than the one it is held past (`IntentRule.heldPast`) draws there. */
const HELD_PAST_MARGIN = 0.25;

/**
 * The contrast `intent` is held to on one opaque `ground`, in a theme whose
 * foreground is `foreground`: its floor (`textFloor`), raised where it is held
 * past another intent to clear what that one draws there.
 * [LAW:single-enforcer] `textOn` at a depth that writes its own colors, and
 * `buildPalette`, both read the ordering here.
 */
export function floorOn(intent: TextIntent, foreground: ColorRgba, ground: ColorRgba, drawnAt: DrawnAt = DRAWN_AT_TRUECOLOR): number {
  const rule: IntentRule = INTENTS[intent];
  if (rule.heldPast === undefined) return rule.floor;
  return Math.max(rule.floor, drawnContrast(HELD_PAST_INK[rule.heldPast](foreground), ground, drawnAt) + HELD_PAST_MARGIN);
}

/** The intent `intent` recedes from, where it recedes from one (`IntentRule.recedesFrom`). */
export function recedesFrom(intent: TextIntent): TextIntent | undefined {
  return (INTENTS[intent] as IntentRule).recedesFrom;
}

/** Whether `name` is a text intent: what a template's string is parsed through. */
export function isTextIntent(name: string): name is TextIntent {
  return Object.hasOwn(INTENTS, name);
}

/** Every text intent, in the order the docs list them. */
export const TEXT_INTENTS = Object.keys(INTENTS) as readonly TextIntent[];

/** The color a fit tints `intent` toward on `ground`: what `TextRequest.tint` is handed. */
export function textTint(palette: Palette, intent: TextIntent, ground: ColorRgba): ColorRgba {
  return INTENTS[intent].on(palette, ground.compositeOver(palette.get("background"))).miss().tint;
}

/** The text and ground a pair is written as, and `dim` where the table had no color for text that recedes. */
export interface WrittenText {
  readonly color: ColorSpec;
  readonly bgcolor: ColorSpec;
  readonly dim?: true;
}

/**
 * The text `intent` draws in on `ground`, as the terminal shows it: the color
 * `writeText` writes, read in RGBA. A translucent ground is drawn on the
 * palette's background first, as every palette color is. `WrittenText.dim` —
 * muted text a table has no slot for, drawn as its body text dimmed — is an
 * attribute, not a color, so it is `writeText`'s answer only; here such text
 * is its body text's color.
 *
 * @param fit what text missing its floor becomes; `slide` unless stated.
 * @param drawnAt where the pair is drawn; truecolor unless stated.
 */
export function textOn(palette: Palette, intent: TextIntent, ground: ColorRgba, place: TextPlace = {}): ColorRgba {
  const { drawnAt = DRAWN_AT_TRUECOLOR } = place;
  return writeText(palette, intent, ground, place).color.getTruecolor(resolveTerminal(drawnAt.terminal, drawnAt.depth), true);
}

/** What text missing its floor becomes, and where the pair is drawn. */
export interface TextPlace {
  readonly fit?: TextFit;
  readonly drawnAt?: DrawnAt;
}

// Every widget asks for its pairs on every frame, and at an indexed depth a pair
// scans the depth's whole table; the answer is a function of these alone. A
// terminal left unnamed is keyed apart from the one the depth assumes for it,
// since its default foreground is then unknown.
const WRITTEN = new WeakMemo<WeakMemo<WeakMemo<Memo<WrittenText>, TerminalColors>, TextFit>, Palette>();

/**
 * The pair `intent` on `ground` is written as. At a depth that writes colors
 * itself, the text is held to its floor in the palette's colors. At a depth
 * that writes them by index, both are slots of the table `drawnAt`'s terminal
 * shows there — the VGA sixteen the depth assumes where none is named — each
 * the slot `roundingDistance` ranks nearest, the rule every downgrade rounds by:
 *
 * - the ground is the slot that stands for it, never the terminal's default,
 *   so a light theme on a dark terminal still paints its own ground;
 * - text is never written in its ground's color, disabled text included; its
 *   candidate is the slot standing for the color the theme states, one that
 *   misses its floor goes to the fit, and a color the fit makes up is written
 *   as the slot that stands for it among those that read — the most legible
 *   slot where none reads. The default foreground is a candidate only where a
 *   terminal is named, since only then is its color known;
 * - text that recedes from another intent is a slot other than the default and
 *   that intent's, standing off its ground less than that intent does; at
 *   sixteen colors its candidate is the slot the terminal states for muted
 *   text (`TerminalColors.mutedSlot`), and where no slot recedes and reads it
 *   is that intent's color with SGR dim — the table has no room for it.
 */
export function writeText(
  palette: Palette,
  intent: TextIntent,
  ground: ColorRgba,
  { fit = slide, drawnAt = DRAWN_AT_TRUECOLOR }: TextPlace = {},
): WrittenText {
  const terminal = resolveTerminal(drawnAt.terminal, drawnAt.depth);
  const key = `${intent} ${ground.red},${ground.green},${ground.blue},${ground.alpha} ${drawnAt.depth} ${drawnAt.terminal === undefined ? "assumed" : "named"}`;
  return WRITTEN.get(palette, () => new WeakMemo()).get(fit, () => new WeakMemo()).get(terminal, () => new Memo()).get(key, () => {
    const drawnGround = ground.compositeOver(palette.get("background"));
    // At 256 colors the writer rounds into the cube and grey ramp alone, never
    // the terminal-defined sixteen (`downgradeTable`), so a pair does too.
    const table = ColorSpec.indexed(drawnAt.depth, terminal).filter(([spec]) => drawnAt.depth !== ColorDepth.EIGHT_BIT || spec.number! >= 16);
    // [LAW:one-type-per-behavior] The depth's own discriminator: a depth that
    // writes colors itself draws the palette's; one that writes them by index
    // draws the terminal's table.
    return table.length === 0
      ? { color: ColorSpec.fromRgba(heldTo(palette, intent, drawnGround, fit, drawnAt)), bgcolor: ColorSpec.fromRgba(drawnGround) }
      : slotted(palette, intent, drawnGround, fit, drawnAt, terminal, table);
  });
}

/** `intent`'s color on an opaque `ground`, held to its floor through `fit` in the palette's own colors. */
function heldTo(palette: Palette, intent: TextIntent, ground: ColorRgba, fit: TextFit, drawnAt: DrawnAt): ColorRgba {
  const floor = floorOn(intent, palette.get("foreground"), ground, drawnAt);
  const { candidate, miss } = INTENTS[intent].on(palette, ground);
  const drawn = candidate.compositeOver(ground);
  if (readsOn(drawn, ground, floor, drawnAt)) return drawn;
  const { tint, shades } = miss();
  return fit({ candidate: drawn, ground, floor, drawnAt, tint, shades: shades.map((s) => s.compositeOver(ground)) });
}

/** A color a depth writes by index: how it is written, and what the terminal shows. */
type Slot = readonly [ColorSpec, ColorRgba];

/** The slot of `pool` that stands for `color`, by the one rounding rule. */
const nearestOf = (pool: readonly Slot[], color: ColorRgba): Slot | undefined =>
  pool.reduce<Slot | undefined>((best, s) => (best === undefined || roundingDistance(s[1], color) < roundingDistance(best[1], color) ? s : best), undefined);

/** The pair written by index: `writeText`'s rules for a depth with a table. */
function slotted(palette: Palette, text: TextIntent, ground: ColorRgba, fit: TextFit, drawnAt: DrawnAt, terminal: TerminalColors, table: readonly Slot[]): WrittenText {
  const [groundSpec, groundShown] = nearestOf(table, ground)!;
  const contrast = ([, shown]: Slot): number => contrastRatio(shown, groundShown);
  const stated = (intent: TextIntent): ColorRgba => heldTo(palette, intent, ground, asIs, DRAWN_AT_TRUECOLOR);
  const write = (intent: TextIntent, statedColor: ColorRgba, pool: readonly Slot[], candidate: Slot): Slot | undefined => {
    const floor = textFloor(intent);
    if (contrast(candidate) >= floor) return candidate;
    // The theme's shades are the pool, nearest the stated color first, as `named` reads them.
    const shades = [...pool].sort((a, b) => roundingDistance(a[1], statedColor) - roundingDistance(b[1], statedColor)).map(([, shown]) => shown);
    const picked = fit({ candidate: candidate[1], ground: groundShown, floor, drawnAt: DRAWN_AT_TRUECOLOR, tint: textTint(palette, intent, ground), shades });
    return picked === candidate[1] ? candidate : nearestOf(pool.filter((s) => contrast(s) >= floor), picked);
  };
  const named: readonly Slot[] = drawnAt.terminal === undefined ? [] : [[ColorSpec.default(), terminal.foregroundColor]];
  const visible = [...named, ...table].filter(([, shown]) => shown.hex !== groundShown.hex);
  // [LAW:no-silent-failure] A table that shows every slot as the ground's color has no text to offer.
  if (visible.length === 0) throw new RangeError(`writeText: every color this table writes shows as the ground ${groundShown.hex}, so no text can be seen on it`);
  const drawn = (intent: TextIntent): Slot => {
    const statedColor = stated(intent);
    // Where no slot reads, the one standing furthest off the ground: the most legible the table has.
    return write(intent, statedColor, visible, nearestOf(visible, statedColor)!) ?? visible.reduce((a, b) => (contrast(b) > contrast(a) ? b : a));
  };
  const body = recedesFrom(text);
  if (body === undefined) return { color: drawn(text)[0], bgcolor: groundSpec };
  const over = drawn(body);
  const receding = table.filter((s) => s[1].hex !== groundShown.hex && s[1].hex !== over[1].hex && contrast(s) < contrast(over));
  const sixteen = drawnAt.depth === ColorDepth.STANDARD || drawnAt.depth === ColorDepth.WINDOWS;
  const statedText = stated(text);
  const candidate = (sixteen ? receding.find(([spec]) => spec.number === terminal.mutedSlot) : undefined) ?? nearestOf(receding, statedText);
  const chosen = candidate === undefined ? undefined : write(text, statedText, receding, candidate);
  // A table with no slot that both recedes and reads has no room for muted
  // text, and SGR's own answer is the text it recedes from, dimmed.
  return chosen === undefined ? { color: over[0], bgcolor: groundSpec, dim: true } : { color: chosen[0], bgcolor: groundSpec };
}
