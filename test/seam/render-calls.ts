/*
 * Every `render` of a `Renderable` in `src/` goes through `render` in
 * `src/core/protocol.ts`, and every `measure` of a `Measurable` through its
 * `measure`.
 *
 * Rich draws every renderable through `Console.render`, which yields nothing
 * under one column, so that rule holds everywhere at once. Here a renderable
 * calls its child's `render` itself, and the rule was a check each container
 * had to remember: `Padding`, `Panel`, `Table`, `Markdown` and `Traceback`
 * asked `drawsNothing`, and `Align`, `Columns`, `Layout` and `Group` did not,
 * so a child handed no column was drawn anyway (rich-unfiled-791c.wyrk).
 * `protocol.ts`'s `render` is now the one place that rule is kept, and this is
 * what keeps every call going through it. The two are also where a render pass
 * is entered, so a call around them is a render that a `State` cannot see.
 *
 * [LAW:types-are-the-program] The receiver is judged by the checker, not by
 * its spelling: a call is reported when the method is named `render` and the
 * object it is called on is assignable to `Renderable`. `Style.render`, which
 * writes a string's SGR codes, is a different method that shares the name,
 * and the checker tells the two apart where a pattern could not. `measure` is judged the same way against `Measurable`.
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

const PROTOCOL = "src/core/protocol.ts";

/**
 * Each method the protocol draws through, the interface whose method it is,
 * and the one function in `PROTOCOL` whose body may call it directly — its
 * namesake.
 */
const ENFORCED = [
  { method: "render", receiver: "Renderable" },
  { method: "measure", receiver: "Measurable" },
] as const;

function protocolType(program: ts.Program, checker: ts.TypeChecker, name: string): ts.Type {
  const protocol = program.getSourceFiles().find((file) => repoRelative(file.fileName) === PROTOCOL);
  const symbol = protocol && checker.getSymbolAtLocation(protocol);
  const exported = symbol && checker.getExportsOfModule(symbol).find((s) => s.name === name);
  if (!exported) throw new Error(`render-calls: ${PROTOCOL} is not in the program or no longer exports ${name}`);
  return checker.getDeclaredTypeOfSymbol(exported);
}

/** An optional chain's receiver (`child?.render`) is judged by what it is when present. */
function receiverType(checker: ts.TypeChecker, receiver: ts.Expression): ts.Type {
  return checker.getNonNullableType(checker.getTypeAtLocation(receiver));
}

function insideEnforcer(node: ts.Node, name: string): boolean {
  if (repoRelative(node.getSourceFile().fileName) !== PROTOCOL) return false;
  for (let at: ts.Node | undefined = node; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name?.text === name) return true;
  }
  return false;
}

/**
 * Every call of a `Renderable`'s `render` or a `Measurable`'s `measure` in
 * `files` that is not its enforcer's own.
 */
export function directRenderCalls(program: ts.Program, files: readonly string[]): DirectRenderCall[] {
  const checker = program.getTypeChecker();
  const enforced = ENFORCED.map((e) => ({ method: e.method, receiver: protocolType(program, checker, e.receiver) }));
  const found: DirectRenderCall[] = [];
  for (const fileName of files) {
    const source = program.getSourceFile(fileName);
    if (!source) throw new Error(`render-calls: ${repoRelative(fileName)} is not in the program`);
    const visit = (node: ts.Node): void => {
      const call = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) ? node.expression : undefined;
      const rule = call && enforced.find((e) => e.method === call.name.text);
      if (
        call &&
        rule &&
        checker.isTypeAssignableTo(receiverType(checker, call.expression), rule.receiver) &&
        !insideEnforcer(node, rule.method)
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
