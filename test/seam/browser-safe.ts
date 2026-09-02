/*
 * The rule behind `README.md`'s guarantee that "the main barrel stays
 * browser-safe": one pure scan of one parsed file, answering what about it
 * would fail to load in a browser.
 *
 * Two rules. A module names a Node builtin on an edge that survives to
 * runtime, which a browser bundler cannot resolve; or it reads the ambient
 * `process` or `Buffer` at module scope, which throws the moment the module
 * is evaluated. Both are decided syntactically, and where a syntactic answer
 * cannot be exact the scan errs toward reporting — a guard that misses is
 * worse than a guard that is occasionally strict about a name.
 *
 * Module scope is the line, not the file. `src/core/color.ts` and
 * `src/core/console.ts` both read `process` today, both from inside a
 * function body, and both are correct: the read happens only if a caller
 * asks for the ambient default, and `Console`'s `ambientEnvironment()` is
 * the shape to copy. A module-scope read has no such caller — importing the
 * barrel is enough to trigger it.
 *
 * [LAW:no-mode-explosion] There is no exemption for a `typeof process`
 * guard at module scope, and deliberately so: nothing in `src/` needs one,
 * the fix is always to move the read into a function, and an allowance with
 * no owner is a mode we would carry forever to permit a shape nobody has
 * yet asked to write.
 */

import ts from "typescript";
import path from "node:path";
import { builtinModules } from "node:module";
import { REPO_ROOT } from "../coverage/extract.js";
import { runtimeModuleSpecifiers } from "./graph.js";

/**
 * [LAW:one-source-of-truth] The builtin list comes from the running Node,
 * not from a list kept here. It already carries the slashed forms
 * (`fs/promises`, `readline/promises`), so membership is one lookup; the
 * `node:` prefix stays a separate arm because specifiers exist under that
 * scheme which the array does not list.
 */
const NODE_BUILTINS = new Set<string>(builtinModules);

function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith("node:") || NODE_BUILTINS.has(specifier);
}

/**
 * Globals a browser does not provide. `globalThis` is standard and stays
 * off; the CommonJS names (`require`, `__dirname`, …) stay off because this
 * package is ESM, where they already throw under ordinary Node testing.
 */
const AMBIENT_GLOBALS = ["process", "Buffer", "global"] as const;
export type AmbientGlobal = (typeof AMBIENT_GLOBALS)[number];

/**
 * One reason a module is not browser-safe.
 *
 * [LAW:types-are-the-program] The two rules carry genuinely different
 * evidence — a specifier versus a global's name — so they are two variants
 * rather than one record with both fields optional. A reader of a failure,
 * and a test asserting on one, gets the field that exists and cannot reach
 * for the one that does not.
 */
export type SeamViolation =
  | {
      readonly rule: "node-import";
      readonly file: string;
      readonly line: number;
      readonly specifier: string;
    }
  | {
      readonly rule: "ambient-global";
      readonly file: string;
      readonly line: number;
      readonly global: AmbientGlobal;
    };

/** Every reason `sf` would fail to load in a browser, in source order. */
export function browserSafetyViolations(sf: ts.SourceFile): SeamViolation[] {
  const file = path.relative(REPO_ROOT, sf.fileName);
  const lineOf = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const imports = runtimeModuleSpecifiers(sf)
    .filter((specifier) => isNodeBuiltin(specifier.text))
    .map(
      (specifier): SeamViolation => ({
        rule: "node-import",
        file,
        line: lineOf(specifier),
        specifier: specifier.text,
      }),
    );

  // A name this module binds itself is this module's name, whatever it is
  // spelled: `ambient` means unbound here, not merely spelled `process`.
  const bound = moduleScopeBindings(sf);
  const globals: SeamViolation[] = [];
  visitModuleScopeReads(sf, (id) => {
    if (!isAmbientGlobal(id.text) || bound.has(id.text)) return;
    globals.push({ rule: "ambient-global", file, line: lineOf(id), global: id.text });
  });

  return [...imports, ...globals].sort((a, b) => a.line - b.line);
}

/** A failure line naming the file, the offence, and how the file was reached. */
export function describeViolation(violation: SeamViolation, via: readonly string[]): string {
  const offence =
    violation.rule === "node-import"
      ? `imports ${JSON.stringify(violation.specifier)}`
      : `reads the ambient \`${violation.global}\` at module scope`;
  return (
    `  ${violation.file}:${violation.line} — ${offence}\n` +
    `      reached by: ${via.join(" → ")}`
  );
}

function isAmbientGlobal(name: string): name is AmbientGlobal {
  return (AMBIENT_GLOBALS as readonly string[]).includes(name);
}

/**
 * Call `onRead` for every identifier read as a value at module scope.
 *
 * Two subtrees are pruned, and both are pruned rather than enumerated
 * around, because a missed node kind fails silently in the direction that
 * calls an unsafe module safe:
 *
 *   - what a function defers until it is called — its body and its
 *     parameter defaults, which are one rule and not two, so an
 *     immediately-invoked function correctly defers neither;
 *   - a type node, which is erased before the module ever runs, so
 *     `let out: Buffer` names nothing at runtime. A class `extends` clause
 *     is the exception TypeScript's own classification hides: `isTypeNode`
 *     calls it a type node, and it evaluates to the superclass the instant
 *     the declaration runs.
 *
 * Class field initializers are pruned by neither: a field initializer runs
 * on construction, which a browser bundle reaches as soon as anything
 * builds the class.
 *
 * The deferral rule is syntactic and therefore not exact — a callback
 * argument to a call that itself runs on import (`[1].map(() => process)`)
 * is deferred by this walk and evaluated by the runtime. Deciding that in
 * general is not a question an AST can answer.
 */
export function visitModuleScopeReads(root: ts.Node, onRead: (id: ts.Identifier) => void): void {
  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node)) {
      if (ts.isExpressionWithTypeArguments(node) && isClassExtends(node)) visit(node.expression);
      return;
    }
    if (ts.isIdentifier(node) && !isNameSlot(node)) onRead(node);
    ts.forEachChild(node, (child) => {
      if (isDeferredUntilCall(node, child)) return;
      visit(child);
    });
  };
  visit(root);
}

/**
 * Whether `child` waits for someone to call `parent` before it evaluates.
 * A body and a parameter default defer for the same reason, so they are one
 * question — which is what makes `(function (out = process.stdout) {})()`
 * come out right where two independent carve-outs would not.
 */
function isDeferredUntilCall(parent: ts.Node, child: ts.Node): boolean {
  // `isFunctionLike` admits signature types (`ConstructorTypeNode` and
  // friends) that have no body at all — narrow rather than cast.
  if (!ts.isFunctionLike(parent) || isImmediatelyInvoked(parent)) return false;
  return ("body" in parent && parent.body === child) || ts.isParameter(child);
}

/**
 * Whether a class `extends` clause — as opposed to `implements`, or an
 * interface's `extends`, which really are erased.
 */
function isClassExtends(node: ts.ExpressionWithTypeArguments): boolean {
  const clause = node.parent;
  return (
    ts.isHeritageClause(clause) &&
    clause.token === ts.SyntaxKind.ExtendsKeyword &&
    ts.isClassLike(clause.parent)
  );
}

/** Whether `fn` is the callee of the call it sits in, parentheses aside. */
function isImmediatelyInvoked(fn: ts.Node): boolean {
  // A constructor is never called; its class is.
  let callee: ts.Node = ts.isConstructorDeclaration(fn) ? fn.parent : fn;
  while (ts.isParenthesizedExpression(callee.parent)) callee = callee.parent;
  const call = callee.parent;
  return (
    (ts.isCallExpression(call) || ts.isNewExpression(call)) && call.expression === callee
  );
}

/**
 * Whether `id` sits in a slot that *names* something rather than reads it.
 *
 * Asking the slot generalises over every declaration kind at once — every
 * one of them puts its own identifier in `.name` — where enumerating the
 * kinds would leave a gap the first time TypeScript grows another.
 */
function isNameSlot(id: ts.Identifier): boolean {
  const parent = id.parent;
  // `{ process }` is the one `.name` slot that is a read, not a binding.
  if (ts.isShorthandPropertyAssignment(parent)) return false;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === id;
  // An export specifier's local reference is `propertyName ?? name` — and it
  // is local only without a `from` clause. `export { process }` and
  // `export { process as p }` read the binding; add `from "./m.js"` and the
  // same two names index the other module's exports instead.
  if (ts.isExportSpecifier(parent)) {
    return isReExport(parent) || (parent.propertyName ?? parent.name) !== id;
  }
  // Everywhere else a `propertyName` names a slot in someone else's table —
  // an object's property in `const { process: local } = config`, another
  // module's export in `import { process as p } from …` — never a binding
  // this file makes.
  if ((parent as Partial<ts.BindingElement>).propertyName === id) return true;
  return (parent as Partial<ts.NamedDeclaration>).name === id;
}

function isReExport(specifier: ts.ExportSpecifier): boolean {
  return specifier.parent.parent.moduleSpecifier !== undefined;
}

/**
 * Every name this module binds at its own top level.
 *
 * A module that declares or imports its own `process` shadows the global,
 * and reads of it are reads of that binding. The walk is over `sf.statements`
 * alone, which is exactly the scope the reads being checked live in — so a
 * binding inside a module-scope *block* still reports. That is the safe
 * direction, and the failure names the file and the line.
 *
 * Only bindings that exist at runtime count. `interface Buffer {}` shadows
 * the type and leaves the value where it was, so counting it would suppress
 * a real violation — the direction this file calls worse than a false
 * positive, and the one a shadowing rule is most likely to buy by accident.
 */
function moduleScopeBindings(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of sf.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
    }
    if (ts.isImportDeclaration(statement)) {
      for (const binding of importBindings(statement.importClause)) names.add(binding.text);
    }
    // Functions, classes, enums and namespaces all carry their own
    // identifier in `.name` — the same slot question `isNameSlot` asks, for
    // the same reason.
    const declared = (statement as Partial<ts.NamedDeclaration>).name;
    if (declared !== undefined && ts.isIdentifier(declared)) names.add(declared.text);
  }
  return names;
}

function collectBindingNames(name: ts.BindingName, into: Set<string>): void {
  if (ts.isIdentifier(name)) {
    into.add(name.text);
    return;
  }
  for (const element of name.elements) {
    // An array pattern's holes (`const [, x] = …`) bind nothing.
    if (ts.isBindingElement(element)) collectBindingNames(element.name, into);
  }
}

/** The identifiers an import binds at runtime; an erased one binds none. */
function importBindings(clause: ts.ImportClause | undefined): ts.Identifier[] {
  if (clause === undefined || clause.isTypeOnly) return [];
  const named = clause.namedBindings;
  const fromNamed =
    named === undefined
      ? []
      : ts.isNamespaceImport(named)
        ? [named.name]
        : named.elements.filter((element) => !element.isTypeOnly).map((element) => element.name);
  return clause.name === undefined ? fromNamed : [clause.name, ...fromNamed];
}
