/**
 * themes-and-color-studio in Node: the tour `main.ts` prints, and, when any of
 * EXPORT_HTML, EXPORT_SVG and EXPORT_TEXT names a file, the recording saved
 * to it — HTML and SVG keep the colour, text keeps only the characters.
 *
 * Saving needs `node/save`, which the card's library leaves out, so it lives
 * here and not in `main.ts`.
 */
import { Console, SVG_EXPORT_THEME } from "@promptctl/rich-js";
import { saveText, saveHtml, saveSvg } from "@promptctl/rich-js/node/save";
import { printTour } from "./tour.js";

// [LAW:dataflow-not-control-flow] The exporters differ only in which
// writer runs, what it is given and what the message says, so they are rows of
// data, not branches. `flatMap` is the parse step: a row survives it only with a
// non-empty path, so the loop below has nothing left to check.
const requestedExports = [
  { label: "HTML", envPath: process.env["EXPORT_HTML"], save: saveHtml, options: {} },
  // Rich's SVG palette, named here because `exportSvg` cannot default to it:
  // `core/` does not import `themes/`.
  { label: "SVG", envPath: process.env["EXPORT_SVG"], save: saveSvg, options: { theme: SVG_EXPORT_THEME } },
  { label: "text", envPath: process.env["EXPORT_TEXT"], save: saveText, options: {} },
].flatMap(({ envPath, ...row }) =>
  envPath === undefined || envPath === "" ? [] : [{ ...row, path: envPath }],
);

const out = new Console({ record: requestedExports.length > 0 });
printTour(out);
for (const { label, path, save, options } of requestedExports) {
  // Every exporter reads the same recording buffer and clears it by
  // default, so each one after the first would write an empty file.
  save(out, path, { ...options, clear: false });
  process.stderr.write(`\n${label} export written to ${path}\n`);
}
