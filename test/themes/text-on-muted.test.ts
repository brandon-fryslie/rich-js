/**
 * A palette's `text-*` is the foreground it offers for a `*-muted` ground, and
 * widgets draw it on `background` too, so it reads at WCAG AA (4.5:1) on both
 * in every bundled theme — both the authored palette and what `buildPalette`
 * derives from that palette's eight base colors.
 */
import { describe, it, expect } from "vitest";
import { contrastRatio } from "../../src/core/color.js";
import type { Palette } from "../../src/themes/palette.js";
import { getThemePalette, listThemePalettes } from "../../src/themes/registry.js";
import { derivedFrom } from "./derived-palette.js";

const ACCENTS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;

const palettes: ReadonlyArray<readonly [string, Palette]> = listThemePalettes().flatMap((name) => [
  [`${name} (registry)`, getThemePalette(name)] as const,
  [`${name} (buildPalette)`, derivedFrom(getThemePalette(name))] as const,
]);

describe("text-* on *-muted", () => {
  it.each(palettes.flatMap(([source, palette]) => ACCENTS.map((accent) => ({ source, palette, accent }))))(
    "text-$accent reads on $accent-muted in $source",
    ({ palette, accent }) => {
      expect(contrastRatio(palette.get(`text-${accent}`)!, palette.get(`${accent}-muted`)!)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("text-* on background", () => {
  it.each(palettes.flatMap(([source, palette]) => ACCENTS.map((accent) => ({ source, palette, accent }))))(
    "text-$accent reads on background in $source",
    ({ palette, accent }) => {
      expect(contrastRatio(palette.get(`text-${accent}`)!, palette.get("background")!)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
