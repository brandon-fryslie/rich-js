/*
 * The rule behind `README.md`'s guarantee that "the main barrel stays
 * browser-safe": one pure scan of one parsed file, answering what about it
 * would fail to load in a browser.
 *
 * Two ways a module breaks that guarantee, and they are the whole list:
 *
 *   - it names a `node:*` specifier on an edge that survives to runtime,
 *     which a browser bundler cannot resolve;
 *   - it reads the ambient `process` or `Buffer` global at module scope,
 *     which throws the moment the module is evaluated.
 *
 * Module scope is the line, not the file. `src/core/color.ts` and
 * `src/core/console.ts` both read `process` today, both from inside a
 * function body, and both are correct: the read happens only if a caller
 * asks for the ambient default, and `Console`'s `ambientEnvironment()` is
 * the shape to copy. A module-scope read has no such caller — importing
 * the barrel is enough to trigger it.
 *
 * [LAW:no-mode-explosion] There is no exemption for a `typeof process`
 * guard at module scope, and deliberately so: nothing in `src/` needs one,
 * the fix is always to move the read into a function, and an allowance
 * with no owner is a mode we would carry forever to permit a shape nobody
 * has yet asked to write.
 */

import ts from "typescript";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";
import { runtimeModuleSpecifiers } from "./graph.js";

const NODE_BUILTIN_PREFIX = "node:";

/** Globals a browser does not provide. */
const AMBIENT_GLOBALS = ["process", "Buffer"] as const;
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
    .filter((specifier) => specifier.text.startsWith(NODE_BUILTIN_PREFIX))
    .map(
      (specifier): SeamViolation => ({
        rule: "node-import",
        file,
        line: lineOf(specifier),
        specifier: specifier.text,
      }),
    );

  const globals: SeamViolation[] = [];
  visitModuleScopeReads(sf, (id) => {
    if (!isAmbientGlobal(id.text)) return;
    globals.push({ rule: "ambient-global", file, line: lineOf(id), global: id.text });
  });

  return [...imports, ...globals].sort((a, b) => a.line - b.line);
}

/** A failure line naming the file, the offence, and how the file was reached. */
export function describeViolation(violation: SeamViolation, via: readonly string[]): string {
  const offence =
    violation.rule === "node-import"
      ? `imports ${JSON.stringify(violation.specifier)}`
      : `reads the ambient \`${violation.global}\` global at module scope`;
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
 *   - a function body, which runs when someone calls it, not on import.
 *     Class field initializers are *not* pruned — a field initializer runs
 *     on construction, which a browser bundle reaches as soon as anything
 *     builds the class;
 *   - a type node, which is erased before the module ever runs, so
 *     `let out: Buffer` names nothing at runtime.
 */
export function visitModuleScopeReads(root: ts.Node, onRead: (id: ts.Identifier) => void): void {
  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node)) return;
    if (ts.isIdentifier(node) && !isNameSlot(node)) onRead(node);
    ts.forEachChild(node, (child) => {
      if (isFunctionBody(node, child)) return;
      visit(child);
    });
  };
  visit(root);
}

function isFunctionBody(parent: ts.Node, child: ts.Node): boolean {
  // `isFunctionLike` admits signature types (`ConstructorTypeNode` and
  // friends) that have no body at all — narrow rather than cast.
  return ts.isFunctionLike(parent) && "body" in parent && parent.body === child;
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
  return (parent as Partial<ts.NamedDeclaration>).name === id;
}
