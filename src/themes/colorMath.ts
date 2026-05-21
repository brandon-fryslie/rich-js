import { ColorRgba, blendRgb } from "../core/color.js";

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
 * where black and white are equally readable).
 */
export function contrastFor(bg: ColorRgba): ColorRgba {
  const lum = relativeLuminance(bg);
  return lum > 0.179
    ? new ColorRgba(0, 0, 0)
    : new ColorRgba(255, 255, 255);
}

/**
 * WCAG 2.x relative luminance (0..1) of an opaque color. The single
 * luminance function in the codebase — `contrastFor`, `contrastRatio`, and
 * any caller that needs to reason about readability all funnel through it.
 * [LAW:one-source-of-truth]
 */
export function relativeLuminance(c: ColorRgba): number {
  const ch = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.red) + 0.7152 * ch(c.green) + 0.0722 * ch(c.blue);
}

/**
 * WCAG 2.x contrast ratio between two colors, in [1, 21]. Symmetric — the
 * order of arguments does not matter. 4.5 is the AA threshold for normal
 * text, 3.0 for large text.
 */
export function contrastRatio(a: ColorRgba, b: ColorRgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = la > lb ? la : lb;
  const lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Return a foreground guaranteed to clear `minRatio` against `bg`. If the
 * themed `fg` already passes it is returned untouched (text keeps its theme
 * color); otherwise it escalates to `contrastFor`'s black/white pick, which
 * is the maximum-contrast choice for any background.
 *
 * [LAW:single-enforcer] The one place "is this text readable, and if not fix
 * it" is decided. Callers route every fg/bg pair through here and the
 * unreadable state never reaches output. [LAW:dataflow-not-control-flow] the
 * function always runs; the measured ratio (data) decides whether the themed
 * color passes through or is replaced — there is no caller-side "should I
 * check contrast" branch.
 */
export function ensureContrast(
  fg: ColorRgba,
  bg: ColorRgba,
  minRatio: number,
): ColorRgba {
  return contrastRatio(fg, bg) >= minRatio ? fg : contrastFor(bg);
}
