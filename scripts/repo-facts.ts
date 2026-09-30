/**
 * What this repository says about itself: where it is and how a path inside
 * it is spelled, what its package manifest promises, which source file each published entry point is, and the
 * compiler options its build runs under.
 *
 * [LAW:one-way-deps] The docs build and the test suite both read these, so
 * they live beside neither. When they sat in the coverage verifier, the
 * published site's build depended on a test module, and a refactor of that
 * verifier could change how the docs' examples compile.
 */

import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Whether an entry module sits behind the `src/node/` airlock. An entry there is
 * the consumer's explicit opt-in to Node; every other entry promises a browser
 * nothing of Node's, at runtime and in its declarations.
 *
 * [LAW:one-source-of-truth] The browser-safe and browser-types gates both draw
 * the line here, so a move of the airlock moves it for both.
 */
export function isBehindNodeAirlock(sourcePath: string): boolean {
  return sourcePath.startsWith("src/node/");
}

export function isUnderSrc(absPath: string): boolean {
  return isPathInside(path.join(REPO_ROOT, "src"), absPath);
}

/**
 * An absolute path in the one repo-relative spelling the suite compares on.
 *
 * [LAW:single-enforcer] The single crossing where an OS path becomes a
 * canonical one, because the alternative is normalizing at each comparison
 * and forgetting the next one. `path.relative` returns native separators, so
 * on Windows `src\core\console.ts` never equals the `"src/core/console.ts"`
 * a rule was written against — and equality failing silently is the worst
 * available failure: the layering gate would report its two sanctioned edges
 * as both unsanctioned and stale, accusing untouched code of precisely what
 * the gate exists to catch.
 */
export function repoRelative(absPath: string): string {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

/**
 * Whether `target` lives strictly inside `root`.
 *
 * [LAW:one-source-of-truth] The one home for this comparison, because it is
 * short enough to retype and wrong in a way that fails silently. Compare with
 * `path.relative` rather than `startsWith` on raw strings: `src/core-utils`
 * begins with `src/core`, so a prefix test reads a sibling directory as
 * inside and reports nothing about it ever again. `path.relative` also
 * normalizes separator format, which a raw comparison does not.
 *
 * The comparison is lexical: it never reads the filesystem, so a symlink and
 * its target read as unrelated paths. Every caller derives both
 * arguments from `REPO_ROOT`, which is what makes that safe — a future caller
 * holding paths from two sources has to resolve them before asking.
 *
 * Both arguments must also be the same kind of path — both absolute, or both
 * relative to the same base. Callers work in different spaces (`isUnderSrc`
 * in absolute paths, the layering rule in repo-relative ones) and each is
 * internally consistent.
 */
export function isPathInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");

/**
 * The fields of `package.json` any reader of `PACKAGE_MANIFEST` reads.
 *
 * Almost all of it is the published surface — what a consumer's installer and
 * resolver act on. `scripts` is the exception, and the line to hold is that it
 * describes the maintainer's publish rather than the install: read it for what
 * `npm publish` runs, never to conclude anything a consumer would experience.
 *
 * `devDependencies` is deliberately absent, and its absence
 * is the point: it describes this checkout, not the package, so a rule that
 * consulted it would call a dependency satisfied because *we* happen to have
 * it installed. That is the exact blindness `test/seam/optional-peers.ts`
 * exists to remove.
 */
export interface PackageManifest {
  readonly name?: string;
  readonly exports?: Readonly<Record<string, string | { import?: string }>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta?: Readonly<Record<string, { optional?: boolean }>>;
  readonly engines?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly repository?: { readonly type: string; readonly url: string };
}

/**
 * [LAW:one-source-of-truth] One parse of the manifest, at load time.
 * The entry-module derivation reads it, and so does every rule that asks
 * what the package promises a consumer; a second `readFileSync` would be a
 * second reading of a file that is already the authority.
 */
export const PACKAGE_MANIFEST: PackageManifest = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf-8"),
) as PackageManifest;

// [LAW:one-source-of-truth] The public entry-module set is derived from
// the `exports` field of `package.json` at load time — never a
// hand-maintained list. Each subpath export's `import` target is a
// `./dist/X.js` path, which the repo's tsconfig (rootDir: src, outDir:
// dist) deterministically pairs with `src/X.ts`. We invert that pairing
// here and assert each derived source file exists; a missing file
// fails the load loudly rather than silently dropping a public surface
// from every check that walks it.
/**
 * The published import specifier of each entry module, paired with the source
 * file it resolves to — `@promptctl/rich-js` -> `src/index.ts`,
 * `@promptctl/rich-js/widgets` -> `src/widgets/index.ts`.
 *
 * [LAW:one-source-of-truth] `ENTRY_MODULES` is the values of this map. The
 * specifier is what a *reader* of the docs types; the source path is what the
 * verifier resolves symbols in. Both fall out of one walk of `package.json`,
 * so a new subpath export cannot reach one view and miss the other.
 */
export const ENTRY_BY_SPECIFIER: ReadonlyMap<string, string> =
  deriveEntryModules(PACKAGE_MANIFEST);

export const ENTRY_MODULES: readonly string[] = Object.freeze([
  ...new Set(ENTRY_BY_SPECIFIER.values()),
]);

/**
 * [LAW:no-ambient-temporal-coupling] The manifest arrives as an argument
 * rather than being read off module scope. Both are initialised when this
 * module loads, and a parameter is what makes the order a fact of the
 * expression instead of a fact of the line numbers — reorder the two
 * declarations with an ambient read and the failure is a bare `ReferenceError`
 * from the temporal dead zone, at load, in every suite at once.
 */
function deriveEntryModules(pkg: PackageManifest): ReadonlyMap<string, string> {
  if (!pkg.name) {
    throw new Error(
      `repo facts: ${PACKAGE_JSON_PATH} has no \`name\` field; ` +
        `cannot derive the specifier a reader would import from`,
    );
  }
  if (!pkg.exports) {
    throw new Error(
      `repo facts: ${PACKAGE_JSON_PATH} has no \`exports\` field; ` +
        `nothing to derive the public entry-module set from`,
    );
  }
  const entries = new Map<string, string>();
  for (const [exposed, target] of Object.entries(pkg.exports)) {
    const importPath = typeof target === "string" ? target : target.import;
    if (!importPath) {
      throw new Error(
        `repo facts: package.json exports['${exposed}'] has no ` +
          `\`import\` field — cannot resolve its source entry`,
      );
    }
    // Invert the tsc rootDir/outDir mapping: ./dist/X.js -> src/X.ts.
    // This is the repo's convention encoded in tsconfig.json; if it
    // changes, this transform changes with it (one place, not 4+).
    const srcPath = importPath
      .replace(/^\.\/dist\//, "src/")
      .replace(/\.js$/, ".ts");
    const absPath = path.join(REPO_ROOT, srcPath);
    if (!existsSync(absPath)) {
      throw new Error(
        `repo facts: package.json exports['${exposed}'] -> ` +
          `${importPath} mapped to ${srcPath}, but that file does not exist. ` +
          `Check the dist→src convention in deriveEntryModules().`,
      );
    }
    // `exports` keys are `.` and `./sub`; the specifier a reader writes is the
    // package name with the same suffix.
    entries.set(pkg.name + exposed.slice(1), srcPath);
  }
  return entries;
}

/**
 * Load the repo's actual `tsconfig.json` compiler options so a program built
 * here sees the same ambient declarations and the same
 * lib/target/module-resolution surface as the build does.
 *
 * [LAW:one-source-of-truth] We tried hand-listing options here, and
 * each version drifted from tsconfig.json in subtle ways (e.g.
 * programmatic `lib: ["ES2022"]` doesn't pull in `lib.es2022.object.d.ts`
 * the way tsconfig's `"lib": ["ES2022"]` does, so `Object.hasOwn` was
 * unrecognized and the program's diagnostics flagged real source code
 * as broken). Reusing the parsed config eliminates the drift entirely
 * — the checker's view of the type system IS the build's view. The
 * coverage verifier, the seam gates and the docs build's example
 * compiler all read it; a second hand-written option set in any of them
 * would be a second clock.
 *
 * Local overrides: `noEmit: true` (we never emit), `noUnusedLocals` /
 * `noUnusedParameters` off (those would flag legitimate example-file
 * patterns and aren't relevant to symbol resolution), and `types`
 * extended with `node` if absent (both src/ and examples/ touch Node
 * builtins).
 */
export function loadCompilerOptions(): ts.CompilerOptions {
  const configPath = path.join(REPO_ROOT, "tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(
      `repo facts: failed to read ${configPath}: ` +
        ts.flattenDiagnosticMessageText(read.error.messageText, "\n"),
    );
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO_ROOT);
  if (parsed.errors.length > 0) {
    throw new Error(
      `repo facts: failed to parse ${configPath}:\n` +
        parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"),
    );
  }
  // Strip emit-shape options that only matter for `tsc` and that the
  // diagnostics pass would otherwise flag against wider rootNames
  // (examples/ files would violate `rootDir: src`).
  const { rootDir: _rootDir, outDir: _outDir, ...rest } = parsed.options;
  return {
    ...rest,
    noEmit: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    types: Array.from(new Set([...(parsed.options.types ?? []), "node"])),
  };
}

/**
 * Every `.ts` file under a repo-relative directory, recursively, sorted.
 *
 * The recursion is the point rather than an incidental convenience: a rule
 * that enumerates a directory to check each file passes by seeing nothing,
 * so a subdirectory added later must not silently fall outside the sweep.
 */
export function listTypeScriptFiles(relativeRoot: string): string[] {
  const root = path.join(REPO_ROOT, relativeRoot);
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (s.isFile() && full.endsWith(".ts")) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}
