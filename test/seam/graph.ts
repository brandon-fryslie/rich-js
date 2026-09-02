/*
 * The library's own module graph, walked syntactically.
 *
 * One purpose: answer "which files under `src/` does this set of entry
 * modules pull in, and by what chain of imports". Every rule about the
 * graph — the browser-safe barrel here, the core dependency direction
 * next door — asks that question first and then scans what it got back,
 * so the walk itself knows about no rule at all.
 *
 * [LAW:effects-at-boundaries] No `ts.Program`, no type-checker. Module
 * reachability is a syntactic property of import specifiers, and building
 * a `Program` to learn it would drag a full semantic pass (and its
 * diagnostics, and its cost) into a question that never needed one.
 */

import ts from "typescript";
import path from "node:path";
import { readFileSync } from "node:fs";
import { REPO_ROOT, isUnderSrc, loadCompilerOptions } from "../coverage/extract.js";

/**
 * A file the walk reached, with the import chain that reached it.
 *
 * `via` is repo-relative and inclusive of both ends, so a violation found
 * in a module nobody expected to be reachable reports *why* it is — which
 * is the whole diagnosis when a leak arrives as "some core module now
 * imports the node seam" rather than as a stray specifier.
 */
export interface ReachedModule {
  readonly file: string;
  readonly via: readonly string[];
}

/**
 * Every module specifier on an edge that survives to runtime.
 *
 * [LAW:types-are-the-program] "Survives to runtime" is the whole rule, and
 * it is why `import type` / `export type` are skipped: an erased edge loads
 * no module and can break no browser. The set is deliberately a superset of
 * the true runtime graph — an untyped `import { T }` used only as a type is
 * elided by the emitter but counted here — because a rule that guards an
 * invariant must err toward reporting, never toward missing.
 *
 * Dynamic `import("…")` with a literal specifier counts: it is the one
 * shape that would otherwise slip past every module-scope rule while still
 * failing a browser bundler at build time.
 */
export function runtimeModuleSpecifiers(sf: ts.SourceFile): ts.StringLiteral[] {
  const out: ts.StringLiteral[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      pushLiteral(out, node.moduleSpecifier);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      pushLiteral(out, node.moduleSpecifier);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      pushLiteral(out, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function pushLiteral(out: ts.StringLiteral[], node: ts.Node | undefined): void {
  if (node !== undefined && ts.isStringLiteral(node)) out.push(node);
}

/** Parse one file with parent pointers, which every scan over it relies on. */
export function parseSourceFile(absPath: string): ts.SourceFile {
  return ts.createSourceFile(
    absPath,
    readFileSync(absPath, "utf-8"),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
}

/**
 * Breadth-first over runtime edges from `roots`, keeping only files under
 * `src/`. Third-party packages are out of scope: this walk is about the
 * shape of code this repository owns, and a dependency's internals are the
 * bundler's problem, not this rule's.
 *
 * [LAW:no-silent-failure] A relative specifier that fails to resolve throws.
 * The alternative — skipping it — would silently shrink the graph, and a
 * guard test that quietly stops looking at part of the tree reports "safe"
 * for exactly the reason it should have reported "broken".
 */
export function reachableSourceModules(roots: readonly string[]): ReachedModule[] {
  const options = loadCompilerOptions();
  const reached = new Map<string, ReachedModule>();
  const queue: ReachedModule[] = [];
  const enqueue = (file: string, via: readonly string[]): void => {
    if (reached.has(file)) return;
    const entry: ReachedModule = { file, via: [...via, path.relative(REPO_ROOT, file)] };
    reached.set(file, entry);
    queue.push(entry);
  };

  for (const root of roots) enqueue(root, []);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    for (const specifier of runtimeModuleSpecifiers(parseSourceFile(current.file))) {
      const target = resolveEdge(specifier.text, current.file, options);
      if (target === null) continue;
      enqueue(target, current.via);
    }
  }
  return [...reached.values()];
}

/**
 * The file a specifier names, or `null` when it names something outside
 * `src/` — a `node:*` builtin, a package, a type-only `@types` declaration.
 * Callers that care about those specifiers inspect the specifier itself;
 * this resolver only decides what the walk continues into.
 */
function resolveEdge(
  specifier: string,
  from: string,
  options: ts.CompilerOptions,
): string | null {
  const resolved = ts.resolveModuleName(specifier, from, options, ts.sys).resolvedModule;
  if (!resolved) {
    if (!specifier.startsWith(".")) return null;
    throw new Error(
      `seam graph: ${path.relative(REPO_ROOT, from)} imports "${specifier}", ` +
        `which does not resolve to any file. The walk cannot see past it, so ` +
        `part of the module graph would go unchecked.`,
    );
  }
  return isUnderSrc(resolved.resolvedFileName) ? resolved.resolvedFileName : null;
}
