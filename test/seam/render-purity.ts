/*
 * A render changes nothing, and the type system is where that is checked:
 * nothing writable is reachable from a renderable's fields, or from module
 * scope, anywhere in `src/`.
 *
 * `State` (`src/core/state.ts`) is the runtime half: state that changes after a
 * renderable is built lives in one, and setting it while something is drawn
 * throws. That refusal only sees a `State`. A plain field assigned in `render`
 * — `this._scrollStart = …` — or a module `let` a render writes, is invisible
 * to it, so this is the other half: every location that could be written
 * without a `State` is reported, and `RENDER_PURITY_DEBT` in
 * `./render-purity-debt.ts` lists the ones that exist today, to be drained.
 *
 * [LAW:types-are-the-program] The theorem is one sentence: no writable
 * location is reachable from a renderable's fields, a class's statics, or a
 * module's bindings, except through a sanctioned holder. A renderable is a
 * class whose instances have `render`, `measure` or `contents`. Reachable
 * means through the checker's types, all the way down: properties of the
 * object types a field holds, the elements of a `ReadonlyArray`, the
 * arguments of a `ReadonlyMap`, a union's every member. Writable means:
 *
 *   - a property that is not `readonly` (a mapped `Readonly<>` is; a method or an accessor is code, and what a setter writes is checked where it is declared);
 *   - an index signature that is not `readonly`;
 *   - an `Array`, a tuple not marked `readonly`, a `Map`, `Set`, `WeakMap` or
 *     `WeakSet`;
 *   - a module `let` or `var`.
 *
 * The sanctioned holders, and they are the whole list:
 *
 *   - `State<T>`: its internals are its own, and its `T` is walked — a
 *     `State<number[]>` would hand out an array to push to;
 *   - `Memo<V, K>` and `WeakMemo<V, K>`: likewise, `V` walked — not a
 *     `WeakMemo`'s key, which nothing reads back out. A `State` anywhere in `V` is reported
 *     and no debt row can excuse it: a memo is "same key, same value", and a
 *     memo of states passes in the pass that fills it and throws from the next;
 *   - an `accessor` in `src/widgets/` decorated by mobx: the widgets' own
 *     state carrier. Refusing a write to one during render is
 *     rich-protocol-9xcs.sej's, against the same phase; until it lands, a
 *     widget render that writes its own accessor passes both halves;
 *   - the render phase itself, `active` in `src/core/protocol.ts`.
 *
 * WHAT THIS CANNOT SEE, said out loud because a blind spot read as coverage is
 * worse than no guard: what a function closes over (a field holding a closure
 * over a `let` passes), a type parameter's eventual argument (a generic
 * class's `readonly x: T` passes for every `T`), and anything typed `any`.
 * Nor does it ask whether a render *writes* a location — only whether one
 * exists to be written; a readonly-everything class can still hand a
 * builder's mutable result to a caller in a local.
 */

import ts from "typescript";
import { REPO_ROOT, isPathInside, repoRelative } from "../../scripts/repo-facts.js";
import path from "node:path";

/** One place a value can be written without a `State`. */
export interface WritableLocation {
  /** `<file> <Owner>.<name>`, the declaration that holds it. */
  readonly key: string;
  readonly reason: Reason;
}

export type Reason =
  | "writable property"
  | "writable static"
  | "mutable index signature"
  | "mutable array"
  | "mutable Map"
  | "mutable Set"
  | "mutable WeakMap"
  | "mutable WeakSet"
  | "module let"
  | "state in a Memo";

const RENDER_METHODS = new Set(["render", "measure", "contents"]);
const MUTABLE_COLLECTIONS = new Set(["Map", "Set", "WeakMap", "WeakSet"]);
const READONLY_COLLECTIONS = new Set(["ReadonlyMap", "ReadonlySet", "ReadonlyArray"]);
const HOLDERS = { State: "src/core/state.ts", Memo: "src/core/memo.ts" } as const;
const MEMOS = new Set(["Memo", "WeakMemo"]);
const PHASE = { file: "src/core/protocol.ts", name: "active" } as const;
const WIDGETS = path.join(REPO_ROOT, "src/widgets");

// TypeScript marks a property a mapped `Readonly<>` made readonly with this
// check flag; it is not on the public API, and nothing public reports it.
const CHECK_FLAG_READONLY = 8;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const checkFlags = (symbol: ts.Symbol): number => (ts as any).getCheckFlags(symbol) as number;

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

function isReadonlyProperty(symbol: ts.Symbol): boolean {
  if ((checkFlags(symbol) & CHECK_FLAG_READONLY) !== 0) return true;
  const decls = symbol.declarations ?? [];
  if (decls.length === 0) return false;
  if (decls.some(ts.isSetAccessorDeclaration)) return false;
  return decls.every((d) => hasModifier(d, ts.SyntaxKind.ReadonlyKeyword));
}

/** A method or an accessor: code, not a location. What a setter writes is a location of its own, and is walked where it is declared. */
function isComputed(symbol: ts.Symbol): boolean {
  const decls = symbol.declarations ?? [];
  if (decls.length === 0) return false;
  return decls.every((d) => ts.isMethodDeclaration(d) || ts.isMethodSignature(d) || ts.isAccessor(d));
}

/**
 * The names enclosing `node`, outermost first: every named declaration up to
 * the nearest class, interface, type alias or function, or `module` at the
 * file — so a property of an anonymous object type is named by the field,
 * variable or method it is the type of.
 */
function ownerOf(node: ts.Node): string {
  const names: string[] = [];
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    if (ts.isSourceFile(at)) return ["module", ...names].join(".");
    if ((ts.isClassLike(at) || ts.isInterfaceDeclaration(at) || ts.isTypeAliasDeclaration(at) || ts.isFunctionDeclaration(at)) && at.name) {
      return [at.name.text, ...names].join(".");
    }
    if (isNamedHolder(at) && ts.isIdentifier(at.name)) names.unshift(at.name.text);
  }
  throw new Error("render-purity: a declaration outside any source file");
}

function isNamedHolder(
  node: ts.Node,
): node is ts.VariableDeclaration | ts.PropertyDeclaration | ts.PropertySignature | ts.ParameterDeclaration | ts.MethodDeclaration {
  return (
    ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isParameter(node) || ts.isMethodDeclaration(node)
  );
}

/**
 * A declaration in one of TypeScript's own lib files is keyed `lib`, not by
 * its path: where `node_modules` resolves from, and which lib file a member
 * sits in, are facts about the install, not about `src/`.
 */
function keyOf(program: ts.Program, decl: ts.Node, name: string): string {
  const source = decl.getSourceFile();
  const file = program.isSourceFileDefaultLibrary(source) ? "lib" : repoRelative(source.fileName);
  return `${file} ${ownerOf(decl)}.${name}`;
}

function declaredIn(symbol: ts.Symbol | undefined, file: string): boolean {
  return (symbol?.declarations ?? []).some((d) => repoRelative(d.getSourceFile().fileName) === file);
}

/** Whether `decl` is a widget `accessor` decorated by something imported from mobx. */
function isMobxAccessor(checker: ts.TypeChecker, decl: ts.Declaration): boolean {
  if (!ts.isPropertyDeclaration(decl) || !hasModifier(decl, ts.SyntaxKind.AccessorKeyword)) return false;
  if (!isPathInside(WIDGETS, decl.getSourceFile().fileName)) return false;
  return (ts.getDecorators(decl) ?? []).some((decorator) => {
    let root: ts.Expression = decorator.expression;
    while (ts.isCallExpression(root) || ts.isPropertyAccessExpression(root)) root = ts.isCallExpression(root) ? root.expression : root.expression;
    const symbol = ts.isIdentifier(root) ? checker.getSymbolAtLocation(root) : undefined;
    const imported = symbol?.declarations?.find(ts.isImportSpecifier);
    const from = imported?.parent.parent.parent.moduleSpecifier;
    return from !== undefined && ts.isStringLiteral(from) && from.text === "mobx";
  });
}

/** Every writable location reachable from the renderables, class statics and module bindings declared in `files`. */
export function writableLocations(program: ts.Program, files: readonly string[]): WritableLocation[] {
  const checker = program.getTypeChecker();
  // Every reason a location has, not the first: a `State` in a `Memo` held by
  // a module `let` is both, and only the second is beyond a debt row's reach.
  const found = new Map<string, WritableLocation>();
  const report = (key: string, reason: Reason): void => {
    found.set(`${key}\0${reason}`, { key, reason });
  };
  const walked = new Set<string>();

  /**
   * A value of `type` held at `at`: the container it is reported there, and
   * what it contains walked. `inMemo` is whether a `Memo`'s value is being
   * walked, where a `State` is refused.
   */
  const held = (type: ts.Type, at: string, inMemo: boolean): void => {
    // A recursive type (a JSON value holds JSON values) is walked once per place it is held.
    const visit = `${(type as { id?: number }).id}:${inMemo}:${at}`;
    if (walked.has(visit)) return;
    walked.add(visit);
    if (type.isUnionOrIntersection()) return type.types.forEach((t) => held(t, at, inMemo));
    const symbol = type.getSymbol();
    const args = (): readonly ts.Type[] => checker.getTypeArguments(type as ts.TypeReference);
    if (symbol?.name === "State" && declaredIn(symbol, HOLDERS.State)) {
      if (inMemo) report(at, "state in a Memo");
      return args().forEach((t) => held(t, at, inMemo));
    }
    // The value is a memo's first type argument; the second is its key.
    if (symbol && MEMOS.has(symbol.name) && declaredIn(symbol, HOLDERS.Memo)) return held(args()[0]!, at, true);
    if (checker.isTupleType(type)) {
      if (!(type as ts.TupleTypeReference).target.readonly) report(at, "mutable array");
      return args().forEach((t) => held(t, at, inMemo));
    }
    if (checker.isArrayType(type)) {
      if (symbol?.name === "Array") report(at, "mutable array");
      return args().forEach((t) => held(t, at, inMemo));
    }
    if (symbol && MUTABLE_COLLECTIONS.has(symbol.name)) {
      report(at, `mutable ${symbol.name}` as Reason);
      return args().forEach((t) => held(t, at, inMemo));
    }
    if (symbol && READONLY_COLLECTIONS.has(symbol.name)) return args().forEach((t) => held(t, at, inMemo));
    for (const info of checker.getIndexInfosOfType(type)) {
      if (!info.isReadonly) report(at, "mutable index signature");
      held(info.type, at, inMemo);
    }
    object(type, inMemo);
  };

  /** The properties of an object type, each a location of its own. */
  const object = (type: ts.Type, inMemo: boolean): void => {
    if (!(type.flags & ts.TypeFlags.Object)) return;
    const id = `${(type as { id?: number }).id}:${inMemo}`;
    if (walked.has(id)) return;
    walked.add(id);
    for (const property of type.getProperties()) {
      const decl = property.valueDeclaration ?? property.declarations?.[0];
      if (!decl || isComputed(property) || isMobxAccessor(checker, decl)) continue;
      const key = keyOf(program, decl, property.name);
      if (!isReadonlyProperty(property)) report(key, "writable property");
      held(checker.getTypeOfSymbol(property), key, inMemo);
    }
  };

  for (const fileName of files) {
    const source = program.getSourceFile(fileName);
    if (!source) throw new Error(`render-purity: ${repoRelative(fileName)} is not in the program`);
    const file = repoRelative(fileName);
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
        for (const declaration of statement.declarationList.declarations) {
          for (const element of bindingNames(declaration.name)) {
            const key = `${file} module.${element.text}`;
            const isPhase = file === PHASE.file && element.text === PHASE.name;
            if (!constant && !isPhase) report(key, "module let");
            if (!isPhase) held(checker.getTypeAtLocation(element), key, false);
          }
        }
      }
      if (ts.isClassDeclaration(statement) && statement.name) {
        const symbol = checker.getSymbolAtLocation(statement.name);
        if (!symbol) continue;
        const instance = checker.getDeclaredTypeOfSymbol(symbol);
        if (instance.getProperties().some((p) => RENDER_METHODS.has(p.name))) object(instance, false);
        for (const property of checker.getTypeOfSymbolAtLocation(symbol, statement.name).getProperties()) {
          const decl = property.valueDeclaration;
          if (!decl || !ts.isPropertyDeclaration(decl)) continue;
          const key = keyOf(program, decl, property.name);
          if (!isReadonlyProperty(property)) report(key, "writable static");
          held(checker.getTypeOfSymbol(property), key, false);
        }
      }
    }
  }
  return [...found.values()].sort((a, b) => a.key.localeCompare(b.key) || a.reason.localeCompare(b.reason));
}

function bindingNames(name: ts.BindingName): ts.Identifier[] {
  if (ts.isIdentifier(name)) return [name];
  return name.elements.flatMap((e) => (ts.isOmittedExpression(e) ? [] : bindingNames(e.name)));
}
