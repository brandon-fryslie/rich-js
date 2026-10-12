/** Section 8: the WCAG contrast toolkit. */
import {
  ColorDepth,
  ColorRgba,
  ColorSpec,
  Console,
  contrastFor,
  contrastRatio,
  darken,
  drawnColour,
  ensureContrast,
  ensureDrawn,
  getThemePalette,
  lighten,
  Oklch,
  parseRgbHex,
  relativeLuminance,
  RichText,
  Style,
} from "@promptctl/rich-js";

import { bgFgStyle, blank, blurb, bold, dim, sectionHeader, SEMANTIC_VARS } from "./look.js";

// ===========================================================================
// SECTION 8 — WCAG contrast toolkit
// ===========================================================================

export function section8Contrast(out: Console): void {
  out.print(sectionHeader(8, "WCAG contrast — relativeLuminance, contrastRatio, ensureContrast"));
  out.print(
    blurb(
      "relativeLuminance is the WCAG luminance of one color; contrastRatio " +
        "is the ratio between two (1:1 to 21:1). contrastFor picks black or " +
        "white. ensureContrast slides a color's OKLCH lightness until the " +
        "ratio is met — keeping its hue so themed text still looks themed.",
    ),
  );
  out.print(blank());

  // Relative luminance of a few well-known points.
  const black = new ColorRgba(0, 0, 0);
  const white = new ColorRgba(255, 255, 255);
  const mid = parseRgbHex("808080");
  out.print(
    dim(
      `    relativeLuminance: black=${relativeLuminance(black).toFixed(4)}, ` +
        `#808080=${relativeLuminance(mid).toFixed(4)}, ` +
        `white=${relativeLuminance(white).toFixed(4)}`,
    ),
  );
  out.print(
    dim(
      `    contrastRatio(black, white) = ${contrastRatio(black, white).toFixed(2)}:1   (the maximum)`,
    ),
  );
  out.print(blank());

  // A contrast matrix on gruvbox: for each semantic var, the ratio against
  // background. WCAG AA body text wants ≥ 4.5; AA large text wants ≥ 3.
  const palette = getThemePalette("gruvbox");
  const bg = palette.get("background")!;
  out.print(bold("    Contrast on gruvbox background (each semantic var → bg):"));
  for (const v of SEMANTIC_VARS) {
    const c = palette.get(v)!;
    const ratio = contrastRatio(c, bg);
    const aa = ratio >= 4.5 ? "AA body ✓" : ratio >= 3 ? "AA large ✓" : "fails AA ✗";
    out.print(
      new RichText(`      ${v.padEnd(10)} `)
        .append(`  ${c.hex}  `, bgFgStyle(c, palette.get("foreground")!, bg))
        .append(`  ratio ${ratio.toFixed(2).padStart(5)}:1  ${aa}`),
    );
  }
  out.print(blank());

  // contrastFor: pick the WCAG-correct black/white pair for "text on this bg".
  // This is the single source of truth buildPalette uses for `on-*` vars.
  out.print(bold("    contrastFor(bg) — picks black or white for text-on-bg:"));
  for (const v of ["primary", "warning", "error", "success"] as const) {
    const c = palette.get(v)!;
    const onColor = contrastFor(c);
    out.print(
      new RichText(`      on ${v.padEnd(8)} `)
        .append(`   Aa contrast text   `, Style.parse(`${onColor.hex} on ${c.hex}`)),
    );
  }
  out.print(blank());

  // ensureContrast: keep hue, just slide L. Deliberately bad cases: a
  // bright yellow on white (low contrast at full saturation), and a pale
  // pink on a light cream bg. After ensureContrast each row is guaranteed
  // legible at ratio ≥ 4.5 — and the hue is preserved, so it still looks
  // yellow and pink respectively.
  out.print(bold("    ensureContrast — keep hue, slide lightness until ≥ 4.5:1"));
  const hardCases: Array<{ label: string; fg: ColorRgba; lightBg: ColorRgba }> = [
    { label: "bright yellow on white ", fg: parseRgbHex("ffc107"), lightBg: white },
    { label: "pale pink on cream     ", fg: parseRgbHex("f8b4d9"), lightBg: parseRgbHex("fdf6e3") },
    { label: "light teal on white    ", fg: parseRgbHex("5fd2c2"), lightBg: white },
  ];
  for (const { label, fg: rawFg, lightBg } of hardCases) {
    const fixed = ensureContrast(rawFg, lightBg, 4.5);
    out.print(
      new RichText(`      before  ${label}  `)
        .append("  Aa text  ", Style.parse(`${rawFg.hex} on ${lightBg.hex}`))
        .append(`   ratio ${contrastRatio(rawFg, lightBg).toFixed(2)}:1`),
    );
    out.print(
      new RichText(`      after   ${label}  `)
        .append("  Aa text  ", Style.parse(`${fixed.hex} on ${lightBg.hex}`))
        .append(`   ratio ${contrastRatio(fixed, lightBg).toFixed(2)}:1   (${fixed.hex})`),
    );
  }
  out.print(blank());

  // ensureDrawn: a floor that is not text. A green selected cell beside a
  // blue one is far apart in truecolor, but 256 colours round both to one
  // cube entry and the selection disappears. ensureDrawn keeps the chosen
  // colour when its rounding holds the floor, and otherwise hands back the
  // nearest entry that does.
  out.print(bold("    ensureDrawn — a selection that must stay distinct once drawn at 256"));
  const neighbour = parseRgbHex("003070");
  const selected = parseRgbHex("107030");
  // drawnColour: the colour a ground is shown as at a depth — the rounding
  // ensureDrawn hands its predicate as `drawn`.
  const at256 = (c: ColorRgba) => ColorSpec.fromRgba(drawnColour(c, ColorDepth.EIGHT_BIT)).downgrade(ColorDepth.EIGHT_BIT);
  const kept = ensureDrawn(selected, ColorDepth.EIGHT_BIT, (candidate, drawn) =>
    Oklch.fromRgba(candidate).deltaE(Oklch.fromRgba(drawn(neighbour))) >= 0.1,
  );
  // No entry at all may hold a floor; a real caller says so rather than
  // drawing the colour it refused.
  if (kept === undefined) throw new Error("no 256-colour entry holds the selection floor");
  for (const [label, cell] of [["before", selected], ["after ", kept]] as const) {
    out.print(
      new RichText(`      ${label}  `)
        .append("  selected  ", Style.parse(`#ffffff on ${cell.hex}`))
        .append("  neighbour  ", Style.parse(`#ffffff on ${neighbour.hex}`))
        .append(`   at 256: color(${at256(cell).number}) beside color(${at256(neighbour).number})`),
    );
  }
  out.print(blank());

  // lighten / darken: slide a color's HSL lightness by whole levels (≈10% each),
  // relative to the color itself — the transform a consumer reaches for to tint a
  // resolved surface against itself (e.g. a focused/active cell a step above its
  // own background) without re-deriving from a palette name.
  out.print(bold("    lighten / darken — relative ±lightness levels of a base color:"));
  const baseTint = palette.get("primary")!;
  for (const levels of [2, 1, 0, -1, -2] as const) {
    const shifted =
      levels === 0 ? baseTint : levels > 0 ? lighten(baseTint, levels) : darken(baseTint, -levels);
    const label =
      levels === 0 ? "base      " : levels > 0 ? `lighten +${levels}` : `darken  ${-levels}`;
    out.print(
      new RichText(`      ${label}  `)
        .append(`   ${shifted.hex}   `, Style.parse(`${contrastFor(shifted).hex} on ${shifted.hex}`)),
    );
  }
  out.print(blank());
}

