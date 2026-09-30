/**
 * A docs block as a program of its own: the block as its page shows it, with
 * what it needs from around it written above it. That is the program "Try it"
 * opens in the playground.
 *
 * A page is a running document (example-program.ts): a block sees the prelude,
 * the page's `exampleContext` and every block above it. The playground runs one
 * program with nothing around it, so the block's program carries what the
 * block reads from that document and nothing else:
 *   - an import for every name it imports or uses, the prelude's included, so
 *     it names what it touches rather than the whole main barrel. The block's
 *     own import lines join these, in the form the page's program gives them;
 *   - every statement above it that declares something it uses, and every
 *     statement those use in turn, in the order the page has them: the
 *     prelude's `console`, the lines of the context it reads, the declarations
 *     of the blocks above it;
 *   - every statement above it that changes one of those, below.
 * Nothing that only printed is carried, so a block's program prints what the
 * block printed and not what the blocks above it printed.
 *
 * [LAW:one-source-of-truth] What a name refers to is TypeScript's answer, read
 * from the checker over the program the page actually runs, so a block that
 * shadows a name, or redeclares `console`, is read the way it runs. Which
 * statements change a value is a reading of their shape, and can miss one, so
 * the runner holds the result to what the page showed: it type-checks the
 * program alone and runs it, and a program that does not print what its block
 * printed fails the build at the block.
 */
import ts from "typescript";
import type { Fence } from "./example-markers.js";
import type { ExampleProgram } from "./example-program.js";

/** A program the checker has read, and the file in it that is `program`'s source. */
export interface Checked {
  readonly checker: ts.TypeChecker;
  readonly file: ts.SourceFile;
}

/** One name an import binds: the export, where it comes from, and whether only its type is used. */
interface Binding {
  /** Where the import binding it stands in the program. */
  readonly at: number;
  readonly local: string;
  readonly from: string;
  /** The export's name: `default` for a default import, `*` for a namespace. */
  readonly imported: string;
  readonly typeOnly: boolean;
}

/** The binding an import declaration node makes, or null for a node that is not one. */
function bindingOf(node: ts.Node): Binding | null {
  const clause =
    ts.isImportSpecifier(node) ? node.parent.parent
    : ts.isNamespaceImport(node) ? node.parent
    : ts.isImportClause(node) ? node
    : null;
  if (clause === null) return null;
  const from = (clause.parent.moduleSpecifier as ts.StringLiteral).text;
  const typeOnly = clause.isTypeOnly || (ts.isImportSpecifier(node) && node.isTypeOnly);
  const at = node.getStart();
  if (ts.isImportSpecifier(node)) return { at, local: node.name.text, from, imported: node.propertyName?.text ?? node.name.text, typeOnly };
  if (ts.isNamespaceImport(node)) return { at, local: node.name.text, from, imported: "*", typeOnly };
  return { at, local: clause.name!.text, from, imported: "default", typeOnly };
}

/**
 * The import lines that bind `bindings`: one line per module, in the order the
 * modules were first imported, a default or namespace import on a line of its own.
 */
function importLines(bindings: readonly Binding[]): string[] {
  const modules = new Map<string, Binding[]>();
  for (const binding of bindings) modules.set(binding.from, [...(modules.get(binding.from) ?? []), binding]);
  return [...modules].flatMap(([from, bound]) => {
    const quoted = JSON.stringify(from);
    const type = (b: Binding) => (b.typeOnly ? "type " : "");
    const named = bound.filter((b) => b.imported !== "*" && b.imported !== "default");
    return [
      ...bound.filter((b) => b.imported === "default").map((b) => `import ${type(b)}${b.local} from ${quoted};`),
      ...bound.filter((b) => b.imported === "*").map((b) => `import ${type(b)}* as ${b.local} from ${quoted};`),
      ...(named.length === 0
        ? []
        : [`import { ${named.map((b) => `${type(b)}${b.imported === b.local ? b.local : `${b.imported} as ${b.local}`}`).join(", ")} } from ${quoted};`]),
    ];
  });
}

/**
 * A block's code split into its imports and the rest: the names and bare
 * imports it imports, and its other lines, each with the page line it is on.
 */
function splitBlock(target: Fence): { locals: string[]; bare: string[]; lines: { text: string; line: number }[] } {
  const file = ts.createSourceFile("block.ts", target.code, ts.ScriptTarget.ES2022, true);
  const imports = file.statements.filter(ts.isImportDeclaration);
  const importLines = new Set(
    imports.flatMap((statement) => {
      const [from, to] = [statement.getStart(file), statement.end].map((at) => file.getLineAndCharacterOfPosition(at).line);
      return Array.from({ length: to! - from! + 1 }, (_, i) => from! + i);
    }),
  );
  const lines = target.code
    .split("\n")
    .map((text, i) => ({ text, line: target.line + 1 + i }))
    .filter((_, i) => !importLines.has(i));
  return {
    locals: imports.flatMap((statement) => {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      return [
        ...(clause?.name === undefined ? [] : [clause.name.text]),
        ...(bindings === undefined ? [] : ts.isNamespaceImport(bindings) ? [bindings.name.text] : bindings.elements.map((e) => e.name.text)),
      ];
    }),
    bare: imports.filter((statement) => statement.importClause === undefined).map((statement) => statement.getText(file)),
    // The blank lines left where its imports were, before its first line, are not its own.
    lines: lines.filter((_, i) => lines.slice(0, i + 1).some(({ text }) => text.trim() !== "")),
  };
}

/** Whether a statement is a declaration, binding a name in the scope it sits in. */
const declares = (statement: ts.Statement): boolean =>
  ts.isVariableStatement(statement) ||
  ts.isFunctionDeclaration(statement) ||
  ts.isClassDeclaration(statement) ||
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  ts.isEnumDeclaration(statement) ||
  ts.isModuleDeclaration(statement);

/**
 * The program of each block of `program`, the program a page runs, as the
 * checker read it: `target`, one of `program`'s blocks, with what it needs.
 */
export function standalonePrograms(checked: Checked, program: ExampleProgram): (target: Fence) => ExampleProgram {
  const { checker, file } = checked;
  const origin = (node: ts.Node): number | null => program.origins[file.getLineAndCharacterOfPosition(node.getStart(file)).line] ?? null;

  // The statements a page line or the prelude wrote at the level of a part:
  // the file's own and those in the scopes the program opens, never the
  // program's containers themselves, and never an import, which is a binding.
  // A statement in a `throws` block's `try` is one that throws.
  const statements: ts.Statement[] = [];
  const throwing = new Set<ts.Statement>();
  const collect = (list: ts.NodeArray<ts.Statement>, throws: boolean): void => {
    for (const statement of list) {
      if (ts.isImportDeclaration(statement)) continue;
      if (origin(statement) === null && ts.isBlock(statement)) collect(statement.statements, throws);
      else if (origin(statement) === null && ts.isTryStatement(statement)) collect(statement.tryBlock.statements, true);
      else {
        statements.push(statement);
        if (throws) throwing.add(statement);
      }
    }
  };
  collect(file.statements, false);
  const owner = new Set<ts.Node>(statements);
  const statementOf = (node: ts.Node): ts.Statement | null => {
    for (let at: ts.Node | undefined = node; at !== undefined; at = at.parent) if (owner.has(at)) return at as ts.Statement;
    return null;
  };

  // The class of the prelude's `console`: a statement that names a value of it writes to the terminal.
  const prelude = statements.find(
    (s): s is ts.VariableStatement =>
      origin(s) === null && ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(file) === "console"),
  );
  const consoleClass = prelude === undefined ? undefined : checker.getTypeAtLocation(prelude.declarationList.declarations[0]!.name).getSymbol();
  if (consoleClass === undefined) throw new Error(`docs/${program.page}: the program has no prelude console to cut a block's program from`);

  /** What a statement names: the statements declaring it, the imports binding it, and whether it names a console. */
  const read = (statement: ts.Statement) => {
    const declared = new Set<ts.Statement>();
    const bound: Binding[] = [];
    let writes = false;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node);
        for (const declaration of symbol?.declarations ?? []) {
          if (declaration.getSourceFile() !== file) continue;
          const binding = bindingOf(declaration);
          const at = binding === null ? statementOf(declaration) : null;
          if (binding !== null) bound.push(binding);
          if (at !== null && at !== statement) declared.add(at);
        }
        writes ||= checker.getTypeAtLocation(node).getSymbol() === consoleClass;
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
    return { declared, bound, writes };
  };
  const reading = new Map(statements.map((statement) => [statement, read(statement)]));
  // Every name the program's imports bind, as the program binds it: one import
  // per name, a barrel value imported as a value however a block wrote it.
  const imported = new Map(
    file.statements.filter(ts.isImportDeclaration).flatMap((statement) => {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      const nodes: ts.Node[] = [
        ...(clause?.name === undefined ? [] : [clause]),
        ...(bindings === undefined ? [] : ts.isNamespaceImport(bindings) ? [bindings] : bindings.elements),
      ];
      return nodes.map((node) => bindingOf(node)!).map((binding) => [binding.local, binding] as const);
    }),
  );

  return (target) => {
    const inTarget = (statement: ts.Statement) => {
      const line = origin(statement);
      return line !== null && line > target.line && line < target.closeLine;
    };
    const first = statements.findIndex(inTarget);
    // [LAW:dataflow-not-control-flow] The block needs every statement declaring
    // something a needed statement names, and every statement above it that
    // declares nothing, names something needed and does not write to the
    // terminal: that is a statement which changes a value the block reads,
    // `layout.splitColumn(…)` above a block printing `layout`. One that writes is
    // what an earlier block printed, not what this one needs; one that throws
    // would end the program; one that declares only reads what it names, and
    // its name could be the block's own.
    const needed = new Set(statements.filter(inTarget));
    const above = statements.slice(0, Math.max(first, 0)).filter((s) => !throwing.has(s) && !declares(s));
    for (let grew = true; grew; ) {
      const before = needed.size;
      for (const statement of [...needed]) reading.get(statement)!.declared.forEach((at) => needed.add(at));
      for (const statement of above) {
        const { declared, writes } = reading.get(statement)!;
        if (!writes && [...declared].some((at) => needed.has(at))) needed.add(statement);
      }
      grew = needed.size > before;
    }
    // Every import the block writes, and every one it or a statement it needs
    // names, in the order the page's imports and then the prelude bind them.
    const own = splitBlock(target);
    const bindings = new Map(
      [...[...needed].flatMap((statement) => reading.get(statement)!.bound), ...own.locals.map((local) => imported.get(local)!)]
        .sort((a, b) => a.at - b.at)
        .map((b) => [b.local, b] as const),
    );

    const out = { lines: [] as string[], origins: [] as (number | null)[] };
    const add = (text: string, line: number | null) =>
      text.split("\n").forEach((piece, i) => {
        out.lines.push(piece);
        out.origins.push(line === null ? null : line + i);
      });
    const header = [...own.bare, ...importLines([...bindings.values()])];
    header.forEach((line) => add(line, null));

    // A part is the prelude, the context or one block; its statements go
    // together, and a blank line stands between parts, as between blocks on the page.
    const partOf = (line: number | null) => (line === null ? "prelude" : (program.blocks.find((b) => line > b.line && line < b.closeLine) ?? "context"));
    let part: unknown = header.length === 0 ? undefined : "imports";
    for (const statement of statements.filter((s) => needed.has(s) && !inTarget(s))) {
      // A statement's own comments above it come with it; the blank lines above them do not.
      const text = file.text.slice(statement.getFullStart(), statement.end).replace(/^(?:[ \t]*\n)+/, "");
      const line = program.origins[file.getLineAndCharacterOfPosition(statement.end - text.length).line] ?? null;
      if (part !== undefined && partOf(line) !== part) add("", null);
      part = partOf(line);
      add(text, line);
    }
    if (part !== undefined) add("", null);
    own.lines.forEach(({ text, line }) => add(text, line));
    return { page: program.page, source: out.lines.join("\n"), origins: out.origins, blocks: [target] };
  };
}
