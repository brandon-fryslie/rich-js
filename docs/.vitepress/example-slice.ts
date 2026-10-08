/**
 * A docs block as a program of its own: the block as its page shows it, with
 * what it needs from around it written above it. The build type-checks it,
 * and the block's card holds the block in the same parts (`setup`), which is
 * the program "Try it" opens in the playground.
 *
 * A page is a running document (example-program.ts): a block sees the prelude,
 * the page's `exampleContext` and every block above it. The playground runs one
 * program with nothing around it, so the block's program carries:
 *   - an import for every name it imports or uses, the prelude's included, so
 *     it names what it touches rather than the whole main barrel. The block's
 *     own import lines join these, in the form the page's program gives them;
 *   - the page's `exampleContext`, whole: it is the setup the page tells a
 *     reader its examples assume, and it may not print;
 *   - every statement above it that declares something it or the context
 *     uses, and every statement those use in turn, in the order the page has
 *     them: the prelude's `console`, the declarations of the blocks above it;
 *   - every statement of a block above it that changes one of those, below.
 * Nothing a block above it printed is carried, so a block's program prints what
 * the block printed and not what the blocks above it printed.
 *
 * A card shows the same parts above its block, locked, each labelled with
 * where it came from: "imports", the prelude's `console` ("assumed by every
 * example"), the page's `exampleContext` ("assumed on this page"), or the
 * heading of the block it was carried from ("from 'Basic usage'").
 *
 * The page nests each part in the scope of the one before, so a block may
 * redeclare any name; its program opens a scope where a part redeclares a
 * name above it, and only there.
 *
 * [LAW:one-source-of-truth] What a name refers to is TypeScript's answer, read
 * from the checker over the program the page actually runs, so a block that
 * shadows a name, or redeclares `console`, is read the way it runs. Which
 * statements change a value is a reading of their shape, and can miss one, so
 * the runner holds the result to what the page showed: it type-checks the
 * program alone and runs it, and a program that does not print what its block
 * printed fails the build at the block. A `live` block's program is not run at
 * build; it sees only the context, which is carried whole, so no reading of
 * shape decides it.
 */
import ts from "typescript";
import type { Fence } from "./example-markers.js";
import type { CardSetup } from "./example-card.js";
import { SourceBuilder, importBindings, importLines, splitImports, type ExampleProgram, type ImportBinding } from "./example-program.js";

/** A program the checker has read, and the file in it that is `program`'s source. */
export interface Checked {
  readonly checker: ts.TypeChecker;
  readonly file: ts.SourceFile;
}

/** The names a statement binds in the scope it sits in: none for one that is not a declaration. */
function declaredNames(statement: ts.Statement): string[] {
  const bound = (name: ts.BindingName): string[] =>
    ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : bound(element.name)));
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.flatMap((d) => bound(d.name));
  const named =
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement);
  return named && statement.name !== undefined ? [statement.name.text] : [];
}

/** Whether a declaration is a name an import binds. */
const isImportBinding = (node: ts.Node): boolean => ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node);

/**
 * A block on its own: the program the build type-checks it as, and the same
 * setup around the block as its card holds it (example-card.ts), which "Try
 * it" opens.
 */
export interface Standalone {
  readonly program: ExampleProgram;
  readonly setup: CardSetup;
}

/**
 * Each block of `program`, the program a page runs, on its own, as the
 * checker read it: `target`, one of `program`'s blocks, with what it needs.
 */
export function standalonePrograms(checked: Checked, program: ExampleProgram): (target: Fence) => Standalone {
  const { checker, file } = checked;
  const origin = (node: ts.Node): number | null => program.origins[file.getLineAndCharacterOfPosition(node.getStart(file)).line] ?? null;
  /** The part of the page a statement belongs to: the prelude, the context or one block. */
  const partOf = (statement: ts.Statement): Fence | "prelude" | "context" => {
    const line = origin(statement);
    return line === null ? "prelude" : (program.blocks.find((b) => line > b.line && line < b.closeLine) ?? "context");
  };

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
  const context = statements.filter((s) => partOf(s) === "context");

  // Every name the program's imports bind, as the program binds it, in the
  // order it binds them: one import per name, a barrel value imported as a
  // value however a block wrote it.
  const imported = new Map(file.statements.filter(ts.isImportDeclaration).flatMap(importBindings).map((b) => [b.local, b] as const));
  const order = [...imported.keys()];
  const bare = file.statements
    .filter((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && s.importClause === undefined)
    .map((s) => ({ text: s.getText(file), line: origin(s)! }));

  // The type of the prelude's `console`: a statement that names a value of it writes to the terminal.
  const prelude = statements.find(
    (s): s is ts.VariableStatement =>
      origin(s) === null && ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(file) === "console"),
  );
  const consoleType = prelude === undefined ? undefined : checker.getTypeAtLocation(prelude.declarationList.declarations[0]!.name);
  if (consoleType === undefined) throw new Error(`docs/${program.page}: the program has no prelude console to cut a block's program from`);

  /** What a statement names: the statements declaring it, the imports binding it, and whether it names a console. */
  const read = (statement: ts.Statement) => {
    const declared = new Set<ts.Statement>();
    const bound: ImportBinding[] = [];
    let writes = false;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node);
        for (const declaration of symbol?.declarations ?? []) {
          if (declaration.getSourceFile() !== file) continue;
          // A name that resolves to an import is that import's local name.
          if (isImportBinding(declaration)) bound.push(imported.get(node.text)!);
          const at = statementOf(declaration);
          if (at !== null && at !== statement) declared.add(at);
        }
        writes ||= checker.getTypeAtLocation(node) === consoleType;
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
    return { declared, bound, writes };
  };
  const reading = new Map(statements.map((statement) => [statement, read(statement)]));

  /** A carried statement's text, with its own comments above it, and the page line the text starts on. */
  const carried = (statement: ts.Statement): { text: string; line: number | null } => {
    const start = statement.getStart(file);
    // The trivia before it opens with the rest of the line before it, which
    // is that line's, and the blank lines after that are no one's.
    const comments = file.text
      .slice(statement.getFullStart(), start)
      .replace(/^[^\n]*\n?/, "")
      .replace(/^(?:[ \t]*\n)+/, "");
    const line = program.origins[file.getLineAndCharacterOfPosition(start - comments.length).line] ?? null;
    return { text: comments + file.text.slice(start, statement.end), line };
  };

  return (target) => {
    const inTarget = (statement: ts.Statement) => partOf(statement) === target;
    const first = statements.findIndex(inTarget);
    // [LAW:dataflow-not-control-flow] The block needs its own statements, the
    // context, every statement declaring something a needed statement names,
    // and every statement above it that declares nothing, names something
    // needed and does not write to the terminal: that is a statement which
    // changes a value the block reads, `layout.splitColumn(…)` above a block
    // printing `layout`. One that writes is what an earlier block printed, not
    // what this one needs; one that throws would end the program. One that
    // declares is taken to read what it names and change none of it, which
    // `const col = layout.splitColumn(…)` is the miss of, and the gate's.
    const needed = new Set([...context, ...statements.filter(inTarget)]);
    const above = statements.slice(0, Math.max(first, 0)).filter((s) => !throwing.has(s) && declaredNames(s).length === 0);
    for (let grew = true; grew; ) {
      const before = needed.size;
      for (const statement of [...needed]) reading.get(statement)!.declared.forEach((at) => needed.add(at));
      for (const statement of above) {
        const { declared, writes } = reading.get(statement)!;
        if (!writes && [...declared].some((at) => needed.has(at))) needed.add(statement);
      }
      grew = needed.size > before;
    }
    // Every import a needed statement names, and every one the block writes,
    // in the order the page's imports and then the prelude bind them.
    const own = splitImports(target.code, target.line + 1);
    const ownLocals = new Set(own.imports.flatMap((imp) => (imp.kind === "binding" ? [imp.local] : [])));
    const named = [...needed].flatMap((statement) => reading.get(statement)!.bound.map((binding) => ({ binding, byBlock: inTarget(statement) })));
    const ordered = (bound: readonly ImportBinding[]) =>
      [...new Map([...bound].sort((a, b) => order.indexOf(a.local) - order.indexOf(b.local)).map((b) => [b.local, b] as const)).values()];
    const bindings = ordered([...named.map((n) => n.binding), ...[...ownLocals].map((local) => imported.get(local)!)]);
    // The names the block's own imports bind as the program binds them: not a
    // barrel value the block imports as a type, which the program imports as a value.
    const blockBinds = new Set(own.imports.flatMap((imp) => (imp.kind === "binding" && imp.typeOnly === imported.get(imp.local)!.typeOnly ? [imp.local] : [])));
    // A bare import is run for what it does, so every one the page ran by `end` runs here too.
    const imports = (end: number, bound: readonly ImportBinding[]): Line[] =>
      [...new Set(bare.filter((b) => b.line < end).map((b) => b.text)), ...importLines(bound)].map((text) => ({ text, line: null }));

    // The parts it carries, in page order, each with where it came from and
    // the names it declares, then the block. A part that redeclares a name
    // above it opens the scope the page gives it.
    const parts: { from: Fence | "prelude" | "context"; names: string[]; lines: Line[] }[] = [];
    for (const statement of statements.filter((s) => needed.has(s) && !inTarget(s))) {
      if (partOf(statement) !== parts.at(-1)?.from) parts.push({ from: partOf(statement), names: [], lines: [] });
      parts.at(-1)!.names.push(...declaredNames(statement));
      parts.at(-1)!.lines.push(carried(statement));
    }
    const visible = new Set(bindings.map((b) => b.local));
    const opens = [...parts, { names: statements.filter(inTarget).flatMap(declaredNames) }].map(({ names }) => {
      const redeclares = names.some((name) => visible.has(name));
      names.forEach((name) => visible.add(name));
      return redeclares ? [{ text: "{", line: null }] : [];
    });
    const setup = parts.map((part, i) => ({ from: part.from, lines: [...opens[i]!, ...part.lines] }));
    const blockOpens = opens.at(-1)!;
    const after: Line[] = opens.some((o) => o.length > 0) ? [{ text: "}".repeat(opens.filter((o) => o.length > 0).length), line: null }] : [];

    // The checked program hoists the block's imports into its own, so it
    // type-checks; the block is its lines less the blank ones left where its
    // imports were before its first line.
    const body = own.body.split("\n").map((text, i) => ({ text, line: target.line + 1 + i }));
    const firstLine = body.findIndex(({ text }) => text.trim() !== "");
    const out = new SourceBuilder();
    // A blank line stands between parts, as between blocks on the page.
    [imports(target.closeLine, bindings), ...setup.map((part) => part.lines), [...blockOpens, ...body.slice(firstLine === -1 ? body.length : firstLine)]]
      .filter((lines) => lines.length > 0)
      .forEach((lines, i) => [...(i === 0 ? [] : [{ text: "", line: null }]), ...lines].forEach(({ text, line }) => out.add(text, line)));
    after.forEach(({ text, line }) => out.add(text, line));

    // A card holds the block whole, its imports included, so its setup
    // imports only what the block names and does not import itself, what
    // the setup's own statements name, and the bare imports above the block.
    // [LAW:one-source-of-truth] The parts and their scopes are the ones the checked program carries.
    const cardImports = imports(target.line, ordered(named.filter((n) => !n.byBlock || !blockBinds.has(n.binding.local)).map((n) => n.binding)));
    const setupText = [{ origin: "imports", lines: cardImports }, ...setup.map((part) => ({ origin: originOf(part.from), lines: part.lines }))]
      .filter((part) => part.lines.length > 0)
      .flatMap(({ origin, lines }) => [...lines, { text: "" }].map(({ text }) => ({ origin, text })));
    // The blank line after a part, and the brace opening the block's scope,
    // are the part's above them; neighbouring parts from one place are one group.
    if (blockOpens.length > 0) {
      // [LAW:no-silent-failure] The block's scope is opened against a name its
      // setup binds; a scope with no setup above it is a program this cut has no reading of.
      const last = setupText.at(-1);
      if (last === undefined) throw new Error(`docs/${program.page}:${target.line}: the block opens a scope its card has no setup to put above`);
      setupText.push(...blockOpens.map(({ text }) => ({ origin: last.origin, text })));
    }
    const before: { origin: string; lines: string[] }[] = [];
    for (const { origin, text } of setupText) {
      if (before.at(-1)?.origin !== origin) before.push({ origin, lines: [] });
      before.at(-1)!.lines.push(text);
    }
    return {
      program: { page: program.page, source: out.lines.join("\n"), origins: out.origins, blocks: [target] },
      setup: { before, after: after.map((l) => l.text) },
    };
  };
}

type Line = { readonly text: string; readonly line: number | null };

/** How a card labels a part of its setup by where it came from. */
function originOf(from: Fence | "prelude" | "context"): string {
  if (from === "prelude") return "assumed by every example";
  if (from === "context") return "assumed on this page";
  return from.section === null ? "from above" : `from '${from.section}'`;
}
