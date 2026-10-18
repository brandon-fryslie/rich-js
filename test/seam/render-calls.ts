/*
 * Every `render` of a `Renderable` in `src/` goes through `render` in
 * `src/core/protocol.ts`.
 *
 * Rich draws every renderable through `Console.render`, which yields nothing
 * under one column, so that rule holds everywhere at once. Here a renderable
 * calls its child's `render` itself, and the rule was a check each container
 * had to remember: `Padding`, `Panel`, `Table`, `Markdown` and `Traceback`
 * asked `drawsNothing`, and `Align`, `Columns`, `Layout` and `Group` did not,
 * so a child handed no column was drawn anyway (rich-unfiled-791c.wyrk).
 * `protocol.ts`'s `render` is now the one place that rule is kept, and this is
 * what keeps every call going through it.
 *
 * [LAW:types-are-the-program] The receiver is judged by the checker, not by
 * its spelling: a call is reported when the method is named `render` and the
 * object it is called on is assignable to `Renderable`. `Style.render`, which
 * writes a string's SGR codes, is a different method that shares the name,
 * and the checker tells the two apart where a pattern could not.
 *
 * What it cannot see: a `render` read off the object and called later
 * (`const draw = child.render; draw(o)`), called through `.call` or an
 * element access, or called on a receiver typed as something wider than
 * `Renderable`. None of those shapes is in `src/` today, and each would be
 * drawn without the rule.
 */

import ts from "typescript";
import { repoRelative } from "../../scripts/repo-facts.js";

export interface DirectRenderCall {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** The enforcer itself: the one function whose body may call `render` directly. */
const ENFORCER = { file: "src/core/protocol.ts", name: "render" } as const;

function renderableType(program: ts.Program, checker: ts.TypeChecker): ts.Type {
  const protocol = program.getSourceFiles().find((file) => repoRelative(file.fileName) === ENFORCER.file);
  const symbol = protocol && checker.getSymbolAtLocation(protocol);
  const renderable = symbol && checker.getExportsOfModule(symbol).find((s) => s.name === "Renderable");
  if (!renderable) throw new Error(`render-calls: ${ENFORCER.file} is not in the program or no longer exports Renderable`);
  return checker.getDeclaredTypeOfSymbol(renderable);
}

/** An optional chain's receiver (`child?.render`) is judged by what it is when present. */
function receiverType(checker: ts.TypeChecker, receiver: ts.Expression): ts.Type {
  return checker.getNonNullableType(checker.getTypeAtLocation(receiver));
}

function insideEnforcer(node: ts.Node): boolean {
  if (repoRelative(node.getSourceFile().fileName) !== ENFORCER.file) return false;
  for (let at: ts.Node | undefined = node; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name?.text === ENFORCER.name) return true;
  }
  return false;
}

/** Every call of a `Renderable`'s `render` in `files` that is not the enforcer's own. */
export function directRenderCalls(program: ts.Program, files: readonly string[]): DirectRenderCall[] {
  const checker = program.getTypeChecker();
  const renderable = renderableType(program, checker);
  const found: DirectRenderCall[] = [];
  for (const fileName of files) {
    const source = program.getSourceFile(fileName);
    if (!source) throw new Error(`render-calls: ${repoRelative(fileName)} is not in the program`);
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "render" &&
        checker.isTypeAssignableTo(receiverType(checker, node.expression.expression), renderable) &&
        !insideEnforcer(node)
      ) {
        found.push({
          file: repoRelative(source.fileName),
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          text: node.getText(source).split("\n")[0]!,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}
