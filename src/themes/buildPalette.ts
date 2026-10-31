import { ColorRgba, blendRgb } from "../core/color.js";
import { alphaBlend, contrastFor, ensureContrastToward, shiftLightness } from "./colorMath.js";
import { Palette, drawnOn, type AccentRole, type BaseRole, type PaletteRole, type PaletteRoles, type Shade, type ShadedRole } from "./palette.js";

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
const LADDER_STEP = 0.075;
const SURFACE_ACTIVE_LIFT = 0.06;
const BORDER_BLUR_DROP = 0.025;
const PANEL_TINT = 0.1;
const BACKGROUND_TINT = 0.15;
const BACKGROUND_TINT_LIFT = 0.15;
const BOOST_ALPHA = 0.04;
const TEXT_FULL_ALPHA = 0.87;
const TEXT_MUTED_ALPHA = 0.6;
const DISABLED_ALPHA = 0.38;
const BLURRED_CURSOR_ALPHA = 0.3;
const HOVER_ALPHA = 0.1;
const SELECTION_ALPHA = 0.4;
const SCROLLBAR_ALPHA = 0.4;
const SCROLLBAR_HOVER_ALPHA = 0.5;
// WCAG AA for body text: `text-*` is the label drawn on `*-muted`.
const TEXT_ON_MUTED = 4.5;

const ACCENT_KEYS: readonly AccentRole[] = ["primary", "secondary", "accent", "success", "warning", "error"];

/** The eight roles every palette is given, and every role it may also state. */
export type StatedRoles = BaseColors & Partial<PaletteRoles>;

/** A role's colour in the palette being built, derived if it was not stated. */
type At = (role: PaletteRole) => ColorRgba;
type Rule = (at: At, dark: boolean) => ColorRgba;

const TRANSPARENT = new ColorRgba(0, 0, 0, 0);
const WHITE = new ColorRgba(255, 255, 255);

const withAlpha = (colour: ColorRgba, alpha: number): ColorRgba =>
  new ColorRgba(colour.red, colour.green, colour.blue, alpha);

const textOn = (alpha: number): Rule => (at) => withAlpha(contrastFor(at("background")), alpha);

// [LAW:one-type-per-behavior] The roles naming another role's colour outright.
const same = (role: PaletteRole): Rule => (at) => at(role);
const none: Rule = () => TRANSPARENT;

/** The six rungs around `root`, each `-darken-3`…`-lighten-3` one `LADDER_STEP` apart. */
function ladder<R extends ShadedRole>(root: R, rung: (step: number) => Rule): Record<`${R}${Shade}`, Rule> {
  const rungs = (["darken", "lighten"] as const).flatMap((direction) =>
    ([1, 2, 3] as const).map((n) => {
      return [`${root}-${direction}-${n}`, rung((direction === "darken" ? -n : n) * LADDER_STEP)];
    }),
  );
  return Object.fromEntries(rungs) as Record<`${R}${Shade}`, Rule>;
}

const lightness = <R extends ShadedRole>(root: R): Record<`${R}${Shade}`, Rule> =>
  ladder(root, (step) => (at) => shiftLightness(at(root), step));

/**
 * `primary-background` at `step` from its root: on a dark palette a tint of the
 * background lifted toward white and floored at the tint, so the bottom rungs
 * meet rather than fall below it; on a light one the accent's own ladder. Every
 * rung reads the accent, as Textual's do, so a stated root does not move them.
 */
const accentBackground = (accent: "primary" | "secondary", step: number): Rule => (at, dark) =>
  dark
    ? blendRgb(blendRgb(at("background"), at(accent), BACKGROUND_TINT), WHITE, Math.max(0, BACKGROUND_TINT_LIFT + step))
    : shiftLightness(at(accent), step);

function accentRules<A extends AccentRole>(accent: A) {
  return {
    ...lightness(accent),
    [`${accent}-muted`]: ((at) => blendRgb(at(accent), at("background"), MUTED_BLEND)) as Rule,
    [`on-${accent}`]: ((at) => contrastFor(at(accent))) as Rule,
    [`text-${accent}`]: ((at) => alphaBlend(at(accent), contrastFor(at("background")), TEXT_ALPHA)) as Rule,
  } as Record<`${A}${Shade}` | `${A}-muted` | `on-${A}` | `text-${A}`, Rule>;
}

/**
 * How each role not given to `buildPalette` is derived, following Textual's
 * `ColorSystem`, which generated the bundled themes:
 *
 * - `*-muted`  = the colour blended 70% toward its opposite base role — every
 *               accent AND the two base roles themselves, so a caller
 *               de-emphasizing body text reaches for `foreground-muted` the
 *               way it reaches for `primary-muted` to de-emphasize an accent.
 *               `foreground-muted` is opaque here where Textual's is translucent,
 *               drawing structural text at reduced weight without a
 *               terminal-support-dependent SGR attribute.
 * - `text-*`   = contrast text tinted 66% with the accent, the foreground for
 *               a `*-muted` ground; `buildPalette` then holds it to that ground
 * - `on-*`     = WCAG-correct contrast colour (black or white) for use as
 *               foreground when the FULL accent is the background. Picked by
 *               relative luminance — single source of truth so widgets never
 *               need to invert fg/bg to get readable text. `contrastFor` is
 *               the only place that decides black-vs-white.
 * - `surface`  = background blended 5% toward foreground, a subtle lift
 * - `*-darken-N` / `*-lighten-N` = the root moved 7.5% of CIE L* per rung
 * - the component roles (`footer-*`, `markdown-*`, …) name the base role
 *   Textual draws that component in
 *
 * [LAW:types-are-the-program] Total over every role but the eight given, so a
 * palette cannot lack one and a role cannot exist without a way to derive it.
 */
const RULES: { readonly [R in Exclude<PaletteRole, BaseRole>]: Rule } = {
  ...accentRules("primary"),
  ...accentRules("secondary"),
  ...accentRules("accent"),
  ...accentRules("success"),
  ...accentRules("warning"),
  ...accentRules("error"),
  ...lightness("background"),
  ...lightness("foreground"),
  ...lightness("panel"),
  ...lightness("boost"),
  ...lightness("surface"),
  ...ladder("primary-background", (step) => accentBackground("primary", step)),
  ...ladder("secondary-background", (step) => accentBackground("secondary", step)),

  "background-muted": (at) => blendRgb(at("background"), at("foreground"), MUTED_BLEND),
  "foreground-muted": (at) => blendRgb(at("foreground"), at("background"), MUTED_BLEND),
  "foreground-disabled": (at) => withAlpha(at("foreground"), DISABLED_ALPHA),

  surface: (at) => blendRgb(at("background"), at("foreground"), SURFACE_LIFT),
  "surface-active": (at) => shiftLightness(at("surface"), SURFACE_ACTIVE_LIFT),
  boost: textOn(BOOST_ALPHA),
  panel: (at, dark) => {
    const tinted = blendRgb(at("surface"), at("primary"), PANEL_TINT);
    return dark ? at("boost").compositeOver(tinted) : tinted;
  },
  "primary-background": accentBackground("primary", 0),
  "secondary-background": accentBackground("secondary", 0),

  text: textOn(TEXT_FULL_ALPHA),
  "text-muted": textOn(TEXT_MUTED_ALPHA),
  "text-disabled": textOn(DISABLED_ALPHA),

  border: same("primary"),
  "border-blurred": (at) => shiftLightness(at("surface"), -BORDER_BLUR_DROP),

  "block-cursor-background": same("primary"),
  "block-cursor-foreground": same("on-primary"),
  "block-cursor-blurred-background": (at) => withAlpha(at("primary"), BLURRED_CURSOR_ALPHA),
  "block-cursor-blurred-foreground": same("foreground"),
  "block-hover-background": (at) => withAlpha(at("boost"), HOVER_ALPHA),

  "button-foreground": same("foreground"),
  "button-color-foreground": same("on-primary"),

  "footer-background": same("panel"),
  "footer-foreground": same("foreground"),
  "footer-description-background": none,
  "footer-description-foreground": same("foreground"),
  "footer-item-background": none,
  "footer-key-background": none,
  "footer-key-foreground": same("accent"),

  "input-cursor-background": same("foreground"),
  "input-cursor-foreground": same("background"),
  "input-selection-background": (at) => withAlpha(at("primary-lighten-1"), SELECTION_ALPHA),

  "link-background": none,
  "link-background-hover": same("primary"),
  "link-color": same("text"),
  "link-color-hover": same("on-primary"),

  "markdown-h1-background": none,
  "markdown-h1-color": same("primary"),
  "markdown-h2-background": none,
  "markdown-h2-color": same("primary"),
  "markdown-h3-background": none,
  "markdown-h3-color": same("primary"),
  "markdown-h4-background": none,
  "markdown-h4-color": same("foreground"),
  "markdown-h5-background": none,
  "markdown-h5-color": same("foreground"),
  "markdown-h6-background": none,
  "markdown-h6-color": same("text-muted"),

  scrollbar: (at) => alphaBlend(at("primary"), at("background-darken-1"), SCROLLBAR_ALPHA),
  "scrollbar-active": same("primary"),
  "scrollbar-hover": (at) => alphaBlend(at("primary"), at("background-darken-1"), SCROLLBAR_HOVER_ALPHA),
  "scrollbar-background": same("background-darken-1"),
  "scrollbar-background-active": same("scrollbar-background"),
  "scrollbar-background-hover": same("scrollbar-background"),
  "scrollbar-corner-color": same("scrollbar-background"),
};

const BASE_KEYS: readonly BaseRole[] = [...ACCENT_KEYS, "background", "foreground"];

/** Every role of every palette, read off the rules. */
export const PALETTE_ROLES: readonly PaletteRole[] = [...BASE_KEYS, ...(Object.keys(RULES) as PaletteRole[])];
const ROLE_NAMES: ReadonlySet<string> = new Set(PALETTE_ROLES);

/**
 * Build a full semantic palette from its base colors and any other role it
 * states: a stated role keeps its colour, and everything derived from it
 * follows it, but for `text-*`, which is held to read on its `*-muted`. An
 * authored theme is this with most roles stated; see `RULES` for what a role
 * not stated becomes.
 *
 * A translucent colour is drawn onto `background` before anything is derived
 * from it, so `on-*` is chosen against the colour the accent is drawn as.
 * `boost` alone stays a layer: it is what `panel` composites.
 */
export function buildPalette(name: string, dark: boolean, given: StatedRoles): Palette {
  const known = statedRoles(name, given);

  // [LAW:no-ambient-temporal-coupling] A rule asks for the roles it reads, so
  // no order among the rules matters. The eight base roles are always known.
  const at: At = (role) => {
    const colour = known.get(role) ?? RULES[role as keyof typeof RULES](at, dark);
    known.set(role, colour);
    return colour;
  };

  // [LAW:single-enforcer] Stated and derived `text-*` alike: the tint is the
  // palette's, whether it reads is decided here. A stated tint stays translucent
  // because it composites on its `*-muted`, and a `*-muted` that draws nothing
  // leaves it on `background`.
  for (const key of ACCENT_KEYS) {
    const ground = at(`${key}-muted`).compositeOver(at("background"));
    known.set(`text-${key}`, accentText(given[`text-${key}`] ?? at(`text-${key}`), ground, at("background")));
  }
  return new Palette(name, dark, Object.fromEntries(PALETTE_ROLES.map((role) => [role, at(role)])) as PaletteRoles);
}

/**
 * The roles `given` states, drawn on `background`. The one place a caller's
 * roles are read: a key that names no role is refused, and one holding
 * `undefined` states nothing. [LAW:parse-dont-validate]
 */
function statedRoles(name: string, given: StatedRoles): Map<PaletteRole, ColorRgba> {
  const drawn = drawnOn(name, given.background);
  const stated = Object.entries(given).flatMap(([role, colour]: [string, ColorRgba | undefined]): [PaletteRole, ColorRgba][] => {
    if (!ROLE_NAMES.has(role)) throw new RangeError(`palette ${JSON.stringify(name)}: ${JSON.stringify(role)} is not a role`);
    if (colour === undefined) return [];
    return [[role as PaletteRole, role === "boost" ? colour : drawn(colour)]];
  });
  const known = new Map(stated);
  // Every base colour is derived from, and a fully transparent one draws no
  // colour of its own to derive a muted shade or a contrast from.
  // [LAW:no-silent-failure]
  for (const key of BASE_KEYS) {
    const colour = given[key];
    if (colour.alpha === 0) {
      throw new RangeError(
        `palette ${JSON.stringify(name)}: ${key} is fully transparent (${colour.hex}), so there is no colour to derive the palette from`,
      );
    }
    known.set(key, drawn(colour));
  }
  return known;
}

/**
 * A palette's `text-*`: its tint held to WCAG AA on `*-muted`, moved toward
 * the palette's own text side so it also reads on `background`, where widgets
 * draw it too. The muted floor is the promise: where no lightness on the text
 * side clears it, the colour that does is on the other side, and the
 * background pair is the one given up. Every bundled palette clears both
 * (test/themes/text-on-muted.test.ts).
 *
 * [LAW:single-enforcer] The one rule for the pair, for the palettes derived
 * from a tint and the authored ones alike.
 */
function accentText(tint: ColorRgba, muted: ColorRgba, background: ColorRgba): ColorRgba {
  return ensureContrastToward(tint, muted, TEXT_ON_MUTED, contrastFor(background));
}
