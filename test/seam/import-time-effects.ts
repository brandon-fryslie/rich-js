/*
 * The rule behind `package.json`'s `"sideEffects": false`: one pure scan of
 * one parsed file, answering whether importing it *does* anything.
 *
 * That field is a promise to every bundler that reads it — any module of this
 * package whose exports go unused may be dropped whole. A module that does its
 * job at import time breaks that promise, and breaks it in the one place the
 * author never looks: the consumer's build, where the symptom is a missing
 * behaviour and the cause is a module that was silently deleted.
 *
 * Two shapes say a module works at import time, and both are decided from
 * statement shape alone:
 *
 *   - a statement at module scope that is not a declaration. A declaration
 *     binds a name; anything else in that position exists to be *run* — the
 *     registration call, the loop that patches a table, the `if` that installs
 *     a polyfill. Two declarations carry a statement list that runs the moment
 *     the declaration does, and module scope therefore reaches inside both: a
 *     class's `static {}` blocks, and a `namespace`'s body, which TypeScript
 *     emits as an IIFE. Miss either and a scan over top-level statements is
 *     bypassed by writing the same call one nesting level down;
 *   - `import "./x.js"` with no bindings, which names a module for its effects
 *     and nothing else. Under this field that import is the first thing a
 *     bundler is entitled to drop.
 *
 * [LAW:enumeration-gap] The accept list is the declaration kinds, and every
 * other kind reports. Written the other way — a list of effectful kinds — a
 * grammar form nobody thought of would pass, and a scan that passes by not
 * recognising something reports "safe" for the reason it should have reported
 * "broken".
 *
 * WHAT THIS CANNOT SEE, stated plainly because a guard's blind spot read as
 * coverage is worse than no guard: an expression's contents. `export const T =
 * defineTheme(…)` is accepted on its shape, and whether `defineTheme` writes to
 * something outside the module is a question about a callee's body that no
 * syntactic rule answers. Purity of module-scope initialisers is held by the
 * other kind of evidence instead — a consumer bundle built with the field on,
 * run, and compared byte-for-byte against the same program built without it.
 * That measurement is recorded on ticket rich-packaging-1xv.4.
 *
 * A class evaluates more than its static blocks when it is declared: its
 * decorators, its `extends` clause, its computed member names and its static
 * field initialisers all run then, and every one of them is this same limit
 * rather than an undisclosed second one — `@register class C {}` and `static y =
 * register(C)` are accepted. Extending the rule over those positions is not
 * available: `src/widgets/` decorates with mobx's `@observable` and
 * `src/core/highlighter.ts` declares `static baseStyle = ""`, both of which
 * evaluate on import and do nothing, so a rule there would have to sort a
 * harmless expression from a working one. That is the judgement this file
 * refuses everywhere else, and buying it here would cost the rule its edge.
 */

import ts from "typescript";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";

/**
 * One reason importing a module is not free.
 *
 * [LAW:types-are-the-program] The two shapes carry different evidence — a
 * grammar kind versus a specifier — so they are two variants rather than one
 * record with both fields optional, and a reader of a failure gets the field
 * that exists.
 */
export type ImportTimeEffect =
  | {
      readonly rule: "effectful-statement";
      readonly file: string;
      readonly line: number;
      readonly kind: string;
    }
  | {
      readonly rule: "effect-only-import";
      readonly file: string;
      readonly line: number;
      readonly specifier: string;
    };

/** Every reason importing `sf` would do work, in source order. */
export function importTimeEffects(sf: ts.SourceFile): ImportTimeEffect[] {
  // A declaration file emits nothing, so nothing in it can run. The sweep
  // matches `.d.ts` — it asks for every `.ts` under `src/` — and this is the
  // whole-file form of the fact `declare` carries on a single namespace.
  if (sf.isDeclarationFile) return [];

  const file = path.relative(REPO_ROOT, sf.fileName);
  const lineOf = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const effects: ImportTimeEffect[] = [];
  for (const statement of sf.statements) {
    if (isEffectOnlyImport(statement)) {
      effects.push({
        rule: "effect-only-import",
        file,
        line: lineOf(statement),
        specifier: statement.moduleSpecifier.getText(sf).slice(1, -1),
      });
      continue;
    }
    for (const node of runAtImport(statement)) {
      effects.push({
        rule: "effectful-statement",
        file,
        line: lineOf(node),
        kind: ts.SyntaxKind[node.kind]!,
      });
    }
  }
  return effects.sort((a, b) => a.line - b.line);
}

/** A failure line naming the file, the offence, and what to do about it. */
export function describeEffect(effect: ImportTimeEffect): string {
  // The kind name leads rather than following an article, because the kinds
  // take both ("an IfStatement", "a ForOfStatement") and a rule that has to
  // pick one gets it wrong half the time.
  const offence =
    effect.rule === "effect-only-import"
      ? `imports ${JSON.stringify(effect.specifier)} for its side effects alone`
      : `${effect.kind} runs when the module is imported`;
  return `  ${effect.file}:${effect.line} — ${offence}`;
}

/**
 * The nodes `statement` executes when the module is imported.
 *
 * A declaration contributes no *statement* of its own, and two of them hide a
 * statement list in their body — a class's static blocks, and a namespace's
 * whole body, which TypeScript emits as an IIFE that runs when the module does.
 * Both get the same rule rather than a second rule shaped like it, which is why
 * this recurses: a namespace body is module scope by another name.
 *
 * What a declaration *evaluates* is a wider set than what it runs as
 * statements — the header names it, and names why this rule stops there.
 */
function runAtImport(statement: ts.Statement): ts.Node[] {
  if (!isDeclaration(statement)) return [statement];
  if (ts.isClassDeclaration(statement)) {
    return statement.members.filter(ts.isClassStaticBlockDeclaration);
  }
  if (ts.isModuleDeclaration(statement)) return namespaceStatements(statement);
  return [];
}

/**
 * The statements a `namespace`'s body runs when the module is evaluated.
 *
 * A `declare` namespace emits no code, so its body never runs. The walk enters
 * from the top of the file, so a namespace nested inside an ambient one is
 * never reached to be asked — the outer `declare` stops it, which is the same
 * answer one level cheaper.
 *
 * `namespace A.B { … }` carries a `ModuleDeclaration` as its own body rather
 * than a block, so closing the plain form without following that one would
 * leave the dotted spelling as the hole.
 */
function namespaceStatements(node: ts.ModuleDeclaration): ts.Node[] {
  if (isAmbient(node) || node.body === undefined) return [];
  if (ts.isModuleDeclaration(node.body)) return namespaceStatements(node.body);
  return ts.isModuleBlock(node.body) ? node.body.statements.flatMap(runAtImport) : [];
}

function isAmbient(node: ts.ModuleDeclaration): boolean {
  return (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
}

/**
 * Whether `statement` exists to bind a name rather than to be run.
 *
 * `export default expr` and a variable statement evaluate an expression and are
 * still declarations: what they evaluate is an initialiser, which the header
 * names as the limit of this scan rather than pretending to judge here.
 */
function isDeclaration(statement: ts.Statement): boolean {
  return (
    ts.isImportDeclaration(statement) ||
    ts.isImportEqualsDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isExportAssignment(statement) ||
    ts.isVariableStatement(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  );
}

/** `import "./x.js"` — a module named for its effects and nothing else. */
function isEffectOnlyImport(statement: ts.Statement): statement is ts.ImportDeclaration {
  return ts.isImportDeclaration(statement) && statement.importClause === undefined;
}
