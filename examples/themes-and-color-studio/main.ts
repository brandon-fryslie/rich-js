/**
 * themes-and-color-studio: a printed tour of the color and theme surface —
 * color values, the color system a terminal is detected to have, every
 * bundled theme, palettes and color references, OKLCH adjustment, and
 * WCAG contrast. The sections are split across four files; edit any and the
 * card prints the tour again.
 *
 * The entry for the demo's card on the docs site. `npm run
 * themes-and-color-studio` runs `node.ts`, the same tour with the option to
 * save it to a file, which a page cannot do.
 */
import { Console } from "@promptctl/rich-js";
import { printTour } from "./tour.js";

printTour(new Console());
