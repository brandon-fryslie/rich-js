/*
 * Refuse to publish a tarball that is missing a file its own package.json points at.
 *
 * 0.18.0 is the recorded instance: CI builds `dist/` in its gate job and hands it
 * to the publish job, but a hand-run `npm publish` from a clean checkout has no
 * build step, so it shipped LICENSE, README and package.json and nothing a
 * consumer could import. npm accepted it, because `files: ["dist"]` names a
 * directory that may be absent.
 *
 * [LAW:one-source-of-truth] Two facts meet here and each has one owner. The
 * files required are the ones package.json declares as entry points (`main`,
 * `types`, every `exports` target), so a new subpath export is covered the moment
 * it is declared. The files present are the ones `npm pack --dry-run` says it
 * would pack — never the disk, because which files land in a tarball is decided
 * by `files`, npm's always-included names and ignore rules, and a check that
 * rebuilt that decision would be a second packer (see test/seam/tarball.ts).
 *
 * [LAW:single-enforcer] It runs on `prepublishOnly` beside
 * `verify-release-tag.mjs`, where both publish roads meet. `npm pack` does not
 * fire `prepublishOnly`, so asking it from inside the hook cannot recurse, and
 * `--ignore-scripts` keeps the listing from running anything else. Plain ESM that
 * imports nothing for the same reason that script is: the publish job has no
 * `node_modules`.
 *
 * WHAT THIS CANNOT SEE. It proves the declared entry points ship, not that they
 * were built from this commit: a laptop `dist/` left by another branch passes.
 * The CI road builds `dist/` from the tagged commit; that is the road releases
 * take.
 *
 * [LAW:no-silent-failure] `main` runs unconditionally, as the sibling guard's
 * does. An "only when invoked directly" test on `process.argv[1]` compares a
 * path the caller spelled with one Node resolved, and through a symlinked
 * checkout they differ — the guard would exit 0 having checked nothing.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every path a consumer can resolve through this manifest, spelled as npm lists
 * packed files (no leading `./`).
 *
 * @param {{ main?: unknown, types?: unknown, exports?: unknown }} manifest
 * @returns {string[]}
 */
function entryPoints(manifest) {
  /** @param {unknown} node @returns {string[]} */
  const targets = (node) =>
    typeof node === "string"
      ? [node]
      : node !== null && typeof node === "object"
        ? Object.values(node).flatMap(targets)
        : [];
  const declared = [manifest.main, manifest.types, ...targets(manifest.exports)].filter(
    /** @returns {p is string} */ (p) => typeof p === "string",
  );
  return [...new Set(declared.map((p) => path.posix.normalize(p)))];
}

/**
 * [LAW:parse-dont-validate] npm's JSON is an interface this repository does not
 * own; a shape it does not recognise is a refusal naming the output, never an
 * empty listing that would read as "every entry point is missing".
 *
 * @param {string} json
 * @returns {Set<string>}
 */
function packedPaths(json) {
  /** @type {unknown} */
  const parsed = JSON.parse(json);
  const files = Array.isArray(parsed) && parsed.length === 1 ? parsed[0]?.files : undefined;
  if (!Array.isArray(files) || !files.every((f) => typeof f?.path === "string")) {
    throw new Error(`unrecognised \`npm pack --dry-run --json\` output: ${json.slice(0, 200)}`);
  }
  return new Set(files.map((f) => f.path));
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const required = entryPoints(manifest);
  const packed = packedPaths(
    execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const missing = required.filter((p) => !packed.has(p));

  // One channel for both verdicts, as the sibling guard: this is diagnostic
  // output, and npm surfaces stderr on success and failure alike.
  process.stderr.write(
    missing.length === 0
      ? `entry-points: all ${required.length} declared entry points are in the tarball\n`
      : `entry-points: refusing to publish — ${missing.length} declared entry point(s) ` +
          `not in the tarball. Run \`npm run build\` first.\n` +
          missing.map((p) => `  ${p}\n`).join(""),
  );
  process.exit(missing.length === 0 ? 0 : 1);
}

main();
