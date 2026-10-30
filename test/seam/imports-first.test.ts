/*
 * [LAW:no-silent-failure] Every module of `src/` imports before it does
 * anything else. Native ESM hoists an import above the module body wherever it
 * is written, so an import placed after a top-level statement that uses it
 * loads fine here and in every consumer running ESM. A consumer that
 * transpiles this package to CommonJS (ts-jest, Babel) emits each `require`
 * where its import sits, and a top-level use above it throws "Cannot access
 * '…' before initialization" while the module loads. That failure shows only
 * in the consumer's build, never in this suite, so this is where it is named.
 *
 * Every import counts, a type-only one included: one rule with no exemption
 * to argue over, and a module reads top to bottom as what it takes, then
 * what it does.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { REPO_ROOT, listTypeScriptFiles } from "../../scripts/repo-facts.js";
import { parseSourceFile } from "./graph.js";

const isImport = (statement: ts.Statement): boolean => ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement);

/** Each import of `source` that follows a statement which is not one, as `file:line`. */
function lateImports(source: ts.SourceFile): string[] {
  const firstBody = source.statements.findIndex((statement) => !isImport(statement));
  return firstBody === -1
    ? []
    : source.statements.slice(firstBody).flatMap((statement) =>
        isImport(statement) ? [`${path.relative(REPO_ROOT, source.fileName)}:${source.getLineAndCharacterOfPosition(statement.getStart()).line + 1}`] : [],
      );
}

const parse = (text: string): ts.SourceFile => ts.createSourceFile(path.join(REPO_ROOT, "fixture.ts"), text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

describe("every module imports before it does anything else", () => {
  it("names an import that follows a statement, and passes one that leads", () => {
    expect(lateImports(parse(`import { a } from "./a.js";\nconst x = b();\nimport { b } from "./b.js";\n`))).toEqual(["fixture.ts:3"]);
    expect(lateImports(parse(`import { a } from "./a.js";\nimport type { B } from "./b.js";\nconst x = a();\n`))).toEqual([]);
  });

  it("holds for every file under src/", () => {
    const files = listTypeScriptFiles("src");
    expect(files.length).toBeGreaterThan(50);
    expect(
      files.flatMap((file) => lateImports(parseSourceFile(file))),
      "an import after a top-level statement loads under native ESM and throws under a CommonJS transpile of this package; move it up with the others",
    ).toEqual([]);
  });
});
