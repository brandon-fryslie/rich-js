// [LAW:one-source-of-truth] The set of public exports is derived directly
// from the entry modules listed in `package.json`'s `exports` field —
// no hand-maintained list. The set of referenced exports is derived from
// the actual import bindings in `examples/`. Both sets are computed by
// asking the TypeScript compiler to resolve symbols, then chasing alias
// chains to each symbol's declaration site. Two import sites that
// re-export the same declaration count as the same symbol — which means
// deep imports (`../../src/widgets/types.js`) cover the barrel export
// (`../../src/index.js`) for the same underlying symbol, and renamed
// re-exports (`escape as escapeMarkup`) collapse to one identity.
//
// [LAW:types-are-the-program] Public-export identity is a `(originFile,
// originName)` pair, not a string name. Different declarations sharing
// a name are different symbols and must each be demonstrated; a single
// declaration re-exported under many names is one symbol with one
// coverage requirement.

import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");

// [LAW:one-source-of-truth] The public entry-module set is derived from
// the `exports` field of `package.json` at test-load time — never a
// hand-maintained list. Each subpath export's `import` target is a
// `./dist/X.js` path, which the repo's tsconfig (rootDir: src, outDir:
// dist) deterministically pairs with `src/X.ts`. We invert that pairing
// here and assert each derived source file exists; a missing file
// fails the verifier load loudly rather than silently dropping a
// public surface from the coverage check.
export const ENTRY_MODULES: readonly string[] = deriveEntryModules();

function deriveEntryModules(): readonly string[] {
  const pkgPath = path.join(REPO_ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    exports?: Record<string, string | { import?: string }>;
  };
  if (!pkg.exports) {
    throw new Error(
      `coverage verifier: ${pkgPath} has no \`exports\` field; ` +
        `nothing to derive the public entry-module set from`,
    );
  }
  const entries: string[] = [];
  for (const [exposed, target] of Object.entries(pkg.exports)) {
    const importPath = typeof target === "string" ? target : target.import;
    if (!importPath) {
      throw new Error(
        `coverage verifier: package.json exports['${exposed}'] has no ` +
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
        `coverage verifier: package.json exports['${exposed}'] -> ` +
          `${importPath} mapped to ${srcPath}, but that file does not exist. ` +
          `Check the dist→src convention in deriveEntryModules().`,
      );
    }
    entries.push(srcPath);
  }
  return Object.freeze([...new Set(entries)]);
}

export const EXAMPLES_ROOT = "examples";

/**
 * Which question the verifier can ask about an export.
 *
 * [LAW:types-are-the-program] A demo covers an export by *naming it in an
 * import statement* (see `visitImports`). That is a question only a value
 * declaration can answer: idiomatic TypeScript consumes a type-only export
 * structurally — options arrive as object literals, aliases as bare values,
 * interfaces as inline implementations — so no honest demo ever names one.
 * Asking demo-coverage of a `"type"` export is unanswerable by construction,
 * and the discriminator is what stops the check from asking.
 */
export type ExportKind = "value" | "type";

/**
 * Identity of a declaration: the source file and the name under which it
 * is declared there. Two `SymbolOrigin`s are equal iff their `key` matches.
 * `kind` is derived from the same resolved symbol, so it cannot disagree
 * with the identity it travels with.
 */
export interface SymbolOrigin {
  readonly file: string;
  readonly name: string;
  readonly kind: ExportKind;
}

export function originKey(o: SymbolOrigin): string {
  return `${o.file}::${o.name}`;
}

/**
 * One row per (entry-module, exported-name). Multiple rows may share an
 * `origin` — that is the renamed/re-exported case (`ThemeName` exposed
 * from both `./` and `./themes/registry`, `escape` exposed as
 * `escapeMarkup`). Coverage is checked per *origin*, not per row.
 */
export interface PublicExport {
  readonly entry: string;          // e.g. "src/index.ts"
  readonly exposedAs: string;      // the name in the entry module
  readonly origin: SymbolOrigin;   // (declaration file, declaration name, kind)
  /**
   * The alias-resolved symbol `origin` is a projection of. Carried so the
   * type-reachability walk reads declarations from the same resolution the
   * universe was built from, rather than re-resolving them from a second
   * walk that could disagree.
   */
  readonly symbol: ts.Symbol;
}

/**
 * Build a TS Program that includes every entry module and every
 * `examples/**\/*.ts`. We compile both halves under one program so the
 * type-checker resolves symbols across the boundary cleanly.
 *
 * [LAW:one-source-of-truth] Returns the `exampleFiles` list the
 * program was actually constructed from. Callers consume this list
 * directly (e.g. for `collectReferencedOrigins`) rather than walking
 * `examples/` a second time; two walks could resolve a different set
 * than the program saw.
 */
export function makeProgram(): {
  program: ts.Program;
  checker: ts.TypeChecker;
  exampleFiles: readonly string[];
} {
  const exampleFiles = listExampleFiles();
  const rootNames = [
    ...ENTRY_MODULES.map((p) => path.join(REPO_ROOT, p)),
    ...exampleFiles,
  ];
  const program = ts.createProgram({
    rootNames,
    options: loadCompilerOptions(),
  });
  return { program, checker: program.getTypeChecker(), exampleFiles };
}

/**
 * Load the repo's actual `tsconfig.json` compiler options so the
 * verifier's program sees the same ambient declarations and the same
 * lib/target/module-resolution surface as the build does.
 *
 * [LAW:one-source-of-truth] We tried hand-listing options here, and
 * each version drifted from tsconfig.json in subtle ways (e.g.
 * programmatic `lib: ["ES2022"]` doesn't pull in `lib.es2022.object.d.ts`
 * the way tsconfig's `"lib": ["ES2022"]` does, so `Object.hasOwn` was
 * unrecognized and the program's diagnostics flagged real source code
 * as broken). Reusing the parsed config eliminates the drift entirely
 * — the verifier's view of the type system IS the build's view.
 *
 * Local overrides: `noEmit: true` (we never emit), `noUnusedLocals` /
 * `noUnusedParameters` off (those would flag legitimate example-file
 * patterns and aren't relevant to symbol resolution), and `types`
 * extended with `node` if absent (both src/ and examples/ touch Node
 * builtins).
 *
 * Exported because `test/seam/` resolves module specifiers with
 * `ts.resolveModuleName` and needs the build's own `moduleResolution`
 * to do it. A second hand-written option set there would be a second
 * clock.
 */
export function loadCompilerOptions(): ts.CompilerOptions {
  const configPath = path.join(REPO_ROOT, "tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(
      `Coverage verifier: failed to read ${configPath}: ` +
        ts.flattenDiagnosticMessageText(read.error.messageText, "\n"),
    );
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO_ROOT);
  if (parsed.errors.length > 0) {
    throw new Error(
      `Coverage verifier: failed to parse ${configPath}:\n` +
        parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"),
    );
  }
  // Strip emit-shape options that only matter for `tsc` and that the
  // diagnostics pass would otherwise flag against our wider rootNames
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
 * Precondition for any analysis on the program: it must compile cleanly.
 *
 * [LAW:no-silent-fallbacks] If `getSymbolAtLocation` returns `undefined`
 * because of an upstream TS error (broken import, missing type,
 * resolution failure), `collectReferencedOrigins` would silently skip
 * that binding — recording the affected symbol as *uncovered* even
 * though a demo references it. That's a false-uncovered failure mode
 * the verifier itself cannot detect, so we check it up front: any
 * non-`node_modules` syntactic or semantic diagnostic = the program
 * is unsafe to analyze, fail loudly with the full diagnostic list so
 * the operator fixes the compile first.
 *
 * `skipLibCheck` is on in `makeProgram`, so diagnostics in `lib.*.d.ts`
 * are already filtered. We additionally drop anything under
 * `node_modules/` (dep typings the verifier doesn't own).
 */
export function assertProgramClean(program: ts.Program): void {
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => {
    const f = d.file?.fileName;
    if (!f) return true;
    // Split on both POSIX and Windows separators and check for
    // `node_modules` as a path segment. TS normalizes to `/` on
    // every platform in practice, but this stays robust if that
    // ever changes (or if a custom host hands us native paths).
    return !f.split(/[\\/]/).includes("node_modules");
  });
  if (diagnostics.length === 0) return;
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => REPO_ROOT,
    getNewLine: () => "\n",
  };
  throw new Error(
    `Coverage verifier: TypeScript reported ${diagnostics.length} diagnostic(s) ` +
      `in src/ + examples/. Symbol resolution may be unreliable; fix these first.\n\n` +
      ts.formatDiagnosticsWithColorAndContext(diagnostics, host),
  );
}

/**
 * Walk `examples/` and collect every `.ts` file. Includes `shared/` and
 * per-demo nested files — references from any file under `examples/`
 * count toward coverage.
 */
export function listExampleFiles(): string[] {
  return listTypeScriptFiles(EXAMPLES_ROOT);
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

/**
 * For each entry module, ask the checker for its exports and resolve
 * each one through the alias chain to its declaration site. The result
 * is one row per (entry, exposedAs) pair — coverage is checked against
 * the *origin*, so multiple rows collapse to one coverage requirement.
 */
export function collectPublicExports(
  program: ts.Program,
  checker: ts.TypeChecker,
): PublicExport[] {
  const out: PublicExport[] = [];
  for (const entry of ENTRY_MODULES) {
    const absEntry = path.join(REPO_ROOT, entry);
    const sf = program.getSourceFile(absEntry);
    if (!sf) {
      throw new Error(
        `Coverage verifier: entry module ${entry} is not in the program. ` +
          `Did the path move, or is it missing from ENTRY_MODULES?`,
      );
    }
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) {
      throw new Error(`Coverage verifier: no module symbol for ${entry}`);
    }
    for (const sym of checker.getExportsOfModule(moduleSymbol)) {
      const origin = resolveOrigin(sym, checker);
      if (!origin) continue;
      out.push({
        entry,
        exposedAs: sym.name,
        origin,
        symbol: resolveAlias(sym, checker),
      });
    }
  }
  return out;
}

/**
 * Walk every example file, find every `import` statement whose binding
 * names a value or type from anywhere in `src/`, and resolve each binding
 * to its declaration origin. The returned set keys are `originKey()`
 * strings — coverage is "does this origin appear here".
 *
 * Default imports, named imports, and renamed imports (`{ x as y }`) all
 * resolve to their underlying symbol via the alias chain. Namespace
 * imports (`import * as ns`) are deliberately excluded — they name a
 * module, not a specific export, and would mark the entire module's
 * exports as covered, which would defeat the verifier's purpose.
 */
export function collectReferencedOrigins(
  exampleFiles: readonly string[],
  program: ts.Program,
  checker: ts.TypeChecker,
): Set<string> {
  const referenced = new Set<string>();
  for (const f of exampleFiles) {
    const sf = program.getSourceFile(f);
    if (!sf) continue;
    visitImports(sf, (idName) => {
      const sym = checker.getSymbolAtLocation(idName);
      if (!sym) return;
      const origin = resolveOrigin(sym, checker);
      if (!origin) return;
      // Only origins that live under src/ matter — examples importing
      // from `mobx` or `@promptctl/go-template-js` are not coverage events.
      if (!isUnderSrc(origin.file)) return;
      referenced.add(originKey(origin));
    });
  }
  return referenced;
}

/**
 * Origins reachable from `seedKeys` by following type positions —
 * annotations, heritage clauses, type arguments, `typeof` queries —
 * transitively through each declaration reached.
 *
 * This is the type-world analogue of demo coverage, and it answers the
 * question demo coverage cannot ask of a type-only export. Seed with the
 * value exports a demo actually names: a type reached from one of them is
 * part of the public type surface of something the demo runs, so a
 * consumer who has that value in hand can reach the type. A public type
 * reachable from no demonstrated value is inert — nothing runnable holds
 * anything that names it.
 *
 * That is a floor, and deliberately weaker than "the demo would break if
 * this type changed". Establishing *that* would need the members a demo
 * actually calls, which is call-graph analysis from `examples/` into
 * `src/`; reachability answers "can a user get here", not "did they".
 *
 * The walk collects identifiers in type positions only, so a method body
 * contributes its annotations and nothing else, and it skips `private`
 * members — a type reachable only through one is on no surface a consumer
 * can touch, so counting it would be the floor lying.
 */
export function collectTypeClosure(
  rows: readonly PublicExport[],
  seedKeys: ReadonlySet<string>,
  checker: ts.TypeChecker,
): Set<string> {
  const reached = new Set<string>();
  const queue: ts.Declaration[] = [];
  for (const row of rows) {
    if (!seedKeys.has(originKey(row.origin))) continue;
    queue.push(...(row.symbol.declarations ?? []));
  }
  while (queue.length > 0) {
    const decl = queue.pop()!;
    visitTypePositions(decl, (id) => {
      const sym = checker.getSymbolAtLocation(id);
      if (!sym) return;
      const origin = resolveOrigin(sym, checker);
      if (!origin) return;
      if (!isUnderSrc(origin.file)) return;
      const key = originKey(origin);
      if (reached.has(key)) return;
      reached.add(key);
      queue.push(...(resolveAlias(sym, checker).declarations ?? []));
    });
  }
  return reached;
}

/**
 * Call `onName` for the leftmost identifier of every type-position name in
 * the subtree: `T` in `x: T<U>`, `B` in `class A extends B`, `X` in
 * `typeof X`, `T` in `import("m").T`. Qualified names (`ns.T`) yield their
 * leftmost identifier, which is the one that resolves to an import binding.
 *
 * Exported for `extract.test.ts`. This walk is where every gap in the type
 * closure has actually been found, and it is pure over an AST — no checker,
 * no `Program` — so it can be pinned by fixtures instead of by an aggregate
 * pass over the whole tree that reports only pass or fail.
 */
export function visitTypePositions(root: ts.Node, onName: (id: ts.Identifier) => void): void {
  const leftmost = (n: ts.EntityName | ts.Expression): void => {
    let cur: ts.Node = n;
    while (ts.isQualifiedName(cur) || ts.isPropertyAccessExpression(cur)) {
      cur = ts.isQualifiedName(cur) ? cur.left : cur.expression;
    }
    if (ts.isIdentifier(cur)) onName(cur);
  };
  const visit = (node: ts.Node): void => {
    if (isOffSurface(node)) return;
    if (ts.isTypeReferenceNode(node)) leftmost(node.typeName);
    if (ts.isExpressionWithTypeArguments(node)) leftmost(node.expression);
    if (ts.isTypeQueryNode(node)) leftmost(node.exprName);
    if (ts.isImportTypeNode(node) && node.qualifier) leftmost(node.qualifier);
    ts.forEachChild(node, visit);
  };
  visit(root);
}

/**
 * Whether a subtree is outside its enclosing declaration's type surface, and
 * so must not be walked.
 *
 * A declaration's surface is its signature — type parameters, heritage
 * clauses, parameter/property/return types. Two things are not:
 *
 *   - a `private` or `#private` member, which no consumer can reach at all;
 *   - a body or an initializer, which is implementation. `forEachChild`
 *     descends into both, so a type named in a local annotation or a cast
 *     inside a called method would otherwise count as surface.
 *
 * Pruning states that rule once. Enumerating the positions that *do* count
 * would mean listing every declaration kind, and a missed kind fails silently
 * in the direction that marks a type reachable when it is not.
 */
function isOffSurface(node: ts.Node): boolean {
  return isPrivateMember(node) || isBodyOrInitializer(node);
}

function isPrivateMember(node: ts.Node): boolean {
  if (!ts.isClassElement(node)) return false;
  if (node.name && ts.isPrivateIdentifier(node.name)) return true;
  // `ClassElement` covers members that cannot carry modifiers at all
  // (a stray `;`), so narrow rather than cast.
  if (!ts.canHaveModifiers(node)) return false;
  return (ts.getModifiers(node) ?? []).some(
    (m) => m.kind === ts.SyntaxKind.PrivateKeyword,
  );
}

function isBodyOrInitializer(node: ts.Node): boolean {
  const parent: ts.Node | undefined = node.parent;
  if (!parent) return false;
  // `isFunctionLike` admits ConstructorTypeNode and friends, which have no
  // body — narrow to the ones that do rather than cast.
  if (ts.isFunctionLike(parent) && "body" in parent && parent.body === node) {
    return true;
  }
  // A function-like initializer is a signature, not implementation:
  // `export const f = (x: A): B => …` declares A and B on the arrow itself.
  // Descend into it — the rule above prunes its body one level down.
  if (ts.isFunctionLike(node)) return false;
  return (
    (ts.isPropertyDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isParameter(parent)) &&
    parent.initializer === node
  );
}

/**
 * Follow `SymbolFlags.Alias` chains to the original declaration symbol.
 * Returns `(file, name, kind)` of the first declaration on the resolved
 * symbol. Symbols with no declarations (rare; some built-ins) return
 * `null` — the caller treats unresolvable symbols as not-an-origin
 * rather than guessing.
 *
 * `SymbolFlags.Value` is the exact question `kind` needs to answer:
 * "could a demo's import statement bind this to something that exists at
 * runtime?" Classes and enums carry it alongside their type side and are
 * therefore values; interfaces and type aliases do not.
 */
function resolveOrigin(sym: ts.Symbol, checker: ts.TypeChecker): SymbolOrigin | null {
  const s = resolveAlias(sym, checker);
  const decl = s.declarations?.[0];
  if (!decl) return null;
  return {
    file: decl.getSourceFile().fileName,
    name: s.name,
    kind: (s.flags & ts.SymbolFlags.Value) !== 0 ? "value" : "type",
  };
}

function resolveAlias(sym: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  let s = sym;
  // Some aliases re-alias; loop until we hit a non-alias symbol or a
  // symbol the checker refuses to dereference further.
  while ((s.flags & ts.SymbolFlags.Alias) !== 0) {
    try {
      const aliased = checker.getAliasedSymbol(s);
      if (aliased === s) break;
      s = aliased;
    } catch {
      break;
    }
  }
  return s;
}

function visitImports(sf: ts.SourceFile, onName: (id: ts.Identifier) => void): void {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const ic = stmt.importClause;
    // A type-only import is erased before the demo runs, so it binds
    // nothing at runtime and demonstrates nothing. The checker resolves
    // `import type { SomeClass }` to the same `SymbolFlags.Value` symbol
    // as a value import, so without this the erased form would satisfy a
    // floor that asks whether a demo can name the thing it runs.
    if (ic.isTypeOnly) continue;
    if (ic.name) onName(ic.name);
    if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) {
      for (const el of ic.namedBindings.elements) {
        if (el.isTypeOnly) continue;
        // `el.name` is the *local* binding (e.g. `y` in `{ x as y }`);
        // the local binding's symbol still alias-resolves to `x`'s origin.
        onName(el.name);
      }
    }
    // [LAW:no-mode-explosion] Namespace imports are excluded by design,
    // not by oversight — see collectReferencedOrigins doc comment.
  }
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
 * its target read as unrelated paths. Every caller here derives both
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

/**
 * Group exports by origin. The map's value carries the set of names
 * each origin is publicly exposed under — used to produce a readable
 * failure message that says "ThemeName (also exposed as ThemeName from
 * themes/registry)" instead of two separate "uncovered" lines for the
 * same underlying declaration.
 */
export interface OriginInfo {
  readonly origin: SymbolOrigin;
  readonly exposures: ReadonlyArray<{ entry: string; exposedAs: string }>;
}

export function groupByOrigin(rows: readonly PublicExport[]): Map<string, OriginInfo> {
  const out = new Map<string, { origin: SymbolOrigin; exposures: { entry: string; exposedAs: string }[] }>();
  for (const r of rows) {
    const k = originKey(r.origin);
    const existing = out.get(k);
    if (existing) {
      existing.exposures.push({ entry: r.entry, exposedAs: r.exposedAs });
    } else {
      out.set(k, { origin: r.origin, exposures: [{ entry: r.entry, exposedAs: r.exposedAs }] });
    }
  }
  return out;
}

/**
 * Identifier used in the allowlist file.
 *
 * [LAW:types-are-the-program] The selection rule itself enforces the
 * stability claim: prefer the exposure from the *primary* entry module
 * (ENTRY_MODULES[0], which is `.` from package.json#exports —
 * `src/index.ts` here) and walk down the entry-module list in
 * package.json order as fallback. Within a single entry, ties break
 * alphabetically (rare — happens when one origin is re-exported under
 * multiple names from the same module, e.g. `escape as escapeMarkup`).
 *
 * Stability follows directly: adding a new exposure from a
 * lower-priority entry cannot shift the canonical key, because a
 * higher-priority exposure already exists. A rename within the
 * primary entry DOES shift the key — which is correct, because that
 * is a meaningful change to the public API surface.
 */
export function canonicalNameFor(info: OriginInfo): string {
  for (const entry of ENTRY_MODULES) {
    const hits = info.exposures.filter((e) => e.entry === entry);
    if (hits.length === 0) continue;
    return hits.map((h) => h.exposedAs).sort((a, b) => a.localeCompare(b))[0]!;
  }
  // Unreachable in practice — every exposure belongs to an entry
  // module by construction — but the type system can't see that.
  // Fall back to an alphabetic pick rather than risk a thrown error
  // that would mask the real coverage failure downstream.
  return [...info.exposures]
    .map((e) => e.exposedAs)
    .sort((a, b) => a.localeCompare(b))[0]!;
}
