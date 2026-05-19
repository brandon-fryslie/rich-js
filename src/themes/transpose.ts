/**
 * Transpose a Palette to a new "key" — analogous to transposing a melody.
 *
 *   melody / chord progression  ::  Palette (relationships between colors)
 *                key (signature) ::  ThemeKey (hue / chroma / lightness deltas)
 *      "in C major" / "in D…"   ::  the resulting transposed Palette
 *
 * Because OKLCH is perceptually uniform, "+30° hue" looks like a
 * consistent jump everywhere on the color wheel — the way a perfect-fifth
 * interval sounds the same in every musical key. Transposition is closed
 * under composition: `transpose(transpose(p, k1), k2)` produces the same
 * colors as a single transpose with the combined deltas, modulo round-trip
 * quantization.
 *
 * [LAW:dataflow-not-control-flow] A single uniform per-color transform
 * runs for every var in the palette. Anchor protection selects *which*
 * `ThemeKey` to apply (data), not *whether* to apply one (branch).
 *
 * [LAW:one-source-of-truth] Anchor classification lives only in
 * `ANCHORED_ROOTS` below. The buildPalette derivation guarantees every
 * variant of a semantic root shares the root as its hyphen prefix
 * (`error`, `error-darken-1`, `error-lighten-2`, ...), so one set covers
 * the whole family.
 *
 * [LAW:one-way-deps] Imports flow `core/oklch → themes/transpose`;
 * nothing in core/ depends back on this file.
 */

import type { ColorRgba } from "../core/color.js";
import { Oklch, isIdentityKey, type ThemeKey } from "../core/oklch.js";
import { Palette } from "./palette.js";

/**
 * Semantic roots whose hue is locked under transposition. `error` must
 * look red-ish, `success` green-ish, `warning` amber-ish — rotating the
 * hue would make the UI lie about meaning. Lightness and chroma *still*
 * transform for these roles, so they invert correctly during dark↔light
 * flips and respond to chroma scaling alongside everything else.
 */
export const ANCHORED_ROOTS: ReadonlySet<string> = Object.freeze(
  new Set(["error", "success", "warning"]),
);

function rootOf(varName: string): string {
  const dash = varName.indexOf("-");
  return dash === -1 ? varName : varName.slice(0, dash);
}

/**
 * Whether a palette var's hue is locked under transposition. The single
 * predicate used by `transposePalette`. Exported so callers building
 * higher-level theme machinery can stay consistent with the locking rule.
 */
export function isAnchored(varName: string): boolean {
  return ANCHORED_ROOTS.has(rootOf(varName));
}

/**
 * Return a new `Palette` whose colors are the transposition of `palette`'s
 * by `key`. Pure. Identity (`IDENTITY`) returns a Palette with byte-exact
 * colors — fast-pathed so identity does not pay the sRGB↔OKLCH round-trip
 * quantization cost.
 *
 * The `dark` flag flips when `key.lightnessScale < 0` (negative scale is
 * the L-axis mirror that turns a dark theme into its light octave).
 *
 * @param name Optional override for the resulting palette name. Defaults
 *   to the source palette's name. Callers building a family of transposed
 *   palettes (e.g. "gruvbox +60°") supply their own.
 */
export function transposePalette(
  palette: Palette,
  key: ThemeKey,
  name?: string,
): Palette {
  if (isIdentityKey(key)) {
    return new Palette(name ?? palette.name, palette.dark, palette.vars);
  }
  // Anchors share *everything except* hue with the user's key. They still
  // lightness-invert in a dark↔light flip; they still chroma-scale in a
  // saturation sweep — only their hue is held.
  const anchorKey: ThemeKey = { ...key, hueShift: 0 };
  const next = new Map<string, ColorRgba>();
  for (const [varName, color] of palette.vars) {
    const effective = isAnchored(varName) ? anchorKey : key;
    next.set(varName, Oklch.fromRgba(color).applyKey(effective).toRgba());
  }
  const flippedDark = key.lightnessScale < 0 ? !palette.dark : palette.dark;
  return new Palette(name ?? palette.name, flippedDark, next);
}
