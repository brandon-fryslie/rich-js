/**
 * rich-themes-transposed — visual fixture for OKLCH theme transposition.
 *
 * Treats a theme as a melody and a `ThemeKey` as a key signature. Walks
 * three transformations, each making one mathematical property visible:
 *
 *   1. Hue circle.  One source theme, six rotations (0°, 60°, …, 300°).
 *      Shows perceptual-uniform hue rotation: each step feels like an
 *      equal jump because we're operating in OKLCH, not HSL.
 *
 *   2. Chroma sweep. One source theme, five chroma scales (0.3 … 1.6).
 *      Muted → vivid spectrum without touching hue or lightness.
 *
 *   3. Algorithmic invert vs. human-authored. Solarized-dark transposed
 *      by `INVERT_LIGHTNESS` against the hand-authored solarized-light.
 *      Reveals the gap between "pure L flip" and a designer's polish.
 *
 * In every section, the semantic anchors (error / success / warning) keep
 * their hue — visible proof that `ANCHORED_ROOTS` does its job.
 *
 * Non-interactive — `npm run themes:transposed`.
 */

import {
  ColorRgba,
  Console,
  IDENTITY,
  INVERT_LIGHTNESS,
  Palette,
  RichText,
  Style,
  getThemePalette,
  transposePalette,
  type ThemeKey,
} from "../../src/index.js";

const out = new Console({ forceTerminal: true });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Terminals don't render alpha; flatten any translucent color over the
// theme's bg, then flatten fg over that, before emitting via Style.
// compositeOver short-circuits at alpha=1 (the typical case) so this is
// effectively free for opaque inputs. [LAW:dataflow-not-control-flow].
function bgFgStyle(bg: ColorRgba, fg: ColorRgba, substrate: ColorRgba): Style {
  const flatBg = bg.compositeOver(substrate);
  const flatFg = fg.compositeOver(flatBg);
  return Style.parse(`${flatFg.hex} on ${flatBg.hex}`);
}

const SWATCH_VARS = [
  "primary",
  "accent",
  "secondary",
  "error",
  "success",
  "warning",
] as const;

function swatchRow(palette: Palette, label: string): RichText {
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;
  const row = new RichText("");
  // Label cell — fixed width so rows align in the scrollback.
  row.append(`  ${label.padEnd(20)}`, bgFgStyle(bg, fg, bg));
  for (const name of SWATCH_VARS) {
    const c = palette.get(name);
    if (!c) {
      row.append(`  ${name} ∅`, "dim");
      continue;
    }
    // Use the swatch color as the bg of its own cell — the most direct
    // way to see hue + lightness + chroma at a glance.
    row.append(` ${name.padEnd(9)} `, bgFgStyle(c, fg, bg));
  }
  return row;
}

function sectionHeader(text: string): RichText {
  return new RichText(text, { style: "bold underline" });
}

function blank(): RichText {
  return new RichText("");
}

// ---------------------------------------------------------------------------
// Section 1: Hue circle
// ---------------------------------------------------------------------------

function section1HueCircle(): void {
  out.print(sectionHeader("1. Hue circle — gruvbox, six rotations"));
  out.print(new RichText(
    "    Each step shifts hue by 60° in OKLCH. Decorative colors rotate; " +
    "error/success/warning hold (anchored).",
    { style: "dim" },
  ));
  out.print(blank());

  const base = getThemePalette("gruvbox")!;
  const rotations = [0, 60, 120, 180, 240, 300];
  for (const deg of rotations) {
    const key: ThemeKey = {
      hueShift: deg,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    };
    const transposed = transposePalette(base, key, `gruvbox +${deg}°`);
    out.print(swatchRow(transposed, `gruvbox  hue +${String(deg).padStart(3)}°`));
  }
  out.print(blank());
}

// ---------------------------------------------------------------------------
// Section 2: Chroma sweep
// ---------------------------------------------------------------------------

function section2ChromaSweep(): void {
  out.print(sectionHeader("2. Chroma sweep — nord, five saturation levels"));
  out.print(new RichText(
    "    chromaScale 0 = grayscale, 1 = identity, >1 = more saturated " +
    "(may clamp at sRGB gamut boundary).",
    { style: "dim" },
  ));
  out.print(blank());

  const base = getThemePalette("nord")!;
  const scales = [0.3, 0.6, 1.0, 1.3, 1.6];
  for (const scale of scales) {
    const key: ThemeKey = {
      hueShift: 0,
      chromaScale: scale,
      lightnessScale: 1,
      lightnessShift: 0,
    };
    const transposed = transposePalette(base, key, `nord ×${scale}`);
    out.print(swatchRow(transposed, `nord     chroma ×${scale.toFixed(1)}`));
  }
  out.print(blank());
}

// ---------------------------------------------------------------------------
// Section 3: Algorithmic invert vs. authored
// ---------------------------------------------------------------------------

function section3InversionVsAuthored(): void {
  out.print(sectionHeader("3. Algorithmic invert vs. hand-authored"));
  out.print(new RichText(
    "    Mathematical L→1-L vs. a designer's polish. The algorithm is " +
    "honest; the human is brighter.",
    { style: "dim" },
  ));
  out.print(blank());

  const dark = getThemePalette("solarized-dark")!;
  const flipped = transposePalette(dark, INVERT_LIGHTNESS, "solarized-dark↺");
  const authored = getThemePalette("solarized-light")!;

  out.print(swatchRow(dark,     "solarized-dark   (source)"));
  out.print(swatchRow(flipped,  "solarized-dark↺  (ALGO)"));
  out.print(swatchRow(authored, "solarized-light  (AUTH)"));
  out.print(blank());

  // Same exercise on gruvbox — gruvbox has no authored light variant,
  // so this is the *generative* use case: get a light theme for free.
  const gruv = getThemePalette("gruvbox")!;
  const gruvLight = transposePalette(gruv, INVERT_LIGHTNESS, "gruvbox-light");
  out.print(swatchRow(gruv,      "gruvbox          (source)"));
  out.print(swatchRow(gruvLight, "gruvbox-light    (ALGO, no AUTH exists)"));
  out.print(blank());
}

// ---------------------------------------------------------------------------
// Identity sanity check — proof that IDENTITY is byte-exact, not lossy
// ---------------------------------------------------------------------------

function sanityIdentity(): void {
  const gruv = getThemePalette("gruvbox")!;
  const ident = transposePalette(gruv, IDENTITY);
  const drift = [...gruv.vars].some(([k, src]) => {
    const dst = ident.get(k)!;
    return dst.red !== src.red || dst.green !== src.green || dst.blue !== src.blue;
  });
  out.print(new RichText(
    drift
      ? "✗ IDENTITY drifted a channel — bug in transposePalette fast-path"
      : "✓ IDENTITY transpose is byte-exact across all gruvbox vars",
    { style: drift ? "bold red" : "green" },
  ));
}

function main(): void {
  out.print(new RichText(
    "rich-themes-transposed — OKLCH theme transposition demo",
    { style: "bold" },
  ));
  out.print(new RichText(
    "Themes-as-melodies. ThemeKey is the key signature. OKLCH is the " +
    "perceptually-uniform pitch space that makes rotation feel even.",
    { style: "dim" },
  ));
  out.print(blank());

  section1HueCircle();
  section2ChromaSweep();
  section3InversionVsAuthored();
  sanityIdentity();
}

try {
  main();
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
