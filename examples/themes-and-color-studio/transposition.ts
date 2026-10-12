/** Section 7: a theme moved through OKLCH, light to dark and back. */
import {
  ANCHORED_ROOTS,
  Console,
  getThemePalette,
  IDENTITY,
  INVERT_LIGHTNESS,
  isAnchored,
  isIdentityKey,
  Oklch,
  parseRgbHex,
  RichText,
  themeKeyForRoot,
  transposePalette,
} from "@promptctl/rich-js";

import type { ThemeKey } from "@promptctl/rich-js";

import { bgFgStyle, blank, blurb, bold, sectionHeader, SEMANTIC_VARS } from "./look.js";

// SECTION 7 — OKLCH transposition (themes-as-melodies)
// ===========================================================================

export function section7Transposition(out: Console): void {
  out.print(sectionHeader(7, "OKLCH transposition — themes-as-melodies"));
  out.print(
    blurb(
      "Themes are melodies; ThemeKey is the key signature. Because OKLCH is " +
        "perceptually uniform, +60° hue feels like the same jump everywhere. " +
        "ANCHORED_ROOTS lock the hue of error/success/warning so semantics " +
        "survive transposition.",
    ),
  );
  out.print(blank());

  // Setup: Oklch round-trip + IDENTITY/INVERT_LIGHTNESS shape checks. The
  // labeled sub-demos (7a–7d) start after this intro.
  const sample = parseRgbHex("83a598"); // gruvbox aqua
  const okl = Oklch.fromRgba(sample);
  const back = okl.toRgba();
  out.print(
    new RichText("    Oklch.fromRgba(#83a598) → ")
      .append(`L=${okl.l.toFixed(3)}  C=${okl.c.toFixed(3)}  h=${okl.h.toFixed(1)}°`, "bold")
      .append("   → toRgba → ")
      .append(`${back.hex}`),
  );
  out.print(
    new RichText(`    isIdentityKey(IDENTITY)        = ${isIdentityKey(IDENTITY)}`),
  );
  out.print(
    new RichText(
      `    isIdentityKey(INVERT_LIGHTNESS) = ${isIdentityKey(INVERT_LIGHTNESS)}`,
    ),
  );
  out.print(blank());

  // 7a — Hue circle: rotations of gruvbox at evenly-spaced hue offsets.
  // Same swatchRow shape as section 4 / 6, but the data flowing through
  // is the *transposed* palette.
  const base = getThemePalette("gruvbox");
  const HUE_ROTATIONS = [0, 60, 120, 180, 240, 300];
  out.print(
    bold(`    7a. Hue circle — gruvbox, ${HUE_ROTATIONS.length} rotations`),
  );
  out.print(blurb("Decorative colors rotate; anchored vars (error/success/warning) hold."));
  for (const deg of HUE_ROTATIONS) {
    const key: ThemeKey = {
      hueShift: deg,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    };
    const t = transposePalette(base, key, `gruvbox +${deg}°`);
    const tbg = t.get("background")!;
    const tfg = t.get("foreground")!;
    const row = new RichText("").append(`  +${String(deg).padStart(3)}°  `, bgFgStyle(tbg, tfg, tbg));
    for (const v of SEMANTIC_VARS) {
      const c = t.get(v)!;
      const lock = isAnchored(v) ? "ʟ" : " ";
      row.append(` ${lock}${v.padEnd(8)} `, bgFgStyle(c, tfg, tbg));
    }
    out.print(row);
  }
  out.print(blurb("ʟ = anchored (hue locked by ANCHORED_ROOTS)."));
  out.print(blank());

  // 7b — Chroma sweep on nord. Same dataflow, different ThemeKey axis.
  const nord = getThemePalette("nord");
  const CHROMA_SCALES = [0.3, 0.6, 1.0, 1.3, 1.6];
  out.print(
    bold(`    7b. Chroma sweep — nord, ${CHROMA_SCALES.length} saturation levels`),
  );
  out.print(blurb("chromaScale 0 = grayscale, 1 = identity, >1 = supersaturated."));
  for (const scale of CHROMA_SCALES) {
    const key: ThemeKey = {
      hueShift: 0,
      chromaScale: scale,
      lightnessScale: 1,
      lightnessShift: 0,
    };
    const t = transposePalette(nord, key, `nord ×${scale}`);
    const tbg = t.get("background")!;
    const tfg = t.get("foreground")!;
    const row = new RichText("").append(`  ×${scale.toFixed(1)}  `, bgFgStyle(tbg, tfg, tbg));
    for (const v of SEMANTIC_VARS) {
      const c = t.get(v)!;
      row.append(` ${v.padEnd(9)} `, bgFgStyle(c, tfg, tbg));
    }
    out.print(row);
  }
  out.print(blank());

  // 7c — INVERT_LIGHTNESS: algorithmic light theme from a dark one.
  out.print(bold("    7c. INVERT_LIGHTNESS — algorithmic vs hand-authored light"));
  out.print(
    blurb(
      "Solarized has a hand-authored light variant; algorithm-flipping the " +
        "dark version produces a similar but not identical palette.",
    ),
  );
  const solDark = getThemePalette("solarized-dark");
  const flipped = transposePalette(solDark, INVERT_LIGHTNESS, "solarized-dark↺");
  const solLight = getThemePalette("solarized-light");
  for (const [label, p] of [
    ["solarized-dark   (source)", solDark] as const,
    ["solarized-dark↺  (ALGO)  ", flipped] as const,
    ["solarized-light  (AUTH)  ", solLight] as const,
  ]) {
    const pbg = p.get("background")!;
    const pfg = p.get("foreground")!;
    const row = new RichText("").append(`  ${label}  `, bgFgStyle(pbg, pfg, pbg));
    for (const v of SEMANTIC_VARS) {
      const c = p.get(v)!;
      row.append(` ${v.padEnd(9)} `, bgFgStyle(c, pfg, pbg));
    }
    out.print(row);
  }
  out.print(blank());

  // 7d — themeKeyForRoot: aim a theme's *tonic* at a target hue and watch
  // the rest follow. Anchored vars still keep their hue; everything else
  // shifts by exactly the interval that carries `primary` to 200°.
  out.print(bold("    7d. themeKeyForRoot — aim gruvbox's primary at 200°"));
  const key = themeKeyForRoot(base, "primary", 200);
  const aimed = transposePalette(base, key, "gruvbox→primary@200°");
  const abg = aimed.get("background")!;
  const afg = aimed.get("foreground")!;
  const aimedRow = new RichText("").append(
    `  key.hueShift=${key.hueShift.toFixed(1)}°  `,
    bgFgStyle(abg, afg, abg),
  );
  for (const v of SEMANTIC_VARS) {
    const c = aimed.get(v)!;
    aimedRow.append(` ${v.padEnd(9)} `, bgFgStyle(c, afg, abg));
  }
  out.print(aimedRow);
  out.print(
    blurb(
      `ANCHORED_ROOTS = {${[...ANCHORED_ROOTS].join(", ")}} — these stay put; the rest follow the tonic.`,
    ),
  );
  out.print(blank());
}

