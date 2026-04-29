import { ColorQuad } from "../core/color.js";

const LEVEL_STEP = 0.1;

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl(c: ColorQuad): Hsl {
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
  // so an invalid channel value never escapes this function.
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

function hslToRgb(hsl: Hsl, alpha: number): ColorQuad {
  const { h, s, l } = hsl;
  if (s === 0) {
    const v = clampChannel(l * 255);
    return new ColorQuad(v, v, v, alpha);
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
  return new ColorQuad(
    clampChannel((r + m) * 255),
    clampChannel((g + m) * 255),
    clampChannel((b + m) * 255),
    alpha,
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Darken a color by N levels, where each level reduces HSL lightness by 10%.
 * Negative levels lighten. Level 0 returns an equivalent color (after the
 * RGB↔HSL roundtrip; values may differ by ±1 due to rounding). Alpha is
 * preserved unchanged — darkening is a pure RGB operation.
 */
export function darken(color: ColorQuad, levels: number): ColorQuad {
  const hsl = rgbToHsl(color);
  hsl.l = clamp01(hsl.l - LEVEL_STEP * levels);
  return hslToRgb(hsl, color.alpha);
}

/**
 * Lighten a color by N levels. Equivalent to `darken(color, -levels)`.
 * Alpha is preserved unchanged.
 */
export function lighten(color: ColorQuad, levels: number): ColorQuad {
  return darken(color, -levels);
}

/**
 * Per-channel linear interpolation between `bg` (opacity=0) and `fg`
 * (opacity=1), including alpha. Generalizes the rgb-only crossfade: at
 * opacity=0.5 every channel is the midpoint. When both sides are fully
 * opaque (the common case) result alpha is also 1; when sides differ in
 * alpha, the alpha channel rides the same ramp as rgb.
 */
export function alphaBlend(
  fg: ColorQuad,
  bg: ColorQuad,
  opacity: number,
): ColorQuad {
  const t = clamp01(opacity);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return new ColorQuad(
    clampChannel(lerp(bg.red, fg.red)),
    clampChannel(lerp(bg.green, fg.green)),
    clampChannel(lerp(bg.blue, fg.blue)),
    clamp01(lerp(bg.alpha, fg.alpha)),
  );
}

/**
 * Pick a contrasting foreground (black or white) for a background, using the
 * WCAG relative-luminance threshold of 0.179 (the perceptually correct cutoff
 * where black and white are equally readable). The contrast color is always
 * fully opaque — it's a solid visibility choice, not an overlay.
 *
 * Luminance is computed from rgb only; bg.alpha does not influence the
 * decision (the surface beneath is unknown at this layer).
 */
export function contrastFor(bg: ColorQuad): ColorQuad {
  const lum = relativeLuminance(bg);
  return lum > 0.179
    ? new ColorQuad(0, 0, 0, 1)
    : new ColorQuad(255, 255, 255, 1);
}

function relativeLuminance(c: ColorQuad): number {
  const ch = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.red) + 0.7152 * ch(c.green) + 0.0722 * ch(c.blue);
}
