/*
 * What the published tarball must carry, and what it must not.
 *
 * Epic rich-artifact-c9k found three defects in what `npm pack` actually put in
 * the artifact, none visible from the source tree. No `LICENSE` shipped, though
 * the manifest declared MIT and a port of Rich inherits upstream's
 * notice-retention obligation. About 200 `.map` files shipped too, 1.0 MB of a
 * 1.6 MB unpacked package, and every one was dead: each pointed at `../src/…`,
 * which `package.json#files` does not publish. The fixes are `LICENSE` at the
 * root, which npm packs on its own, the upstream credits in
 * `THIRD-PARTY-NOTICES`, which `files` names, and a `tsconfig.json` that emits
 * no maps. Each of those is one line, in a different file, that a later change
 * can undo without any other test noticing. This rule reads the artifact back.
 *
 * [LAW:one-source-of-truth] The listing comes from npm and from nowhere else.
 * Which files land in a tarball is decided by `files`, by the names npm always
 * includes (`LICENSE*`, `README*`, `package.json`) and by ignore rules that
 * `files` partly overrides; the root `.gitignore` names `dist/`, and `dist/`
 * ships anyway. A rule that rebuilt that decision from `files` would be a
 * second packer, wrong in exactly the cases nobody thought to model, so the
 * test next door asks `npm pack --dry-run --json` and hands the answer here.
 *
 * [LAW:effects-at-boundaries] Nothing in this module builds, packs or reads a
 * file. The test stages the checkout, builds it, packs it and reads the packed
 * bytes; this module is a pure function from those bytes to violations, so the
 * fixtures can hand it tarballs this repository has never produced.
 *
 * "No maps" means two things, and both are checked. The obvious one is a
 * `.map` entry. The other is a `sourceMappingURL` comment in a packed file
 * with no map beside it, which is what excluding `*.map` from `files` would
 * produce: every `.js` and `.d.ts` would point a debugger at a file absent from
 * `node_modules`, the same dead reference as before in a smaller tarball.
 * c9k.2 rejected that fix on those grounds, so a rule that counted `.map`
 * entries alone would pass it.
 *
 * There is no size bound, though the ticket that asked for this gate offered
 * one. Size stands in for the decision rather than stating it: the decision is
 * zero maps, and a byte ceiling fires on a legitimate new renderable while
 * passing a map that happens to be small.
 *
 * WHAT THIS CANNOT SEE. The tarball checked is the one this checkout's own
 * `npm run build` produces, in a clean copy. What reaches the registry is built
 * elsewhere. On the CI road `publish.yml`'s gate job builds it, with the same
 * script, from a tagged commit this gate ran on, so it should come out the
 * same. On the laptop road nothing stops someone packing a `dist/` built some
 * other way. Either way the tarball that ships is not the one this gate read.
 * Nor does it say a licence is the right
 * one, only that the two files ship and are not empty; their contents are
 * c9k.1's decision, recorded there.
 */

/** The files the artifact must carry, by the name npm packs them under. */
export const REQUIRED_FILES = ["LICENSE", "THIRD-PARTY-NOTICES"] as const;

export type RequiredFile = (typeof REQUIRED_FILES)[number];

/** One entry of the tarball, with the bytes it would carry. */
export interface PackedFile {
  /** Relative to the package root, as npm lists it: `dist/index.js`. */
  readonly path: string;
  readonly contents: string;
}

export type TarballViolation =
  | { readonly kind: "missing"; readonly path: RequiredFile }
  | { readonly kind: "empty"; readonly path: RequiredFile }
  | { readonly kind: "source-map"; readonly path: string }
  | { readonly kind: "map-reference"; readonly path: string };

/**
 * The paths `npm pack --dry-run --json` says it would pack.
 *
 * [LAW:parse-dont-validate] npm's JSON is an interface this repository does not
 * own. Its shape is checked here, where it is read, so that a different npm
 * fails with a message naming the output instead of an empty listing that reads
 * as "every required file is missing".
 */
export function parsePackListing(json: string): readonly string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(`npm pack --json: expected one package, got ${json.slice(0, 200)}`);
  }
  const [pkg] = parsed as unknown[];
  const files = (pkg as { files?: unknown }).files;
  if (!Array.isArray(files)) {
    throw new Error(`npm pack --json: no files array in ${json.slice(0, 200)}`);
  }
  return files.map((entry: unknown) => {
    const filePath = (entry as { path?: unknown }).path;
    if (typeof filePath !== "string") {
      throw new Error(`npm pack --json: file entry without a path: ${JSON.stringify(entry)}`);
    }
    return filePath;
  });
}

// tsc writes `//# sourceMappingURL=` and older tools wrote `//@`; either one
// points a debugger at a file.
const MAP_REFERENCE = /[#@] sourceMappingURL=/;

export function tarballViolations(files: readonly PackedFile[]): TarballViolation[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const required = REQUIRED_FILES.flatMap((path): TarballViolation[] => {
    const file = byPath.get(path);
    if (file === undefined) return [{ kind: "missing", path }];
    return file.contents.trim() === "" ? [{ kind: "empty", path }] : [];
  });
  const maps = files.flatMap((file): TarballViolation[] => [
    ...(file.path.endsWith(".map") ? [{ kind: "source-map", path: file.path } as const] : []),
    ...(MAP_REFERENCE.test(file.contents) ? [{ kind: "map-reference", path: file.path } as const] : []),
  ]);
  return [...required, ...maps];
}

export function describeViolation(violation: TarballViolation): string {
  switch (violation.kind) {
    case "missing":
      return `${violation.path} is not in the tarball`;
    case "empty":
      return `${violation.path} is in the tarball but empty`;
    case "source-map":
      return `${violation.path} is a source map, and the tarball ships none`;
    case "map-reference":
      return `${violation.path} carries a sourceMappingURL, and the tarball ships no map for it`;
  }
}
