/**
 * themes-and-color-studio — node bootstrap.
 *
 * Recording is opt-in via the EXPORT_HTML and EXPORT_TEXT env vars. If either
 * is set, the demo body runs against a recording Console and the bootstrap
 * saves the recording afterward — HTML keeps the colour, text keeps only the
 * characters. The browser bootstrap (wire.ts) is a node-free mirror — no
 * recording, no file save — but the demo body is the same.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { saveText, saveHtml } from "../../src/node/save.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();

// [LAW:dataflow-not-control-flow] The two exporters differ only in which
// writer runs and what the message says, so they are two rows of data, not two
// branches. `flatMap` is the parse step: a row survives it only with a
// non-empty path, so the loop below has nothing left to check.
const requestedExports = [
  { label: "HTML", envPath: process.env["EXPORT_HTML"], save: saveHtml },
  { label: "text", envPath: process.env["EXPORT_TEXT"], save: saveText },
].flatMap(({ label, envPath, save }) =>
  envPath === undefined || envPath === "" ? [] : [{ label, path: envPath, save }],
);

try {
  const demo = runDemo(host, { record: requestedExports.length > 0 });
  for (const { label, path, save } of requestedExports) {
    // Both exporters read the same recording buffer and clear it by default,
    // so the second of two would write an empty file.
    save(demo.out, path, { clear: false });
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
