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
 * [LAW:one-type-per-behavior] A fit is a value — `slide`, `named` and `tinted`
 * ship, and a caller's own function is a fourth with no change here.
 */

import { ColorDepth, ColorRgba, type TerminalTheme } from "../core/color.js";
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
  readonly terminal?: TerminalTheme;
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

/** The fits that ship, by name: what a setting that names a fit is read through. */
export const TEXT_FITS = { slide, named, tinted } as const satisfies Record<string, TextFit>;


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

const withAlpha = (color: ColorRgba, alpha: number): ColorRgba => new ColorRgba(color.red, color.green, color.blue, alpha);

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
  "foreground-muted": fixed("foreground-muted", RECEDING, ["foreground-muted", "background-muted"]),
  "foreground-disabled": fixed("foreground-disabled", EXEMPT, ["foreground-disabled"]),
  text: relative("text", []),
  "text-muted": relative("text-muted", ["foreground-muted", "background-muted"]),
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
 * The contrast `intent` is held to on any ground. [LAW:one-source-of-truth]
 * `buildPalette` holds a theme's fixed text to these same floors, which is why
 * `textOn` draws that text untouched on the grounds Textual promises it.
 */
export function textFloor(intent: TextIntent): number {
  return INTENTS[intent].floor;
}

/** Whether `name` is a text intent: what a template's string is parsed through. */
export function isTextIntent(name: string): name is TextIntent {
  return Object.hasOwn(INTENTS, name);
}

/** Every text intent, in the order the docs list them. */
export const TEXT_INTENTS = Object.keys(INTENTS) as readonly TextIntent[];

/**
 * The text `intent` draws in on `ground`. A translucent ground is drawn on the
 * palette's background first, as every palette color is.
 *
 * @param fit what text missing its floor becomes; `slide` unless stated.
 * @param drawnAt where the pair is drawn; truecolor unless stated.
 */
export function textOn(
  palette: Palette,
  intent: TextIntent,
  ground: ColorRgba,
  { fit = slide, drawnAt = DRAWN_AT_TRUECOLOR }: { readonly fit?: TextFit; readonly drawnAt?: DrawnAt } = {},
): ColorRgba {
  const drawnGround = ground.compositeOver(palette.get("background"));
  const { floor, on } = INTENTS[intent];
  const { candidate, miss } = on(palette, drawnGround);
  const drawn = candidate.compositeOver(drawnGround);
  if (readsOn(drawn, drawnGround, floor, drawnAt)) return drawn;
  const { tint, shades } = miss();
  return fit({ candidate: drawn, ground: drawnGround, floor, drawnAt, tint, shades: shades.map((s) => s.compositeOver(drawnGround)) });
}
