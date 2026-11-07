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
  readsOn,
  RichText,
  Style,
  TEXT_FITS,
  TEXT_INTENTS,
  floorOn,
  textOn,
  DRAWN_AT_TRUECOLOR,
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

const FITS: ReadonlyArray<readonly [string, TextFit]> = [...Object.entries(TEXT_FITS), ["pole (yours)", pole]];

/**
 * The intents to compare, as a setting spells them: space-separated names,
 * each parsed against the one list. An accent's text is the default, since it
 * is what misses on another role's shades; neutral text rarely misses at all.
 * `npm run themes-and-color-studio` reads `TEXT_ON_INTENTS`.
 */
export function comparedIntents(setting = "text-error"): readonly TextIntent[] {
  const names = setting.split(/\s+/).filter((name) => name !== "");
  if (names.length === 0) throw new Error(`TEXT_ON_INTENTS: ${JSON.stringify(setting)} names no intent; name one or more of ${TEXT_INTENTS.join(", ")}`);
  return names.map((name) => {
    if (!isTextIntent(name)) throw new Error(`TEXT_ON_INTENTS: ${JSON.stringify(name)} is not one of ${TEXT_INTENTS.join(", ")}`);
    return name;
  });
}

const LABEL = 19;

/** One row: `intent` under `fit` on every ground, a cell under its floor ending in a red dot. */
function row(palette: Palette, intent: TextIntent, label: string, fit: TextFit): RichText {
  const line = new RichText().append(label.padEnd(LABEL), "dim");
  for (const ground of grounds(palette)) {
    const text = textOn(palette, intent, ground, { fit, drawnAt: DRAWN_AT_TRUECOLOR });
    const bg = ColorSpec.fromRgba(ground);
    line.append("Aa", Style.fromColor(ColorSpec.fromRgba(text), bg));
    line.append(readsOn(text, ground, floorOn(intent, palette.get("foreground"), ground)) ? " " : "•", new Style({ color: "red", bold: true, bgcolor: bg }));
  }
  return line;
}

export function section9TextOn(out: Console, intents: readonly TextIntent[] = comparedIntents()): void {
  out.print(sectionHeader(9, "Text on a ground — textOn and its fits"));
  out.print(
    blurb(
      "textOn(palette, intent, ground) is the color a theme's text draws in on " +
        "any background. Text that reads there is drawn as the theme names it; " +
        "text that does not goes to a fit. slide moves its lightness, named takes " +
        "the theme's own nearest shade, tinted runs Textual's text-* recipe on " +
        "that ground, asIs leaves it as stated — contrast checking off. A fit is any function — the last row is one written here.",
    ),
  );
  out.print(dim(`  Grounds: ${DECORATIVE.join(", ")} — each darken-3 … lighten-3 and muted — then surface, panel. A red dot: under the floor.`));
  out.print(blank());
  for (const name of listThemePalettes()) {
    const palette = getThemePalette(name);
    out.print(new RichText(name, { style: "bold" }));
    for (const intent of intents) {
      for (const [fitName, fit] of FITS) {
        out.print(row(palette, intent, `${intent.replace("text-", "")} ${fitName}`, fit));
      }
    }
  }
  out.print(blank());
}
