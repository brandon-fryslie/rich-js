/**
 * node:save — node-only file helpers that persist recorded console output.
 *
 * [LAW:locality-or-seam] These functions live outside the main barrel so
 * Console can stop importing `fs`. Importing `Console` itself stays
 * browser-safe; importing this module is the explicit opt-in for the
 * fs-backed surface, and bundlers targeting the browser will (correctly)
 * refuse to resolve `fs` if a consumer ever pulls it in by accident.
 *
 * [LAW:single-enforcer] One funnel per format: `saveText` consumes
 * `Console.exportText()` and `saveHtml` consumes `Console.exportHtml()`.
 * The encoding and recording logic stays on Console; this file is purely
 * the IO sink.
 */

import { writeFileSync } from "node:fs";
import type { Console } from "../core/console.js";

export function saveText(
  console: Console,
  path: string,
  options?: { clear?: boolean },
): void {
  writeFileSync(path, console.exportText(options), "utf-8");
}

export function saveHtml(
  console: Console,
  path: string,
  options?: { clear?: boolean },
): void {
  writeFileSync(path, console.exportHtml(options), "utf-8");
}
