/**
 * Adjust a Palette to a new "key" — analogous to adjusting a melody.
 *
 *   melody / chord progression  ::  Palette (relationships between colors)
 *                key (signature) ::  ColorAdjustment (hue / chroma / lightness deltas)
 *      "in C major" / "in D…"   ::  the resulting adjusted Palette
 *
 * Because OKLCH is perceptually uniform, "+30° hue" looks like a
 * consistent jump everywhere on the color wheel — the way a perfect-fifth
 * interval sounds the same in every musical key. Adjustment is closed
 * under composition: `adjust(adjust(p, k1), k2)` produces the same
 * colors as a single adjust with the combined deltas, modulo round-trip
 * quantization.
 *
 * [LAW:dataflow-not-control-flow] A single uniform per-color transform
 * runs for every var in the palette. Anchor protection selects *which*
 * `ColorAdjustment` to apply (data), not *whether* to apply one (branch).
 *
 * [LAW:one-source-of-truth] Anchor classification lives only in
 * `HUE_LOCKED_ROOTS` below. Every variant of a semantic root carries the root
 * as its first hyphen segment (`error`, `error-darken-1`, `error-muted`, ...)
 * or after a `text-` or `on-` that draws on it (`text-error`, `on-error`), so
 * one set covers the whole family.
 *
 * [LAW:one-way-deps] Imports flow `core/oklch → themes/adjust`;
 * nothing in core/ depends back on this file.
 */

import { Oklch, isIdentityKey, type ColorAdjustment } from "../core/oklch.js";
import { pattern } from "../core/pattern.js";
import { Palette } from "./palette.js";

/**
 * Semantic roots whose hue is locked under adjustment. `error` must
 * look red-ish, `success` green-ish, `warning` amber-ish — rotating the
 * hue would make the UI lie about meaning. Lightness and chroma *still*
 * transform for these roles, so they invert correctly during dark↔light
 * flips and respond to chroma scaling alongside everything else.
 */
// [LAW:types-are-the-program] The `ReadonlySet` type is the immutability
// enforcement — typed code cannot call `add`/`delete`. (`Object.freeze` is
// not used here because it is a no-op on Set membership; relying on it would
// imply a runtime guarantee it does not provide.)
export const HUE_LOCKED_ROOTS: ReadonlySet<string> = new Set([
  "error",
  "success",
  "warning",
]);

const DRAWN_ON = pattern(/^(?:text|on)-/);

function rootOf(varName: string): string {
  const role = varName.replace(DRAWN_ON, "");
  const dash = role.indexOf("-");
  return dash === -1 ? role : role.slice(0, dash);
}

/**
 * Whether a palette var's hue is locked under adjustment. The single
 * predicate used by `adjustPalette`. Exported so callers building
 * higher-level theme machinery can stay consistent with the locking rule.
 */
export function isHueLocked(varName: string): boolean {
  return HUE_LOCKED_ROOTS.has(rootOf(varName));
}

/**
 * Return a new `Palette` whose colors are the adjustment of `palette`'s
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
 * The identity fast-path preserves the source `dark` flag verbatim.
 *
 * @param name Optional override for the resulting palette name. Defaults
 *   to the source palette's name. Callers building a family of adjusted
 *   palettes (e.g. "gruvbox +60°") supply their own.
 */
export function adjustPalette(
  palette: Palette,
  key: ColorAdjustment,
  name?: string,
): Palette {
  if (isIdentityKey(key)) {
    return new Palette(name ?? palette.name, palette.dark, palette.mapRoles((color) => color));
  }
  // Anchors share *everything except* hue with the user's key. They still
  // lightness-invert in a dark↔light flip; they still chroma-scale in a
  // saturation sweep — only their hue is held.
  const anchorKey: ColorAdjustment = { ...key, hueShift: 0 };
  const next = palette.mapRoles((color, role) =>
    Oklch.fromRgba(color).applyKey(isHueLocked(role) ? anchorKey : key).toRgba(),
  );
  const newDark = Oklch.fromRgba(next.background).l < 0.5;
  return new Palette(name ?? palette.name, newDark, next);
}

/**
 * Build the `ColorAdjustment` that rotates `palette` so its *tonic* var lands on
 * `targetHueDeg`. The musical operation directly: a key is the set of
 * intervals from the tonic, so "play this theme in the key of <hue>" means
 * "shift every color by exactly the interval that carries the tonic's
 * current hue to the target." Pick the tonic's pitch and the rest follows.
 *
 * Returns a hue-only key (chroma and lightness untouched). Callers that also
 * want to scale chroma or shift lightness spread their own axes over the
 * result — those are independent adjustment dimensions, not part of
 * choosing the key. [LAW:one-type-per-behavior] a degree-shift key and a
 * root-note key are the *same* transform; this is just a second constructor
 * for it, so `adjustPalette` stays untouched.
 *
 * Throws if `tonicVar` is absent — the interval has no anchor to measure
 * from, so there is no honest key to return. Failing loudly beats inventing
 * a zero shift that would silently mean "no adjustment."
 */
export function adjustmentForRoot(
  palette: Palette,
  tonicVar: string,
  targetHueDeg: number,
): ColorAdjustment {
  // Validate the numeric input at the boundary: a non-finite target would
  // propagate as NaN to Oklch's constructor several calls downstream, where
  // the error is far less actionable.
  if (!Number.isFinite(targetHueDeg)) {
    throw new RangeError(
      `adjustmentForRoot: targetHueDeg must be a finite number; got ${targetHueDeg}`,
    );
  }
  const tonic = palette.get(tonicVar);
  if (tonic === undefined) {
    throw new Error(
      `adjustmentForRoot: palette "${palette.name}" has no "${tonicVar}" var ` +
        `to use as the tonic; cannot measure the adjustment interval.`,
    );
  }
  const tonicHue = Oklch.fromRgba(tonic).h;
  let hueShift = (targetHueDeg - tonicHue) % 360;
  if (hueShift < 0) hueShift += 360;
  return { hueShift, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 };
}
