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
// [LAW:types-are-the-program] The `ReadonlySet` type is the immutability
// enforcement — typed code cannot call `add`/`delete`. (`Object.freeze` is
// not used here because it is a no-op on Set membership; relying on it would
// imply a runtime guarantee it does not provide.)
export const ANCHORED_ROOTS: ReadonlySet<string> = new Set([
  "error",
  "success",
  "warning",
]);

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
 * colors by `key`. Pure. Identity (`IDENTITY`) returns a Palette with byte-exact
 * colors — fast-pathed so identity does not pay the sRGB↔OKLCH round-trip
 * quantization cost.
 *
 * The `dark` flag of the result is derived from the actual lightness of
 * the resulting `background` var (`Oklch.fromRgba(bg).l < 0.5`) — *not*
 * from the key's coefficients. The strongest theorem: "dark iff
 * background is dark." This is honest under every transform — pure
 * lightness shifts, mirror-inversions, hue rotations that don't touch L,
 * and combinations of all three. [LAW:types-are-the-program]
 *
 * The transposing path throws if the palette has no `background` var (the
 * `dark`-flag derivation has nothing to read). Failing loudly is preferred
 * over a silent fallback because the alternative — trusting the source
 * `palette.dark` after an arbitrary L-transform — produces flags that lie.
 * The identity fast-path is exempt: it preserves the source `dark` flag
 * verbatim (no derivation), so it needs no `background` and never throws.
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
  const newBackground = next.get("background");
  if (newBackground === undefined) {
    throw new Error(
      `transposePalette: palette "${palette.name}" has no "background" ` +
        `var; cannot derive the dark flag without a background color.`,
    );
  }
  const newDark = Oklch.fromRgba(newBackground).l < 0.5;
  return new Palette(name ?? palette.name, newDark, next);
}

/**
 * Build the `ThemeKey` that rotates `palette` so its *tonic* var lands on
 * `targetHueDeg`. The musical operation directly: a key is the set of
 * intervals from the tonic, so "play this theme in the key of <hue>" means
 * "shift every color by exactly the interval that carries the tonic's
 * current hue to the target." Pick the tonic's pitch and the rest follows.
 *
 * Returns a hue-only key (chroma and lightness untouched). Callers that also
 * want to scale chroma or shift lightness spread their own axes over the
 * result — those are independent transposition dimensions, not part of
 * choosing the key. [LAW:one-type-per-behavior] a degree-shift key and a
 * root-note key are the *same* transform; this is just a second constructor
 * for it, so `transposePalette` stays untouched.
 *
 * Throws if `tonicVar` is absent — the interval has no anchor to measure
 * from, so there is no honest key to return. Failing loudly beats inventing
 * a zero shift that would silently mean "no transposition."
 */
export function themeKeyForRoot(
  palette: Palette,
  tonicVar: string,
  targetHueDeg: number,
): ThemeKey {
  const tonic = palette.get(tonicVar);
  if (tonic === undefined) {
    throw new Error(
      `themeKeyForRoot: palette "${palette.name}" has no "${tonicVar}" var ` +
        `to use as the tonic; cannot measure the transposition interval.`,
    );
  }
  const tonicHue = Oklch.fromRgba(tonic).h;
  let hueShift = (targetHueDeg - tonicHue) % 360;
  if (hueShift < 0) hueShift += 360;
  return { hueShift, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 };
}
