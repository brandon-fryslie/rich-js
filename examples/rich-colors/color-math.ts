import { Color, blendRgb } from "../../src/index.js";

/**
 * Color space conversion and palette generation utilities.
 *
 * [LAW:one-source-of-truth] Color math operations are pure functions that
 * don't rely on external state. Results can be safely cached or memoized.
 */

/**
 * Represents a color in HSL color space.
 */
export interface HSL {
  /** Hue: 0-360 degrees */
  h: number;
  /** Saturation: 0-100 percent */
  s: number;
  /** Lightness: 0-100 percent */
  l: number;
}

/**
 * Convert RGB to HSL color space.
 * Useful for generating harmonious color palettes.
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB color space.
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Generate a complementary color palette (opposite hue).
 * Returns the base color and its complement.
 */
export function generateComplementary(baseColor: Color): Color[] {
  const triplet = baseColor.getTruecolor();
  const hsl = rgbToHsl(triplet.red, triplet.green, triplet.blue);

  const complement = hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
  const complementColor = Color.fromRgb(complement.r, complement.g, complement.b);

  return [baseColor, complementColor];
}

/**
 * Generate an analogous color palette (adjacent hues).
 * Returns colors at hue ± 30 degrees.
 */
export function generateAnalogous(baseColor: Color): Color[] {
  const triplet = baseColor.getTruecolor();
  const hsl = rgbToHsl(triplet.red, triplet.green, triplet.blue);

  const colors: Color[] = [];
  for (const offset of [-30, 0, 30]) {
    const h = (hsl.h + offset + 360) % 360;
    const rgb = hslToRgb(h, hsl.s, hsl.l);
    colors.push(Color.fromRgb(rgb.r, rgb.g, rgb.b));
  }

  return colors;
}

/**
 * Generate a triadic color palette (120 degrees apart).
 * Returns 3 colors equally spaced around the color wheel.
 */
export function generateTriadic(baseColor: Color): Color[] {
  const triplet = baseColor.getTruecolor();
  const hsl = rgbToHsl(triplet.red, triplet.green, triplet.blue);

  const colors: Color[] = [];
  for (const offset of [0, 120, 240]) {
    const h = (hsl.h + offset) % 360;
    const rgb = hslToRgb(h, hsl.s, hsl.l);
    colors.push(Color.fromRgb(rgb.r, rgb.g, rgb.b));
  }

  return colors;
}

/**
 * Generate a tetradic (square) color palette (90 degrees apart).
 * Returns 4 colors equally spaced around the color wheel.
 */
export function generateTetradic(baseColor: Color): Color[] {
  const triplet = baseColor.getTruecolor();
  const hsl = rgbToHsl(triplet.red, triplet.green, triplet.blue);

  const colors: Color[] = [];
  for (const offset of [0, 90, 180, 270]) {
    const h = (hsl.h + offset) % 360;
    const rgb = hslToRgb(h, hsl.s, hsl.l);
    colors.push(Color.fromRgb(rgb.r, rgb.g, rgb.b));
  }

  return colors;
}

/**
 * Generate a monochromatic color palette (same hue, varying lightness).
 * Returns colors from dark to light with the same hue and saturation.
 */
export function generateMonochromatic(baseColor: Color, count: number = 5): Color[] {
  const triplet = baseColor.getTruecolor();
  const hsl = rgbToHsl(triplet.red, triplet.green, triplet.blue);

  const colors: Color[] = [];
  const step = 100 / (count + 1);

  for (let i = 1; i <= count; i++) {
    const l = step * i;
    const rgb = hslToRgb(hsl.h, hsl.s, l);
    colors.push(Color.fromRgb(rgb.r, rgb.g, rgb.b));
  }

  return colors;
}

/**
 * Generate shades of a color (blend with black).
 * Returns colors from the original to darker.
 */
export function generateShades(baseColor: Color, count: number = 5): Color[] {
  const triplet = baseColor.getTruecolor();
  const blackTriplet = Color.fromRgb(0, 0, 0).getTruecolor();

  const colors: Color[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = (i + 1) / (count + 1);
    const blended = blendRgb(triplet, blackTriplet, ratio);
    colors.push(Color.fromRgb(blended.red, blended.green, blended.blue));
  }

  return colors;
}

/**
 * Generate tints of a color (blend with white).
 * Returns colors from the original to lighter.
 */
export function generateTints(baseColor: Color, count: number = 5): Color[] {
  const triplet = baseColor.getTruecolor();
  const whiteTriplet = Color.fromRgb(255, 255, 255).getTruecolor();

  const colors: Color[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = (i + 1) / (count + 1);
    const blended = blendRgb(triplet, whiteTriplet, ratio);
    colors.push(Color.fromRgb(blended.red, blended.green, blended.blue));
  }

  return colors;
}

/**
 * Generate a palette based on the specified mode.
 */
export function generatePalette(
  baseColor: Color,
  mode: "complementary" | "analogous" | "triadic" | "tetradic" | "square" | "monochromatic" | "shades" | "tints"
): Color[] {
  switch (mode) {
    case "complementary":
      return generateComplementary(baseColor);
    case "analogous":
      return generateAnalogous(baseColor);
    case "triadic":
      return generateTriadic(baseColor);
    case "tetradic":
    case "square":
      return generateTetradic(baseColor);
    case "monochromatic":
      return generateMonochromatic(baseColor, 6);
    case "shades":
      return generateShades(baseColor, 6);
    case "tints":
      return generateTints(baseColor, 6);
    default:
      return [baseColor];
  }
}
