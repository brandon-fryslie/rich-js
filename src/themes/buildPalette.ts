import { ColorRgba, blendRgb } from "../core/color.js";
import { alphaBlend, contrastFor, ensureContrastToward } from "./colorMath.js";
import { Palette, drawnOn } from "./palette.js";

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
// WCAG AA for body text: `text-*` is the label drawn on `*-muted`.
const TEXT_ON_MUTED = 4.5;

type AccentKey = "primary" | "secondary" | "accent" | "success" | "warning" | "error";

export const ACCENT_KEYS: readonly AccentKey[] = ["primary", "secondary", "accent", "success", "warning", "error"];

/**
 * Build a full semantic palette from base colors.
 *
 * Derived entries follow Textual's formulas:
 * - `*-muted` = color blended 70% toward its opposite base role. Defined for
 *              every accent AND for the two base roles themselves
 *              (`foreground-muted` blends toward `background`,
 *              `background-muted` blends toward `foreground`) — a caller
 *              de-emphasizing body/structural text reaches for
 *              `foreground-muted` the same way it reaches for
 *              `primary-muted` to de-emphasize an accent.
 * - `text-*`  = contrast text tinted 66% with the accent color, then held
 *              to WCAG AA (4.5:1) on `*-muted` — the foreground for a
 *              `*-muted` ground
 * - `on-*`    = WCAG-correct contrast colour (black or white) for use as
 *              foreground when the FULL accent is the background. Picked
 *              by relative luminance — single source of truth so widgets
 *              never need to invert / reverse fg/bg to get readable text.
 * - `surface` = background blended 5% toward foreground
 *
 * A translucent base colour is drawn onto `background` before anything is
 * derived from it, so `on-*` is chosen against the colour the accent is drawn
 * as and every derived entry is opaque.
 */
export function buildPalette(name: string, dark: boolean, given: BaseColors): Palette {
  const drawn = drawnOn(name, given.background);
  // Every base colour is derived from, and a fully transparent one draws no
  // colour of its own to derive a muted shade or a contrast from.
  // [LAW:no-silent-failure]
  const draw = (key: keyof BaseColors): ColorRgba => {
    const colour = given[key];
    if (colour.alpha === 0) {
      throw new RangeError(
        `palette ${JSON.stringify(name)}: ${key} is fully transparent (${colour.hex}), so there is no colour to derive the palette from`,
      );
    }
    return drawn(colour);
  };
  const base: BaseColors = {
    primary: draw("primary"),
    secondary: draw("secondary"),
    accent: draw("accent"),
    success: draw("success"),
    warning: draw("warning"),
    error: draw("error"),
    background: given.background,
    foreground: draw("foreground"),
  };
  const vars = new Map<string, ColorRgba>();

  // Base entries
  vars.set("background", base.background);
  vars.set("foreground", base.foreground);
  for (const key of ACCENT_KEYS) {
    vars.set(key, base[key]);
  }

  // Muted variants of the two base roles, same "blend 70% toward
  // background" formula as the accent `*-muted` family below — every
  // base color the palette defines gets a de-emphasized variant, not just
  // the accents. `foreground-muted` is what a caller reaches for to draw
  // structural/contextual text (labels, punctuation, ids) at reduced visual
  // weight without a terminal-support-dependent SGR attribute.
  vars.set("foreground-muted", blendRgb(base.foreground, base.background, MUTED_BLEND));
  vars.set("background-muted", blendRgb(base.background, base.foreground, MUTED_BLEND));

  // Surface — subtle lift from background
  vars.set("surface", blendRgb(base.background, base.foreground, SURFACE_LIFT));

  // Derived: muted, text-, and on- for each accent.
  // [LAW:single-enforcer] contrastFor is the only place that decides
  // black-vs-white for "text on this accent" — widgets read on-${accent}.
  const contrastText = contrastFor(base.background);
  for (const key of ACCENT_KEYS) {
    const color = base[key];
    const muted = blendRgb(color, base.background, MUTED_BLEND);
    vars.set(`${key}-muted`, muted);
    vars.set(`text-${key}`, accentText(alphaBlend(color, contrastText, TEXT_ALPHA), muted, base.background));
    vars.set(`on-${key}`, contrastFor(color));
  }

  return new Palette(name, dark, vars);
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
 * here and the authored ones the registry hydrates: the tint is the theme's,
 * whether it reads is decided here.
 */
export function accentText(tint: ColorRgba, muted: ColorRgba, background: ColorRgba): ColorRgba {
  return ensureContrastToward(tint, muted, TEXT_ON_MUTED, contrastFor(background));
}
