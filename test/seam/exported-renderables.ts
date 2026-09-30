/*
 * The exported renderables: every class the package exports whose instances
 * are a `Renderable`, found by the checker from `package.json#exports` rather
 * than by name. The gates that ask something of every renderable a consumer
 * can import — test/seam/line-ends.ts, test/renderables/ascii-only.test.ts —
 * read their universe here, so they cannot disagree about what is in it.
 *
 * An abstract class is not in it: nothing can build one, and each concrete
 * subclass is in it on its own.
 */

import ts from "typescript";
import { collectPublicExports, makeProgram, repoRelative } from "../coverage/extract.js";

/** An exported, constructible class whose instances are `Renderable`s. */
export interface RenderableClass {
  readonly name: string;
  readonly file: string;
}

export function exportedRenderables(): RenderableClass[] {
  const { program, checker } = makeProgram();
  const protocol = program.getSourceFiles().find((file) => file.fileName.endsWith("/src/core/protocol.ts"));
  const protocolSymbol = protocol && checker.getSymbolAtLocation(protocol);
  const renderableSymbol = protocolSymbol && checker.getExportsOfModule(protocolSymbol).find((s) => s.name === "Renderable");
  if (!renderableSymbol) throw new Error("exported-renderables: src/core/protocol.ts no longer exports Renderable");
  const renderable = checker.getDeclaredTypeOfSymbol(renderableSymbol);

  const found = new Map<string, RenderableClass>();
  for (const row of collectPublicExports(program, checker)) {
    const declaration = row.symbol.declarations?.find(ts.isClassDeclaration);
    if (!declaration) continue;
    if (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Abstract) continue;
    if (!checker.isTypeAssignableTo(checker.getDeclaredTypeOfSymbol(row.symbol), renderable)) continue;
    found.set(`${row.origin.file}::${row.origin.name}`, {
      name: row.origin.name,
      file: repoRelative(row.origin.file),
    });
  }
  return [...found.values()];
}
