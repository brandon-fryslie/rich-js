/*
 * Refuse to publish a tarball that is missing a file its own package.json points at.
 *
 * 0.18.0 is the recorded instance: CI builds `dist/` in its gate job and hands it
 * to the publish job, but a hand-run `npm publish` from a clean checkout has no
 * build step, so it shipped LICENSE, README and package.json and nothing a
 * consumer could import. npm accepted it, because `files: ["dist"]` names a
 * directory that may be absent.
 *
 * [LAW:one-source-of-truth] The files checked are the ones package.json declares
 * as entry points (`main`, `types`, every `exports` target), so a new subpath
 * export is covered the moment it is declared. [LAW:single-enforcer] It runs on
 * `prepublishOnly` beside `verify-release-tag.mjs`, where both publish roads meet.
 * Plain ESM for the same reason that script is: the publish job has no
 * `node_modules`.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every path a consumer can resolve through this manifest.
 *
 * @param {{ main?: string, types?: string, exports?: unknown }} manifest
 * @returns {string[]}
 */
export function entryPoints(manifest) {
  /** @param {unknown} node @returns {string[]} */
  const targets = (node) =>
    typeof node === "string"
      ? [node]
      : node !== null && typeof node === "object"
        ? Object.values(node).flatMap(targets)
        : [];
  return [manifest.main, manifest.types, ...targets(manifest.exports)].filter(
    /** @returns {p is string} */ (p) => typeof p === "string",
  );
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const missing = entryPoints(manifest).filter((p) => !existsSync(path.join(root, p)));
  if (missing.length > 0) {
    console.error(
      `entry-points: refusing to publish — ${missing.length} declared entry point(s) missing, ` +
        `first ${missing[0]}. Run \`npm run build\` first.`,
    );
    process.exit(1);
  }
  console.log(`entry-points: all ${entryPoints(manifest).length} declared entry points present`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
