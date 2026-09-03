/*
 * Where an identifier sits: naming something, or reading it.
 *
 * One purpose, shared by every rule here that scans for an ambient name.
 * `browser-safe.ts` asks whether the barrel reads `process` at module scope;
 * `ambient-process.ts` asks which files reach the host at all. Both must
 * first discount the `process` that is a property key, an import alias, or
 * somebody's own declaration — the same question, so it lives once.
 *
 * [LAW:effects-at-boundaries] Syntax only. Deciding a slot needs the node
 * and its parent and nothing else, so there is no `ts.Program` here and no
 * file is read; callers hand in an already-parsed tree.
 */

import ts from "typescript";

/**
 * Whether `id` sits in a slot that *names* something rather than reads it.
 *
 * Asking the slot generalises over every declaration kind at once — every
 * one of them puts its own identifier in `.name` — where enumerating the
 * kinds would leave a gap the first time TypeScript grows another.
 */
export function isNameSlot(id: ts.Identifier): boolean {
  const parent = id.parent;
  // `{ process }` is the one `.name` slot that is a read, not a binding.
  if (ts.isShorthandPropertyAssignment(parent)) return false;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === id;
  // An export specifier's local reference is `propertyName ?? name` — and it
  // is local only without a `from` clause. `export { process }` and
  // `export { process as p }` read the binding; add `from "./m.js"` and the
  // same two names index the other module's exports instead.
  if (ts.isExportSpecifier(parent)) {
    // An erased specifier — `export { type process }` — references nothing
    // at runtime, the same question the import side asks in `graph.ts`.
    if (parent.isTypeOnly || parent.parent.parent.isTypeOnly) return true;
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
