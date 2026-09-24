import {
  ColorDepth,
  ColorRgba,
  ColorTable,
  EIGHT_BIT_DOWNGRADE_TABLE,
  STANDARD_TABLE,
  blendRgb,
  contrastRatio,
  relativeLuminance,
  SURFACE_BLACK,
} from "../core/color.js";
import { Oklch } from "../core/oklch.js";

const LEVEL_STEP = 0.1;

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl(c: ColorRgba): Hsl {
  const r = c.red / 255;
  const g = c.green / 255;
  const b = c.blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function clampChannel(v: number): number {
  // Float HSL math + Math.round can land at -1 or 256 at the boundaries; clamp
  // so an invalid ColorRgba never escapes this function.
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

function hslToRgb(hsl: Hsl): ColorRgba {
  const { h, s, l } = hsl;
  if (s === 0) {
    const v = clampChannel(l * 255);
    return new ColorRgba(v, v, v);
  }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return new ColorRgba(
    clampChannel((r + m) * 255),
    clampChannel((g + m) * 255),
    clampChannel((b + m) * 255),
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Darken a color by N levels, where each level reduces HSL lightness by 10%.
 * Negative levels lighten. Level 0 returns an equivalent triplet (after the
 * RGB↔HSL roundtrip; values may differ by ±1 due to rounding).
 */
export function darken(color: ColorRgba, levels: number): ColorRgba {
  const hsl = rgbToHsl(color);
  hsl.l = clamp01(hsl.l - LEVEL_STEP * levels);
  return hslToRgb(hsl);
}

/**
 * Lighten a color by N levels. Equivalent to `darken(color, -levels)`.
 */
export function lighten(color: ColorRgba, levels: number): ColorRgba {
  return darken(color, -levels);
}

/**
 * Composite `fg` over `bg` with the given alpha (0..1). At alpha=0 returns bg;
 * at alpha=1 returns fg.
 */
export function alphaBlend(
  fg: ColorRgba,
  bg: ColorRgba,
  alpha: number,
): ColorRgba {
  return blendRgb(bg, fg, clamp01(alpha));
}

/**
 * Pick a contrasting foreground (black or white) for a background, using the
 * WCAG relative-luminance threshold of 0.179 (the perceptually correct cutoff
 * where black and white are equally readable). A translucent `bg` is judged
 * as drawn: composited over `substrate` (see `drawnBackground`).
 */
export function contrastFor(
  bg: ColorRgba,
  substrate: ColorRgba = SURFACE_BLACK,
): ColorRgba {
  const lum = relativeLuminance(drawnBackground(bg, substrate));
  return lum > 0.179
    ? new ColorRgba(0, 0, 0)
    : new ColorRgba(255, 255, 255);
}

// [LAW:one-way-deps] The WCAG measures live in core/color.ts, beside the
// ColorTable whose `matchReadable` needs them to pick a drawn text colour, and
// below the theme math here. Re-exported so this module stays the colour-math
// surface.
export { relativeLuminance, contrastRatio };

// Iterations for the lightness bisection below. 20 resolves L to ~1e-6 — far
// finer than 8-bit quantization or the eye.
const CONTRAST_ITERS = 20;

/**
 * Return a foreground guaranteed to clear `minRatio` against `bg`, keeping the
 * color *recognizably itself*. If the themed `fg` already passes it is returned
 * untouched. Otherwise its OKLCH lightness is slid toward the pole that raises
 * contrast — holding hue, and chroma where it stays in gamut (near the poles
 * gamut clamping may reduce chroma, but hue is preserved) — until the ratio is
 * met, so a blue on a dark-blue background becomes a lighter blue, not white.
 * Only when no lightness of that hue can meet the ratio (a mid-toned
 * background where even pure black-or-white tops out below the target) does it
 * fall back to `contrastFor`'s black/white — the true maximum-contrast pick.
 *
 * A translucent `bg` is measured as it is drawn — composited over
 * `substrate`, the SGR writer's black by default — and a translucent `fg` is
 * then flattened over that drawn background, the order the writer composites
 * in, so the ratio is measured on what the eye actually sees and the returned
 * color is opaque.
 *
 * `drawnAt` is the depth the terminal will draw the pair at. At 256 colours
 * the terminal rounds text and background independently, and two roundings
 * can meet in the middle, so the ratio is measured on the drawn pair: a
 * colour that loses the floor there is replaced by the nearest cube/grey entry
 * that clears it (whose own rounding is itself). At ANSI the terminal draws
 * its own theme's colours, so no ratio exists — but text and background on
 * one index are one colour in every theme, so the floor there is a different
 * index: text that lands on its background's is replaced by the nearest entry
 * that does not. Truecolor draws the colour chosen.
 *
 * [LAW:single-enforcer] The one place "is this text readable, and if not fix
 * it" is decided. Callers route every fg/bg pair through here and the
 * unreadable state never reaches output. [LAW:dataflow-not-control-flow] the
 * function always runs; the measured ratio (data) decides how far the
 * lightness moves — there is no caller-side "should I check contrast" branch.
 */
export function ensureContrast(
  fg: ColorRgba,
  bg: ColorRgba,
  minRatio = 4.5, // WCAG AA for normal text
  drawnAt: ColorDepth = ColorDepth.TRUECOLOR,
  substrate: ColorRgba = SURFACE_BLACK,
): ColorRgba {
  const ground = drawnBackground(bg, substrate);
  const chosen = ensureTruecolorContrast(fg, ground, minRatio);
  // [LAW:dataflow-not-control-flow] The depth names the table the terminal
  // draws from: one whose entries have a known RGB is measured by ratio, one
  // whose entries are the terminal theme's own only by index.
  const indexed = INDEXED_DOWNGRADE[drawnAt];
  if (indexed !== undefined) {
    const groundIndex = indexed.match(ground);
    // [LAW:no-defensive-null-guards] Sixteen entries, one refused: the match
    // always exists, and the `!` states that.
    return indexed.match(chosen) !== groundIndex
      ? chosen
      : indexed.get(
          indexed.matchWhere(chosen, (_, index) => index !== groundIndex)!,
        );
  }
  const table = MEASURABLE_DOWNGRADE[drawnAt];
  if (table === undefined) return chosen;
  const drawnBg = table.get(table.match(ground));
  const drawn = table.get(table.match(chosen));
  if (contrastRatio(drawn, drawnBg) >= minRatio) return chosen;
  return table.get(table.matchReadable(chosen, drawnBg, minRatio));
}

/**
 * `chosen`, or — when the depth the terminal draws at rounds it to a colour
 * `accept` refuses — the nearest colour that depth draws as itself which
 * `accept` takes. `accept` sees the candidate as drawn, and `drawn`, the same
 * rounding for any other colour it measures against, so the caller states a
 * floor once and it holds on the colours the terminal shows. Truecolor draws
 * what was chosen and ANSI draws the terminal theme's own colours, so only a
 * table with known RGB — 256 colours — has a rounding to repair; `undefined`
 * there means no cube or grey entry is accepted.
 *
 * `ensureContrast` is this with a contrast ratio as the floor; this is for a
 * floor that is not text on its background (an open state standing off every
 * closed cell, two planes standing off each other).
 */
export function ensureDrawn(
  chosen: ColorRgba,
  drawnAt: ColorDepth,
  accept: (candidate: ColorRgba, drawn: (c: ColorRgba) => ColorRgba) => boolean,
  substrate: ColorRgba = SURFACE_BLACK,
): ColorRgba | undefined {
  const table = MEASURABLE_DOWNGRADE[drawnAt];
  if (table === undefined) return chosen;
  const drawn = (c: ColorRgba): ColorRgba =>
    table.get(table.match(drawnBackground(c, substrate)));
  if (accept(drawn(chosen), drawn)) return chosen;
  const index = table.matchWhere(drawnBackground(chosen, substrate), (entry) =>
    accept(entry, drawn),
  );
  return index === undefined ? undefined : table.get(index);
}

/**
 * A background as it is drawn: composited over the surface beneath it. That
 * surface is a fact about where the pair is drawn, so it arrives as a value:
 * the SGR writer (`Style.toSgrCodes`) composites over `SURFACE_BLACK`, the
 * default here; a caller choosing text for a different surface — an export's
 * canvas, `exportCanvas(theme).background` — names that one.
 * [LAW:no-silent-failure] A surface has nothing under it, so a translucent one
 * has no drawn colour to offer; `compositeOver` would read its raw RGB as if
 * it were opaque, so it is refused here rather than measured wrong.
 * [LAW:one-source-of-truth] Text is chosen against the colour the surface will
 * show — measuring the raw RGBA reads a colour that is drawn nowhere, and text
 * that "clears" it can land below the floor. Opaque colours composite to
 * themselves.
 */
function drawnBackground(bg: ColorRgba, substrate: ColorRgba): ColorRgba {
  if (substrate.alpha !== 1) {
    throw new RangeError(
      `a contrast substrate is the opaque surface under a translucent background; got ${substrate.hex}`,
    );
  }
  return bg.compositeOver(substrate);
}

/**
 * The downgrade tables whose entries the terminal draws at a known RGB, by the
 * depth that draws from them. 256 colours is the one: its cube and grey ramp
 * are fixed by xterm. ANSI 0–15 and the default colour are the terminal
 * theme's own, so text drawn there has no ratio to keep; truecolor draws the
 * chosen colour itself.
 */
const MEASURABLE_DOWNGRADE: Partial<Record<ColorDepth, ColorTable>> = {
  [ColorDepth.EIGHT_BIT]: EIGHT_BIT_DOWNGRADE_TABLE,
};

/**
 * The downgrade tables whose entries the terminal draws in its own theme's
 * colours, by the depth that draws from them: ANSI 0–15. No ratio can be
 * measured there; only whether two colours landed on one index.
 */
const INDEXED_DOWNGRADE: Partial<Record<ColorDepth, ColorTable>> = {
  [ColorDepth.STANDARD]: STANDARD_TABLE,
};

function ensureTruecolorContrast(
  fg: ColorRgba,
  bg: ColorRgba,
  minRatio: number,
): ColorRgba {
  // Flatten translucency so the guarantee holds for the displayed color, not
  // the raw bytes (e.g. a "#FFFFFF60" text-disabled over a light surface).
  const opaqueFg = fg.compositeOver(bg);
  if (contrastRatio(opaqueFg, bg) >= minRatio) return opaqueFg;

  const lab = Oklch.fromRgba(opaqueFg);
  // The pole that increases contrast: lighten toward white on a dark bg, darken
  // toward black on a light one. `contrastFor`'s 0.179 cutoff names it.
  const poleL = relativeLuminance(bg) > 0.179 ? 0 : 1;

  // If even the pole of this hue can't reach the ratio, the hue physically
  // can't — return the true maximum-contrast pick (pure black/white from
  // contrastFor). The gamut-clamped OKLCH pole is only *near* b/w, so
  // contrastFor is at least as strong and is the honest maximum.
  const pole = new Oklch(poleL, lab.c, lab.h, lab.alpha).toRgba();
  if (contrastRatio(pole, bg) < minRatio) return contrastFor(bg);

  // Bisect for the lightness nearest the original that still clears the ratio:
  // the smallest perceptual change that achieves accessibility. Contrast is
  // monotone in L over [lab.l, poleL] (everything below the crossing fails),
  // so the search is well-posed.
  let fail = lab.l;
  let pass = poleL;
  for (let i = 0; i < CONTRAST_ITERS; i++) {
    const mid = (fail + pass) / 2;
    const candidate = new Oklch(mid, lab.c, lab.h, lab.alpha).toRgba();
    if (contrastRatio(candidate, bg) >= minRatio) pass = mid;
    else fail = mid;
  }
  return new Oklch(pass, lab.c, lab.h, lab.alpha).toRgba();
}
