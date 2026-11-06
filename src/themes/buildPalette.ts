import { ColorRgba, blendRgb, contrastRatio, relativeLuminance } from "../core/color.js";
import { alphaBlend, contrastFor, ensureContrast, ensureContrastToward, shiftLightness } from "./colorMath.js";
import { Palette, drawnOn, type AccentRole, type BaseRole, type PaletteRole, type PaletteRoles, type Shade, type ShadedRole } from "./palette.js";
import { groundRelativeHint, neutralAlpha, neutralText, textFloor, withAlpha, type NeutralIntent } from "./text-on.js";

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
const BLURRED_CURSOR_ALPHA = 0.3;
const HOVER_ALPHA = 0.1;
const SELECTION_ALPHA = 0.4;
const SCROLLBAR_ALPHA = 0.4;
const SCROLLBAR_HOVER_ALPHA = 0.5;

const ACCENT_KEYS: readonly AccentRole[] = ["primary", "secondary", "accent", "success", "warning", "error"];

/** The eight roles every palette is given, and every role it may also state. */
export type StatedRoles = BaseColors & Partial<PaletteRoles>;

/** A role's color in the palette being built, derived if it was not stated. */
type At = (role: PaletteRole) => ColorRgba;
type Rule = (at: At, dark: boolean) => ColorRgba;

const TRANSPARENT = new ColorRgba(0, 0, 0, 0);
const WHITE = new ColorRgba(255, 255, 255);
const BLACK = new ColorRgba(0, 0, 0);

/**
 * Text a component draws on a ground of its own: the ground, and what the text
 * is — one of Textual's ground-relative weights, or a role's color, the way
 * Textual draws a footer key in `accent`. [LAW:one-source-of-truth] The one
 * place a component's text is paired with its ground: the text is derived on
 * it, a stated tint composites on it, and both are held to their floor there.
 * A ground that itself sits on another surface names it in `GROUND`.
 */
type ComponentText = { readonly ground: PaletteRole } & ({ readonly intent: NeutralIntent } | { readonly color: PaletteRole });

export const COMPONENT_TEXT = {
  "block-cursor-foreground": { ground: "block-cursor-background", intent: "text" },
  "block-cursor-blurred-foreground": { ground: "block-cursor-blurred-background", color: "foreground" },
  "button-color-foreground": { ground: "primary", intent: "text" },
  "footer-foreground": { ground: "footer-background", color: "foreground" },
  "footer-description-foreground": { ground: "footer-description-background", color: "foreground" },
  "footer-key-foreground": { ground: "footer-key-background", color: "accent" },
  "input-cursor-foreground": { ground: "input-cursor-background", color: "background" },
  "link-color": { ground: "link-background", intent: "text" },
  "link-color-hover": { ground: "link-background-hover", intent: "text" },
  "markdown-h1-color": { ground: "markdown-h1-background", color: "primary" },
  "markdown-h2-color": { ground: "markdown-h2-background", color: "primary" },
  "markdown-h3-color": { ground: "markdown-h3-background", color: "primary" },
  "markdown-h4-color": { ground: "markdown-h4-background", color: "foreground" },
  "markdown-h5-color": { ground: "markdown-h5-background", color: "foreground" },
  "markdown-h6-color": { ground: "markdown-h6-background", intent: "text-muted" },
} as const satisfies { readonly [R in PaletteRole]?: ComponentText };

type ComponentTextRole = keyof typeof COMPONENT_TEXT;
const isComponentText = (role: PaletteRole): role is ComponentTextRole => Object.hasOwn(COMPONENT_TEXT, role);

/** `role` as it is drawn: on what `GROUND` says it sits on, down to `background`. */
const drawnAs = (role: PaletteRole, at: At): ColorRgba =>
  at(role).compositeOver(role === "background" ? at("background") : drawnAs(GROUND[role] ?? "background", at));

/** A component's ground as it is drawn, so a transparent one is the surface under it. */
const groundOf = (role: ComponentTextRole, at: At): ColorRgba => drawnAs(COMPONENT_TEXT[role].ground, at);

/** The floor a component's text is held to: its weight's, or body text's for a role's color. */
const componentFloor = (text: ComponentText): number => textFloor("intent" in text ? text.intent : "foreground");

/**
 * `color` drawn on the component's ground and held to its floor there: moved
 * in lightness on its own side of the ground — light text stays light — and
 * to the other side only where its own cannot reach the floor.
 */
const heldOnGround = (role: ComponentTextRole, color: ColorRgba, at: At): ColorRgba => {
  const ground = groundOf(role, at);
  const floor = componentFloor(COMPONENT_TEXT[role]);
  const drawn = color.compositeOver(ground);
  const own = relativeLuminance(drawn) >= relativeLuminance(ground) ? WHITE : BLACK;
  const kept = ensureContrastToward(drawn, ground, floor, own);
  return contrastRatio(kept, ground) >= floor ? kept : ensureContrast(drawn, ground, floor);
};

/** A component's text as derived: its weight on its ground, or its role's color held there. */
const componentRule = (role: ComponentTextRole): Rule => (at) => {
  const text: ComponentText = COMPONENT_TEXT[role];
  return "intent" in text ? neutralText(text.intent, groundOf(role, at)) : heldOnGround(role, at(text.color), at);
};

const componentRules = Object.fromEntries(
  (Object.keys(COMPONENT_TEXT) as ComponentTextRole[]).map((role) => [role, componentRule(role)]),
) as Record<ComponentTextRole, Rule>;

// [LAW:one-type-per-behavior] The roles naming another role's color outright.
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
    [`text-${accent}`]: ((at) => alphaBlend(at(accent), contrastFor(at("background")), TEXT_ALPHA)) as Rule,
  } as Record<`${A}${Shade}` | `${A}-muted` | `text-${A}`, Rule>;
}

/**
 * How each role not given to `buildPalette` is derived, following Textual's
 * `ColorSystem`, which generated the bundled themes:
 *
 * - `*-muted`  = the color blended 70% toward its opposite base role — every
 *               accent AND the two base roles themselves, so a caller
 *               de-emphasizing body text reaches for `foreground-muted` the
 *               way it reaches for `primary-muted` to de-emphasize an accent.
 *               `foreground-muted` is opaque here where Textual's is translucent,
 *               drawing structural text at reduced weight without a
 *               terminal-support-dependent SGR attribute.
 * - `text-*`   = contrast text tinted 66% with the accent; `buildPalette` then
 *               holds it to read on its `*-muted` and on the three grounds
 * - text on a component (`block-cursor-foreground`, `link-color`, …) = Textual's
 *               ground-relative weight, or the role Textual draws it in, held
 *               to its floor on that component's ground (`COMPONENT_TEXT`)
 * - `surface`  = background blended 5% toward foreground, a subtle lift
 * - `*-darken-N` / `*-lighten-N` = the root moved 7.5% of CIE L* per rung
 * - the other component roles (`footer-*`, `markdown-*`, …) name the base role
 *   Textual draws that component in
 *
 * [LAW:types-are-the-program] Total over every role but the eight given, so a
 * palette cannot lack one and a role cannot exist without a way to derive it.
 */
const RULES: { readonly [R in Exclude<PaletteRole, BaseRole>]: Rule } = {
  ...componentRules,
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
  "foreground-disabled": (at) => withAlpha(at("foreground"), neutralAlpha("text-disabled")),

  surface: (at) => blendRgb(at("background"), at("foreground"), SURFACE_LIFT),
  "surface-active": (at) => shiftLightness(at("surface"), SURFACE_ACTIVE_LIFT),
  boost: (at) => withAlpha(contrastFor(at("background")), BOOST_ALPHA),
  panel: (at, dark) => {
    const tinted = blendRgb(at("surface"), at("primary"), PANEL_TINT);
    return dark ? at("boost").compositeOver(tinted) : tinted;
  },
  "primary-background": accentBackground("primary", 0),
  "secondary-background": accentBackground("secondary", 0),

  border: same("primary"),
  "border-blurred": (at) => shiftLightness(at("surface"), -BORDER_BLUR_DROP),

  "block-cursor-background": same("primary"),
  "block-cursor-blurred-background": (at) => withAlpha(at("primary"), BLURRED_CURSOR_ALPHA),
  "block-hover-background": (at) => withAlpha(at("boost"), HOVER_ALPHA),

  "button-foreground": same("foreground"),

  "footer-background": same("panel"),
  "footer-description-background": none,
  "footer-item-background": none,
  "footer-key-background": none,

  "input-cursor-background": same("foreground"),
  "input-selection-background": (at) => withAlpha(at("primary-lighten-1"), SELECTION_ALPHA),

  "link-background": none,
  "link-background-hover": same("primary"),

  "markdown-h1-background": none,
  "markdown-h2-background": none,
  "markdown-h3-background": none,
  "markdown-h4-background": none,
  "markdown-h5-background": none,
  "markdown-h6-background": none,

  scrollbar: (at) => alphaBlend(at("primary"), at("background-darken-1"), SCROLLBAR_ALPHA),
  "scrollbar-active": same("primary"),
  "scrollbar-hover": (at) => alphaBlend(at("primary"), at("background-darken-1"), SCROLLBAR_HOVER_ALPHA),
  "scrollbar-background": same("background-darken-1"),
  "scrollbar-background-active": same("scrollbar-background"),
  "scrollbar-background-hover": same("scrollbar-background"),
  "scrollbar-corner-color": same("scrollbar-background"),
};

export const BASE_KEYS: readonly BaseRole[] = [...ACCENT_KEYS, "background", "foreground"];

/** Every role of every palette, read off the rules. */
export const PALETTE_ROLES: readonly PaletteRole[] = [...BASE_KEYS, ...(Object.keys(RULES) as PaletteRole[])];
const ROLE_NAMES: ReadonlySet<string> = new Set(PALETTE_ROLES);

/**
 * Build a full semantic palette from its base colors and any other role it
 * states: a stated role keeps its color, and everything derived from it
 * follows it, but for `text-*` and `foreground-muted`, which are held to read
 * on the grounds Textual promises them (`heldOn`), and a component's text,
 * held on its own ground (`COMPONENT_TEXT`) when the author's color misses
 * its floor there. An authored theme is this
 * with roles stated; see `RULES` for what a role not stated becomes.
 *
 * A stated translucent color is drawn onto its ground before anything is
 * derived from it (`GROUND`), so a component's text is chosen against the
 * color its ground is drawn as.
 */
export function buildPalette(name: string, dark: boolean, given: StatedRoles): Palette {
  const stated = statedRoles(name, given);
  const known = new Map<PaletteRole, ColorRgba>();
  const drawn = drawnOn(name, given.background);
  for (const key of BASE_KEYS) known.set(key, drawn(given[key]));

  // [LAW:no-ambient-temporal-coupling] A rule asks for the roles it reads, so
  // no order among the rules matters. The eight base roles are always known.
  const at: At = (role) => {
    const color = known.get(role) ?? drawnOnGround(role, stated.get(role), at) ?? RULES[role as keyof typeof RULES](at, dark);
    known.set(role, color);
    return color;
  };

  // [LAW:single-enforcer] Stated and derived alike: the color is the palette's,
  // whether it reads is decided here, at the floor `textOn` holds the intent to.
  const grounds = (["background", "surface", "panel"] as const).map((role) => at(role).compositeOver(at("background")));
  const side = contrastFor(at("background"));
  for (const key of ACCENT_KEYS) {
    const muted = at(`${key}-muted`).compositeOver(at("background"));
    known.set(`text-${key}`, heldOn(at(`text-${key}`), [...grounds, muted], textFloor(`text-${key}`), side));
  }
  known.set("foreground-muted", heldOn(at("foreground-muted"), grounds, textFloor("foreground-muted"), side));
  return new Palette(name, dark, Object.fromEntries(PALETTE_ROLES.map((role) => [role, at(role)])) as PaletteRoles);
}

/**
 * The role each role is drawn on, where that is not `background`: a text on
 * its ground, and a ground on the surface under it, as Textual stacks them —
 * a footer key on its footer item on the footer bar. A stated translucent
 * color composites there, so a cursor's `#000000DD` is the color it shows on
 * the cursor. [LAW:one-source-of-truth]
 */
const GROUND: { readonly [R in PaletteRole]?: PaletteRole } = {
  ...Object.fromEntries(ACCENT_KEYS.map((key) => [`text-${key}`, `${key}-muted`])),
  ...Object.fromEntries(Object.entries(COMPONENT_TEXT).map(([role, { ground }]) => [role, ground])),
  "footer-key-background": "footer-item-background",
  "footer-description-background": "footer-item-background",
  "footer-item-background": "footer-background",
};

/**
 * A stated role as it is drawn: on its ground (`GROUND`), itself drawn on
 * `background`. `boost` alone stays a layer: it is what `panel` composites,
 * and a fully transparent color draws nothing anywhere. A component's stated
 * text, tint or opaque, is held to its floor on its ground as the derived
 * text is: an author's color that reads there is kept as given, and one that
 * does not moves in lightness (`heldOnGround`), keeping its hue and its side
 * of the ground where those can reach the floor.
 */
function drawnOnGround(role: PaletteRole, color: ColorRgba | undefined, at: At): ColorRgba | undefined {
  if (color === undefined || role === "boost" || color.alpha === 0) return color;
  if (isComponentText(role)) return heldOnGround(role, color, at);
  if (color.alpha === 1) return color;
  return color.compositeOver(drawnAs(GROUND[role] ?? "background", at));
}

/**
 * The roles `given` states, as given. The one place a caller's roles are read:
 * a key that names no role is refused, and one holding `undefined` states
 * nothing. [LAW:parse-dont-validate]
 */
function statedRoles(name: string, given: StatedRoles): Map<PaletteRole, ColorRgba> {
  const stated = Object.entries(given).flatMap(([role, color]: [string, ColorRgba | undefined]): [PaletteRole, ColorRgba][] => {
    if (!ROLE_NAMES.has(role)) throw new RangeError(`palette ${JSON.stringify(name)}: ${JSON.stringify(role)} is not a role${groundRelativeHint(role)}`);
    return color === undefined ? [] : [[role as PaletteRole, color]];
  });
  // Every base color is derived from, and a fully transparent one draws no
  // color of its own to derive a muted shade or a contrast from.
  // [LAW:no-silent-failure]
  for (const key of BASE_KEYS) {
    const color = given[key];
    if (color.alpha === 0) {
      throw new RangeError(
        `palette ${JSON.stringify(name)}: ${key} is fully transparent (${color.hex}), so there is no color to derive the palette from`,
      );
    }
  }
  return new Map(stated);
}

/**
 * Text Textual promises legible on several grounds: `color` moved in lightness
 * toward the palette's own text side until it clears `floor` on each, in turn.
 * The grounds of one palette sit on one side of its text, so a step that clears
 * a later ground loses none of the earlier ones. The last ground is the
 * promise: where no lightness on the text side clears it, the color that does
 * is on the other side, and the earlier grounds are the ones given up. Every
 * bundled palette clears all of them (test/themes/text-on-grounds.test.ts).
 *
 * [LAW:single-enforcer] The one rule for a palette's fixed text, for the
 * palettes derived from a tint and the authored ones alike.
 */
function heldOn(color: ColorRgba, grounds: readonly ColorRgba[], floor: number, side: ColorRgba): ColorRgba {
  return grounds.reduce((held, ground) => ensureContrastToward(held, ground, floor, side), color);
}
