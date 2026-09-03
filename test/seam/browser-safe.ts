/*
 * The rule behind `README.md`'s guarantee that "the main barrel stays
 * browser-safe": one pure scan of one parsed file, answering what about it
 * would fail to load in a browser.
 *
 * Two rules. A module names a Node builtin on an edge that survives to
 * runtime, which a browser bundler cannot resolve; or it reads one of
 * `AMBIENT_GLOBALS` at module scope, which throws the moment the module is
 * evaluated. Both are decided syntactically, and where a syntactic answer
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
import { isNameSlot } from "./identifiers.js";

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
 *   - everything that waits for something else to happen first: a function's
 *     body and parameter defaults wait for a call, an instance field waits
 *     for construction, an accessor body waits for a property read. One
 *     rule, three triggers — which is what makes an immediately-invoked
 *     function, `new (class { f = process.stdout })()`, and
 *     `{ get w() { return process } }.w` all report;
 *   - a type node, which is erased before the module ever runs, so
 *     `let out: Buffer` names nothing at runtime. A class `extends` clause
 *     is the exception TypeScript's own classification hides: `isTypeNode`
 *     calls it a type node, and it evaluates to the superclass the instant
 *     the declaration runs.
 *
 * A `static` field and a `static {}` block wait for nothing — they run when
 * the class declaration does — so neither is pruned.
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
      if (isDeferred(node, child)) return;
      visit(child);
    });
  };
  visit(root);
}

/**
 * Whether `child` waits for something before it evaluates — and that
 * something has not already happened right here.
 *
 * Asking one question of every deferred position is what makes the awkward
 * combinations come out right: a constructor parameter default inside a
 * class that is immediately instantiated defers nothing, and neither does a
 * getter on an object literal that is read on the spot.
 */
function isDeferred(parent: ts.Node, child: ts.Node): boolean {
  // Only the *initializer* of an instance field waits for construction. The
  // field's computed name and its decorators run when the class body does,
  // so pruning the whole declaration would hide them — the asymmetry with
  // the parameter branch below, where a name can never be an expression and
  // pruning the whole parameter is therefore safe.
  if (ts.isPropertyDeclaration(parent) && parent.initializer === child) {
    return !isStatic(parent) && !isImmediatelyInvoked(parent.parent);
  }
  // `isFunctionLike` admits signature types (`ConstructorTypeNode` and
  // friends) that have no body at all — narrow rather than cast.
  if (!ts.isFunctionLike(parent) || isImmediatelyRun(parent)) return false;
  return ("body" in parent && parent.body === child) || ts.isParameter(child);
}

function isStatic(node: ts.PropertyDeclaration): boolean {
  return (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
}

/**
 * Whether whatever `fn` is waiting for happens where `fn` is written.
 *
 * One notion, asked of the four kinds of function a module can hold: the
 * container's value — the object or class as written, or what `new` makes
 * of it — is consumed right here. A plain function is its own container and
 * is consumed by a call. A constructor's class is consumed by `new`. An
 * accessor is consumed by a property read, and a method by that read being
 * called; neither has a callable form of its own, so asking either the
 * plain-call question could only ever answer no.
 *
 * The kinds are an enumeration, but a closed one — those are all of them.
 * The chain is not walked further than this: `new C()` where `C` is named
 * elsewhere needs symbol resolution, which is the line this file does not
 * cross.
 */
function isImmediatelyRun(fn: ts.SignatureDeclaration): boolean {
  if (ts.isConstructorDeclaration(fn)) return isImmediatelyInvoked(fn.parent);
  if (ts.isGetAccessor(fn) || ts.isSetAccessor(fn)) return propertyReadOf(fn.parent) !== null;
  if (ts.isMethodDeclaration(fn)) {
    const read = propertyReadOf(fn.parent);
    return read !== null && isImmediatelyInvoked(read);
  }
  return isImmediatelyInvoked(fn);
}

/**
 * The property access applied on the spot to `container`'s value, where that
 * value is the container itself or the result of `new`-ing it. `null` when
 * nothing reads it here.
 */
function propertyReadOf(container: ts.Node): ts.Node | null {
  const constructed = outsideParens(container);
  const built =
    ts.isNewExpression(constructed.parent) && constructed.parent.expression === constructed
      ? constructed.parent
      : constructed;
  const target = outsideParens(built);
  const access = target.parent;
  return (ts.isPropertyAccessExpression(access) || ts.isElementAccessExpression(access)) &&
    access.expression === target
    ? access
    : null;
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

/** Whether `node` is the callee of the call it sits in, parentheses aside. */
function isImmediatelyInvoked(node: ts.Node): boolean {
  const callee = outsideParens(node);
  const call = callee.parent;
  return (ts.isCallExpression(call) || ts.isNewExpression(call)) && call.expression === callee;
}

function outsideParens(node: ts.Node): ts.Node {
  let current = node;
  while (ts.isParenthesizedExpression(current.parent)) current = current.parent;
  return current;
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
