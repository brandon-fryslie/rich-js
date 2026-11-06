/**
 * The grounds Textual promises a theme's fixed text reads on: `background`,
 * `surface` and `panel`, and for `text-*` its own `*-muted` too. Every bundled
 * theme holds `text-*` there at WCAG AA (4.5:1) and `foreground-muted` at
 * AA-large (3:1) — both the authored palette and what `buildPalette` derives
 * from that palette's eight base colors.
 *
 * `foreground` is authored and Textual does not move it, so it is not held
 * here; on any ground, `textOn` is what draws it legibly.
 */
import { describe, it, expect } from "vitest";
import { contrastRatio } from "../../src/core/color.js";
import type { Palette } from "../../src/themes/palette.js";
import { getThemePalette, listThemePalettes } from "../../src/themes/registry.js";
import { derivedFrom } from "./derived-palette.js";

const ACCENTS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
const GROUNDS = ["background", "surface", "panel"] as const;

const palettes: ReadonlyArray<readonly [string, Palette]> = listThemePalettes().flatMap((name) => [
  [`${name} (registry)`, getThemePalette(name)] as const,
  [`${name} (buildPalette)`, derivedFrom(getThemePalette(name))] as const,
]);

describe("text-* on the grounds Textual promises it", () => {
  const cases = palettes.flatMap(([source, palette]) =>
    ACCENTS.flatMap((accent) => [...GROUNDS, `${accent}-muted` as const].map((ground) => ({ source, palette, accent, ground }))),
  );
  it.each(cases)("text-$accent reads on $ground in $source", ({ palette, accent, ground }) => {
    expect(contrastRatio(palette.get(`text-${accent}`), palette.get(ground))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("foreground-muted on the three grounds", () => {
  const cases = palettes.flatMap(([source, palette]) => GROUNDS.map((ground) => ({ source, palette, ground })));
  it.each(cases)("foreground-muted recedes no further than 3:1 on $ground in $source", ({ palette, ground }) => {
    expect(contrastRatio(palette.get("foreground-muted"), palette.get(ground))).toBeGreaterThanOrEqual(3);
  });
});
