/**
 * Section 9: text on a ground — `textOn`, and the fits that decide what text
 * becomes on a ground it does not read on.
 *
 * The grounds are the ones a statusline bar paints: every shade a theme names
 * for its three decorative roles (each seven-rung ladder and its muted form),
 * then `surface` and `panel`. Each row letters all of them in one intent
 * under one fit, so the fits can be compared cell by cell, theme by theme.
 */
import {
  ColorSpec,
  Console,
  contrastFor,
  getThemePalette,
  isTextIntent,
  listThemePalettes,
  named,
  readsOn,
  RichText,
  slide,
  Style,
  TEXT_FITS,
  TEXT_INTENTS,
  textFloor,
  textOn,
  tinted,
  TRUECOLOR,
  type ColorRgba,
  type Palette,
  type TextFit,
  type TextIntent,
} from "@promptctl/rich-js";

import { blank, blurb, dim, sectionHeader } from "./look.js";

const DECORATIVE = ["primary", "secondary", "accent"] as const;
const LADDER = ["-darken-3", "-darken-2", "-darken-1", "", "-lighten-1", "-lighten-2", "-lighten-3", "-muted"] as const;

/** The grounds, in the order a row draws them. */
function grounds(palette: Palette): ColorRgba[] {
  const shades = DECORATIVE.flatMap((role) => LADDER.map((suffix) => palette.get(`${role}${suffix}`)));
  return [...shades, palette.get("surface"), palette.get("panel")];
}

/**
 * A fit of your own is a function: this one ignores the intent's color and
 * draws the most legible text there is, the ground's black or white.
 */
const pole: TextFit = ({ ground }) => contrastFor(ground);

const FITS: ReadonlyArray<readonly [string, TextFit]> = [
  ["slide", slide],
  ["named", named],
  ["tinted", tinted],
  ["pole (yours)", pole],
];

// The intents to compare, spelled as a config would spell them: an accent's
// text, which is what misses on another role's shades. Neutral text rarely
// misses at all; add "text-muted" or any other intent to compare it too.
const COMPARED = "text-error";
const INTENTS: readonly TextIntent[] = COMPARED.split(" ").map((name) => {
  if (!isTextIntent(name)) throw new Error(`${JSON.stringify(name)} is not one of ${TEXT_INTENTS.join(", ")}`);
  return name;
});

const LABEL = 19;

/** One row: `intent` under `fit` on every ground, a cell under its floor ending in a red dot. */
function row(palette: Palette, intent: TextIntent, label: string, fit: TextFit): RichText {
  const line = new RichText().append(label.padEnd(LABEL), "dim");
  for (const ground of grounds(palette)) {
    const text = textOn(palette, intent, ground, { fit, drawnAt: TRUECOLOR });
    const bg = ColorSpec.fromRgba(ground);
    line.append("Aa", Style.fromColor(ColorSpec.fromRgba(text), bg));
    line.append(readsOn(text, ground, textFloor(intent)) ? " " : "•", new Style({ color: "red", bold: true, bgcolor: bg }));
  }
  return line;
}

export function section9TextOn(out: Console): void {
  out.print(sectionHeader(9, "Text on a ground — textOn and its fits"));
  out.print(
    blurb(
      "textOn(palette, intent, ground) is the color a theme's text draws in on " +
        "any background. Text that reads there is drawn as the theme names it; " +
        "text that does not goes to a fit. slide moves its lightness, named takes " +
        "the theme's own nearest shade, tinted runs Textual's text-* recipe on " +
        "that ground. A fit is any function — the last row is one written here.",
    ),
  );
  out.print(dim(`  Grounds: ${DECORATIVE.join(", ")} — each darken-3 … lighten-3 and muted — then surface, panel. A red dot: under the floor.`));
  out.print(dim(`  Fits by name, for a setting that names one: ${Object.keys(TEXT_FITS).join(", ")}.`));
  out.print(blank());
  for (const name of listThemePalettes()) {
    const palette = getThemePalette(name);
    out.print(new RichText(name, { style: "bold" }));
    for (const intent of INTENTS) {
      for (const [fitName, fit] of FITS) {
        out.print(row(palette, intent, `${intent.replace("text-", "")} ${fitName}`, fit));
      }
    }
  }
  out.print(blank());
}
