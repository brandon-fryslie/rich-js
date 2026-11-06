/**
 * The tour: a title, then nine sections in order, printed through `out`.
 *
 * Section order is data, not control flow: `SECTIONS` is the order, and the
 * same print runs each one. Whoever calls it decides where `out` writes, so
 * the card and `npm run` print the same tour. [LAW:dataflow-not-control-flow]
 */
import { Console, RichText } from "@promptctl/rich-js";
import { blank, dim } from "./look.js";
import { section1ColorValues, section2ColorSpec, section3ColorSystem } from "./values.js";
import { section4ThemeRegistry, section5ColorRefs, section6TerminalThemes } from "./themes.js";
import { section7Transposition } from "./adjustment.js";
import { section8Contrast } from "./contrast.js";
import { section9TextOn } from "./text-on.js";

const SECTIONS: ReadonlyArray<(out: Console) => void> = [
  section1ColorValues,
  section2ColorSpec,
  section3ColorSystem,
  section4ThemeRegistry,
  section5ColorRefs,
  section6TerminalThemes,
  section7Transposition,
  section8Contrast,
  section9TextOn,
];

export function printTour(out: Console): void {
  out.print(
    new RichText("themes-and-color-studio", { style: "bold" }).append(
      "  ·  printed reference for the Themes & Color surface",
      "dim",
    ),
  );
  out.print(
    dim(
      "Nine sections. Color values → ColorSpec → system detection → registry → " +
        "color references → terminal themes → OKLCH adjustment → WCAG contrast → text on a ground.",
    ),
  );
  out.print(blank());
  for (const section of SECTIONS) section(out);
}
