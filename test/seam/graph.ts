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
 * One module this file names, and whether the naming survives to runtime.
 *
 * [LAW:dataflow-not-control-flow] Erasure is a property *of the edge*, not a
 * mode of the collector, because the two rules built on this walk disagree
 * about it and both are right. "The barrel loads in a browser" is a runtime
 * property, so an erased edge cannot break it. "`core/` does not know about
 * `renderables/`" is an architectural one, and `import type { Rule } from
 * "../renderables/rule.js"` is that knowledge whether or not it emits a byte.
 * Tagging each edge lets each rule filter for what it means; a boolean
 * parameter here would have made one collector into two behaviours selected
 * by a flag, and a second traversal would have made one fact into two maps.
 *
 * Dynamic `import("…")` with a literal specifier is never erased: it is the
 * one shape that would otherwise slip past every module-scope rule while
 * still failing a browser bundler at build time.
 */
export interface ModuleSpecifier {
  readonly literal: ts.StringLiteral;
  readonly erased: boolean;
}

/** Every module `sf` names, in source order, erased edges included. */
export function moduleSpecifiers(sf: ts.SourceFile): ModuleSpecifier[] {
  const out: ModuleSpecifier[] = [];
  const push = (node: ts.Node | undefined, erased: boolean): void => {
    if (node !== undefined && ts.isStringLiteral(node)) out.push({ literal: node, erased });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      push(node.moduleSpecifier, !survivesErasure(node));
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      push(node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/**
 * Every module specifier on an edge that survives to runtime.
 *
 * The set is deliberately a superset of the true runtime graph — an untyped
 * `import { T }` used only as a type is elided by the emitter but counted
 * here — because a rule that guards an invariant must err toward reporting,
 * never toward missing.
 */
export function runtimeModuleSpecifiers(sf: ts.SourceFile): ts.StringLiteral[] {
  return moduleSpecifiers(sf)
    .filter((specifier) => !specifier.erased)
    .map((specifier) => specifier.literal);
}

/**
 * Whether the statement still names a module once the types are stripped.
 *
 * Two spellings erase it, and the declaration-level flag only reports the
 * first: `import type { … }`, and the per-specifier form `import { type X }`
 * that `isolatedModules` encourages. A default or namespace binding survives
 * whatever the braces say, and a side-effect import has no bindings to erase.
 */
function survivesErasure(node: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  const typeOnly = ts.isExportDeclaration(node)
    ? node.isTypeOnly
    : (node.importClause?.isTypeOnly ?? false);
  if (typeOnly) return false;
  const elements = erasableElements(node);
  return elements === undefined || elements.some((element) => !element.isTypeOnly);
}

/** The named bindings whose own `type` modifiers decide the statement's fate. */
function erasableElements(
  node: ts.ImportDeclaration | ts.ExportDeclaration,
): readonly (ts.ImportSpecifier | ts.ExportSpecifier)[] | undefined {
  if (ts.isExportDeclaration(node)) {
    const clause = node.exportClause;
    return clause !== undefined && ts.isNamedExports(clause) ? clause.elements : undefined;
  }
  const clause = node.importClause;
  // A default binding survives regardless of what the braces say.
  if (clause === undefined || clause.name !== undefined) return undefined;
  const named = clause.namedBindings;
  return named !== undefined && ts.isNamedImports(named) ? named.elements : undefined;
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
 *
 * Exported so its throwing arm can be pinned. Nothing in a healthy `src/`
 * reaches it, which makes it the one line here whose regression would look
 * exactly like success — the failure mode this file exists to prevent.
 */
export function resolveEdge(
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
