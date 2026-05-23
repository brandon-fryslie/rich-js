// [LAW:one-source-of-truth] The set of public exports is derived directly
// from the four entry modules listed in `package.json`'s `exports` field —
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
import { readdirSync, statSync } from "node:fs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");

// Derived once from `package.json` — the four public entry points. Adding
// a new entry to `exports` (or removing one) requires updating this list,
// and the verifier should fail if a listed path is missing or unparseable.
export const ENTRY_MODULES: readonly string[] = [
  "src/index.ts",
  "src/themes/data/index.ts",
  "src/themes/registry.ts",
  "src/template-bindings/index.ts",
] as const;

export const EXAMPLES_ROOT = "examples";

/**
 * Identity of a declaration: the source file and the name under which it
 * is declared there. Two `SymbolOrigin`s are equal iff their `key` matches.
 */
export interface SymbolOrigin {
  readonly file: string;
  readonly name: string;
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
  readonly origin: SymbolOrigin;   // (declaration file, declaration name)
}

/**
 * Build a TS Program that includes every entry module and every
 * `examples/**\/*.ts`. We compile both halves under one program so the
 * type-checker resolves symbols across the boundary cleanly.
 */
export function makeProgram(): { program: ts.Program; checker: ts.TypeChecker } {
  const exampleFiles = listExampleFiles();
  const rootNames = [
    ...ENTRY_MODULES.map((p) => path.join(REPO_ROOT, p)),
    ...exampleFiles,
  ];
  const program = ts.createProgram({
    rootNames,
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      noEmit: true,
      allowJs: false,
      lib: ["lib.es2022.d.ts"],
      types: [],
    },
  });
  return { program, checker: program.getTypeChecker() };
}

/**
 * Walk `examples/` and collect every `.ts` file. Includes `shared/` and
 * per-demo nested files — references from any file under `examples/`
 * count toward coverage.
 */
export function listExampleFiles(): string[] {
  const root = path.join(REPO_ROOT, EXAMPLES_ROOT);
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
      out.push({ entry, exposedAs: sym.name, origin });
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
 * Follow `SymbolFlags.Alias` chains to the original declaration symbol.
 * Returns `(file, name)` of the first declaration on the resolved
 * symbol. Symbols with no declarations (rare; some built-ins) return
 * `null` — the caller treats unresolvable symbols as not-an-origin
 * rather than guessing.
 */
function resolveOrigin(sym: ts.Symbol, checker: ts.TypeChecker): SymbolOrigin | null {
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
  const decl = s.declarations?.[0];
  if (!decl) return null;
  return { file: decl.getSourceFile().fileName, name: s.name };
}

function visitImports(sf: ts.SourceFile, onName: (id: ts.Identifier) => void): void {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const ic = stmt.importClause;
    if (ic.name) onName(ic.name);
    if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) {
      for (const el of ic.namedBindings.elements) {
        // `el.name` is the *local* binding (e.g. `y` in `{ x as y }`);
        // the local binding's symbol still alias-resolves to `x`'s origin.
        onName(el.name);
      }
    }
    // [LAW:no-mode-explosion] Namespace imports are excluded by design,
    // not by oversight — see collectReferencedOrigins doc comment.
  }
}

function isUnderSrc(absPath: string): boolean {
  const srcRoot = path.join(REPO_ROOT, "src") + path.sep;
  return absPath.startsWith(srcRoot);
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
 * Identifier used in the allowlist file. We pick a single canonical
 * name per origin — the first exposed-as name, alphabetically across
 * entry modules. This keeps allowlist keys stable: if the same origin
 * is re-exposed under more entries later, the canonical key does not
 * shift.
 */
export function canonicalNameFor(info: OriginInfo): string {
  const sorted = [...info.exposures].sort((a, b) => {
    if (a.exposedAs !== b.exposedAs) return a.exposedAs.localeCompare(b.exposedAs);
    return a.entry.localeCompare(b.entry);
  });
  return sorted[0]!.exposedAs;
}
