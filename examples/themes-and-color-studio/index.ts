/**
 * themes-and-color-studio — node bootstrap.
 *
 * Recording is opt-in via the EXPORT_HTML env var. If set, the demo body
 * runs against a recording Console; the bootstrap saves the HTML afterward.
 * The browser bootstrap (wire.ts) is a node-free mirror — no recording, no
 * file save — but the demo body is the same.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { saveHtml } from "../../src/node/save.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();

const htmlExportPath = process.env["EXPORT_HTML"];

try {
  const demo = runDemo(host, { record: Boolean(htmlExportPath) });
  if (htmlExportPath !== undefined && htmlExportPath !== "") {
    saveHtml(demo.out, htmlExportPath);
    process.stderr.write(`\nHTML export written to ${htmlExportPath}\n`);
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
