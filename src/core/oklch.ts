/**
 * OKLCH color space — perceptually-uniform polar form of OKLab.
 *
 * Math from Björn Ottosson's OKLab specification:
 *   https://bottosson.github.io/posts/oklab/
 *
 * The full pipeline:
 *   sRGB (0..255 int)  ↔  sRGB linear (0..1 float)  ↔  OKLab  ↔  OKLCH polar
 * `fromRgba` walks left→right, `toRgba` walks right→left. The only lossy
 * step is the final 0..255 quantization; the float math itself is
 * reversible to within a few ULP.
 *
 * [LAW:one-type-per-behavior] OKLCH and sRGB are different *behaviors*:
 * sRGB is the wire format terminals consume (what ANSI escape codes
 * carry); OKLCH is the perceptual manipulation space (where equal
 * numerical deltas mean equal perceptual deltas, which is the property
 * "transposition" requires). Two types, mutual conversion, no hybrid.
 *
 * [LAW:one-way-deps] This module imports `ColorRgba` from core/color and
 * nothing else from inside the project. Nothing in core/ depends back on
 * this file.
 */

import { ColorRgba } from "./color.js";

// ---------------------------------------------------------------------------
// ThemeKey — the "key signature" applied during transposition.
// ---------------------------------------------------------------------------

/**
 * A perceptually-uniform color transform.
 *
 * [LAW:dataflow-not-control-flow] Identity is *data* (`IDENTITY`), not a
 * special case. Every transposition runs the same code path — the values
 * decide whether the operation is a no-op or a 180° rotation.
 *
 * Lightness is parameterized as `L' = clamp01(L * scale + shift)` to make
 * "invert" expressible as `{scale: -1, shift: 1}` without a boolean knob.
 */
export interface ThemeKey {
  /** Hue offset in degrees; positive rotates toward warmer→cooler→back. */
  readonly hueShift: number;
  /** Multiplier on chroma. 0 = grayscale, 1 = identity, >1 = more saturated. */
  readonly chromaScale: number;
  /** Multiplier on lightness. 1 = identity, -1 = invert around the L axis. */
  readonly lightnessScale: number;
  /** Additive on lightness; applied *after* the scale. */
  readonly lightnessShift: number;
}

export const IDENTITY: ThemeKey = Object.freeze({
  hueShift: 0,
  chromaScale: 1,
  lightnessScale: 1,
  lightnessShift: 0,
});

/**
 * Flip lightness around the midpoint (`L' = 1 - L`) with hue and chroma
 * untouched. Combined with the anchor logic in `transposePalette`, this
 * converts a dark theme to its light "octave": semantic anchors
 * (error/success/warning) still lightness-invert — only their *hue* is
 * preserved — so errors stay red and dark-on-light becomes light-on-dark.
 */
export const INVERT_LIGHTNESS: ThemeKey = Object.freeze({
  hueShift: 0,
  chromaScale: 1,
  lightnessScale: -1,
  lightnessShift: 1,
});

/**
 * Whether a key is the no-op transform. Exported so that callers
 * (`transposePalette`) can fast-path byte-exact identity without going
 * through the lossy sRGB↔OKLCH round-trip. [LAW:one-source-of-truth] —
 * the predicate lives once, here.
 */
export function isIdentityKey(k: ThemeKey): boolean {
  return (
    k.hueShift % 360 === 0 && // a whole turn (0, 360, -360, …) is a no-op
    k.chromaScale === 1 &&
    k.lightnessScale === 1 &&
    k.lightnessShift === 0
  );
}

// ---------------------------------------------------------------------------
// Pure conversion helpers (private).
// ---------------------------------------------------------------------------

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Small tolerance so float-fuzz at the gamut edge doesn't trigger needless
// chroma reduction on colors that are already representable.
const GAMUT_EPS = 1e-4;

// [LAW:one-source-of-truth] Below this chroma a color is achromatic and its
// hue is pinned to 0 so round-trips stay stable — the one threshold every
// chroma reader here shares.
const ACHROMATIC_EPS = 1e-7;

function inGamut(r: number, g: number, b: number): boolean {
  return (
    r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS &&
    g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS &&
    b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS
  );
}

// ---------------------------------------------------------------------------
// Oklch — the value type.
// ---------------------------------------------------------------------------

/**
 * Immutable OKLCH color. `l` ∈ [0, 1] (lightness), `c` ≥ 0 (chroma; typical
 * sRGB-representable colors top out near 0.32), `h` ∈ [0, 360) (hue
 * degrees), `alpha` ∈ [0, 1].
 *
 * [LAW:single-enforcer] Constructor is the only validation site, matching
 * the `ColorRgba` pattern. Out-of-range `alpha` throws. l/c/h must be
 * finite but are *not* clamped at construction — they're clamped during
 * `toRgba` instead, so transforms can pass through intermediate
 * representations (e.g. h = 720°, c = -0.1 mid-pipeline) before the final
 * sRGB-quantization step normalizes them.
 */
export class Oklch {
  constructor(
    readonly l: number,
    readonly c: number,
    readonly h: number,
    readonly alpha: number = 1,
  ) {
    if (!Number.isFinite(l)) throw new RangeError(`Oklch.l must be finite; got ${l}`);
    if (!Number.isFinite(c)) throw new RangeError(`Oklch.c must be finite; got ${c}`);
    if (!Number.isFinite(h)) throw new RangeError(`Oklch.h must be finite; got ${h}`);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      throw new RangeError(`Oklch.alpha must be a finite number in [0,1]; got ${alpha}`);
    }
  }

  /** sRGB → linear → OKLab → polar. Pure; no I/O, no allocation beyond the result. */
  static fromRgba(color: ColorRgba): Oklch {
    const [r, g, b, a] = color.normalized;
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const lLong = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const mLong = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const sLong = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    const lCube = Math.cbrt(lLong);
    const mCube = Math.cbrt(mLong);
    const sCube = Math.cbrt(sLong);

    const L  = 0.2104542553 * lCube + 0.7936177850 * mCube - 0.0040720468 * sCube;
    const aLab = 1.9779984951 * lCube - 2.4285922050 * mCube + 0.4505937099 * sCube;
    const bLab = 0.0259040371 * lCube + 0.7827717662 * mCube - 0.8086757660 * sCube;

    const C = Math.sqrt(aLab * aLab + bLab * bLab);
    let H = Math.atan2(bLab, aLab) * (180 / Math.PI);
    if (H < 0) H += 360;
    if (C < ACHROMATIC_EPS) H = 0;

    return new Oklch(L, C, H, a);
  }

  /**
   * Polar → OKLab → linear → sRGB (with chroma-bisection gamut clamping).
   *
   * [LAW:single-enforcer] All sRGB-gamut clamping for OKLCH happens here.
   * Callers don't see intermediate float channels; they get a valid
   * `ColorRgba` or a thrown error.
   */
  toRgba(): ColorRgba {
    // The normalization boundary the constructor promises: clamp L into [0,1]
    // and C to non-negative here, so out-of-range intermediates (e.g. c = -0.1
    // from a mid-pipeline transform) canonicalize to a valid color rather than
    // flipping hue through a negative chroma. H needs no wrap — the cos/sin in
    // the conversion are periodic. [LAW:single-enforcer]
    const l = clamp01(this.l);
    const c = Math.max(0, this.c);
    const cInGamut = this.findInGamutChroma(l, c, this.h);
    const { r, g, b } = this.toLinearRgb(l, cInGamut, this.h);
    const sR = Math.round(clamp01(linearToSrgb(r)) * 255);
    const sG = Math.round(clamp01(linearToSrgb(g)) * 255);
    const sB = Math.round(clamp01(linearToSrgb(b)) * 255);
    return new ColorRgba(sR, sG, sB, this.alpha);
  }

  /**
   * Apply a `ThemeKey`. Returns a new `Oklch`; pure.
   *
   * [LAW:dataflow-not-control-flow] Identity short-circuits to `this` —
   * same shape as `ColorRgba.compositeOver(bg)` returning `this` when
   * `alpha === 1`. Callers invoke unconditionally; the data decides.
   */
  applyKey(k: ThemeKey): Oklch {
    if (isIdentityKey(k)) return this;
    const newL = clamp01(this.l * k.lightnessScale + k.lightnessShift);
    const newC = Math.max(0, this.c * k.chromaScale);
    let newH = (this.h + k.hueShift) % 360;
    if (newH < 0) newH += 360;
    // Same achromatic convention as fromRgba: collapsed chroma → pinned hue,
    // so applyKey({chromaScale:0}).toRgba() → fromRgba round-trips stably.
    if (newC < ACHROMATIC_EPS) newH = 0;
    return new Oklch(newL, newC, newH, this.alpha);
  }

  /**
   * The color `t` of the way from this one toward `toward`, in OKLCH.
   * `t = 0` is this color, `t = 1` is `toward`; pure.
   *
   * Lightness, chroma and alpha interpolate linearly. Hue takes the shorter
   * arc around the wheel, so blue → red passes through magenta rather than
   * sweeping across green. An achromatic endpoint has no hue of its own —
   * `fromRgba` pins it to 0, which is red — so it adopts the other
   * endpoint's hue (CSS Color 4's "powerless" rule): gray → red stays a red
   * that gains chroma, instead of rotating through the wheel from 0°.
   *
   * [LAW:one-source-of-truth] Achromatic means the same `ACHROMATIC_EPS`
   * that `fromRgba` and `applyKey` pin hue by, so a gray produced by either
   * is a gray here.
   */
  mix(toward: Oklch, t: number): Oklch {
    const thisHasHue = this.c >= ACHROMATIC_EPS;
    const towardHasHue = toward.c >= ACHROMATIC_EPS;
    const fromH = thisHasHue ? this.h : towardHasHue ? toward.h : 0;
    const toH = towardHasHue ? toward.h : fromH;
    const dh = ((((toH - fromH) % 360) + 540) % 360) - 180; // shorter arc, in [-180, 180)
    let h = (fromH + dh * t) % 360;
    if (h < 0) h += 360;
    return new Oklch(
      this.l + (toward.l - this.l) * t,
      this.c + (toward.c - this.c) * t,
      h,
      this.alpha + (toward.alpha - this.alpha) * t,
    );
  }

  /** Linear-sRGB coordinates for an explicit (l, C, h). Pure; `toRgba` passes
   * already-normalized values so this never sees out-of-range inputs. */
  private toLinearRgb(l: number, C: number, h: number): { r: number; g: number; b: number } {
    const hRad = h * (Math.PI / 180);
    const aLab = C * Math.cos(hRad);
    const bLab = C * Math.sin(hRad);

    const lCube = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const mCube = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const sCube = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const lLong = lCube * lCube * lCube;
    const mLong = mCube * mCube * mCube;
    const sLong = sCube * sCube * sCube;

    return {
      r: +4.0767416621 * lLong - 3.3077115913 * mLong + 0.2309699292 * sLong,
      g: -1.2684380046 * lLong + 2.6097574011 * mLong - 0.3413193965 * sLong,
      b: -0.0041960863 * lLong - 0.7034186147 * mLong + 1.7076147010 * sLong,
    };
  }

  /**
   * Largest chroma ≤ `c` whose (l, h) projection lies in sRGB.
   * Standard chroma-reduction-by-bisection: 24 iterations gives ~1e-7
   * precision, more than enough since the next step quantizes to 1/255.
   */
  private findInGamutChroma(l: number, c: number, h: number): number {
    const direct = this.toLinearRgb(l, c, h);
    if (inGamut(direct.r, direct.g, direct.b)) return c;
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const probe = this.toLinearRgb(l, mid, h);
      if (inGamut(probe.r, probe.g, probe.b)) lo = mid;
      else hi = mid;
    }
    return lo;
  }
}
