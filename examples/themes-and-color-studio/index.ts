/**
 * themes-and-color-studio — node bootstrap.
 *
 * Recording is opt-in via the EXPORT_HTML, EXPORT_SVG and EXPORT_TEXT env
 * vars. If any is set, the demo body runs against a recording Console and the
 * bootstrap saves the recording afterward — HTML and SVG keep the colour, text
 * keeps only the characters. The browser bootstrap (wire.ts) is a node-free
 * mirror — no recording, no file save — but the demo body is the same.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { saveText, saveHtml, saveSvg } from "../../src/node/save.js";
import { SVG_EXPORT_THEME } from "../../src/index.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();

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

try {
  const demo = runDemo(host, { record: requestedExports.length > 0 });
  for (const { label, path, save, options } of requestedExports) {
    // Every exporter reads the same recording buffer and clears it by
    // default, so each one after the first would write an empty file.
    save(demo.out, path, { ...options, clear: false });
    process.stderr.write(`\n${label} export written to ${path}\n`);
  }
  demo.stop();
} catch (err) {
  // [LAW:dataflow-not-control-flow] Set process.exitCode (a value) instead
  // of calling process.exit (a control-flow jump that bypasses finally).
  // The finally block must run host.stop() either way.
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
} finally {
  host.stop();
}
