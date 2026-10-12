/**
 * themes-and-color-studio: a printed tour of the colour and theme surface —
 * colour values, the colour system a terminal is detected to have, every
 * bundled theme, palettes and colour references, OKLCH transposition, and
 * WCAG contrast. Each section is one file; edit any and the card prints the
 * tour again.
 *
 * The entry for the demo's card on the docs site. `npm run
 * themes-and-color-studio` runs `node.ts`, the same tour with the option to
 * save it to a file, which a page cannot do.
 */
import { Console } from "@promptctl/rich-js";
import { printTour } from "./tour.js";

printTour(new Console());
