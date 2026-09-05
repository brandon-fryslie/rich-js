/*
 * The TypeScript code blocks on a documentation page, and what they import.
 *
 * Parsing only — markdown text in, blocks out. No file is read here and no
 * compiler is built, so the rules above can be exercised against fixture
 * strings rather than against the real `docs/` tree.
 * [LAW:effects-at-boundaries] The `.test.ts` beside this file owns the sweep.
 *
 * WHAT THIS DOES NOT DO, and it is the load-bearing decision on this page.
 * It does not compile the blocks. That was measured before it was decided:
 * extracting all 211 blocks and type-checking them one file apiece produces
 * 145 failing files, and reading the first failure on each of the 25 pages
 * shows the great majority are not defects at all. Two genre properties of a
 * documentation page account for them:
 *
 *   - A page is a running document. `docs/markup.md` writes `console.print(…)`
 *     in its first block and constructs the `Console` five sections later,
 *     because a reader assembling one program does not need the import
 *     repeated. Compiled alone, every such block is undefined-name noise.
 *   - A page elides. `progress.md` calls `doStep()`, `traceback.md` calls
 *     `riskyOperation()`, `columns.md` maps over `items` — placeholders that
 *     stand for the reader's own code and are the clearest way to write the
 *     example.
 *
 * A gate that went green on those would have to tax every future page for its
 * elisions; that is a larger and different piece of work than this one, and
 * pretending otherwise would have bought a green bar with a worse docs site.
 * [LAW:carrying-cost]
 *
 * What survives is exact: a name a page imports from this package either is
 * exported from that entry point or is not, and a member it calls on a class
 * the page itself constructed either exists on that class or does not. Both
 * are the ghost-symbol failure this gate was built for. The ceiling above them
 * is stated in `symbol-existence.test.ts` and is real — see it before reading
 * a green bar as "this page is true".
 *
 * Blocks are parsed, never pattern-matched. The first version of this file
 * scanned lines with regexes and reported four defects that were not defects:
 * `docs/tree.md` builds a file tree whose leaves are strings like
 * `"console.test.ts"`, and `docs/console.md` opens with the comment
 * `// shared/console.ts`. To a regex those are indistinguishable from
 * `console.print(…)`; to a parser one is a string literal, one is trivia, and
 * neither is a property access. A check that invents findings is worse than no
 * check, because someone will eventually edit a correct page to silence it.
 * [LAW:types-are-the-program]
 */

import ts from "typescript";

/** A fenced code block, with the page and line a failure should be reported at. */
export interface CodeBlock {
  readonly page: string;
  /** 1-based line of the block's opening fence. */
  readonly line: number;
  readonly code: string;
}

/** A name a page imports from one of this package's entry points. */
export interface ImportedName {
  readonly page: string;
  readonly line: number;
  /** The specifier as written, e.g. `@promptctl/rich-js/widgets`. */
  readonly specifier: string;
  /** The name in the entry module — the `escape` of `escape as escapeMarkup`. */
  readonly name: string;
  /** The name the page then writes — the `escapeMarkup` of the same import. */
  readonly local: string;
}

/**
 * A member read off a receiver the page built, e.g. the `print` of
 * `console.print(…)` where the page wrote `const console = new Console()`.
 *
 * [LAW:types-are-the-program] The receiver travels as a class name plus the
 * member path taken from it, never as the source text. `console.print` gives
 * `("Console", [], "print")`; `layout.getByName("body")!.update` gives
 * `("Layout", ["getByName"], "update")`; `progress.console.print` gives
 * `("Progress", ["console"], "print")`. The caller resolves each hop through
 * what that member yields, which is why unwrapping the `!` is not what this
 * needed — a chain is data, and one resolver walks any depth of it.
 *
 * That distinction has already cost coverage once: the first version of this
 * file recorded a use only when the receiver was a bare identifier, and the
 * `getByName(name)!` pattern that `docs/layout.md` uses throughout was
 * invisible to the check that shipped in the same commit as the page.
 */
export interface MemberUse {
  readonly page: string;
  readonly line: number;
  /** The class the chain is rooted in, e.g. `Layout`. */
  readonly rootClass: string;
  /** Members read between the root and this one, outermost last. */
  readonly path: readonly string[];
  readonly member: string;
  /**
   * Whether the root is the class *object* rather than an instance of it —
   * `Table.grid()` versus `new Table()`.
   *
   * One fact about where the chain begins, not a flag per hop, because only the
   * first step can read a static: everything after `Table.grid()` is an instance
   * again. The caller picks which side of the class to look the first step up
   * on. [LAW:types-are-the-program]
   */
  readonly rootIsClassObject: boolean;
  /** How the source reads, for the failure message. */
  readonly text: string;
}


const FENCE_OPEN = /^```(?:typescript|ts)\s*$/;
const FENCE_CLOSE = /^```\s*$/;

/**
 * Every TypeScript block on one page, in source order.
 *
 * Both spellings of the info string are accepted because `docs/` uses both —
 * 210 blocks say `typescript` and one says `ts`, and a reader cannot see which
 * a page chose. Matching the site's own renderer is the only defensible rule.
 */
export function extractCodeBlocks(page: string, markdown: string): CodeBlock[] {
  const lines = markdown.split("\n");
  const blocks: CodeBlock[] = [];
  let openedAt: number | null = null;
  lines.forEach((line, index) => {
    const inBlock = openedAt !== null;
    if (!inBlock && FENCE_OPEN.test(line)) {
      openedAt = index;
      return;
    }
    if (openedAt !== null && FENCE_CLOSE.test(line)) {
      blocks.push({
        page,
        line: openedAt + 1,
        code: lines.slice(openedAt + 1, index).join("\n"),
      });
      openedAt = null;
    }
  });
  // An unterminated fence would otherwise swallow the rest of the page into a
  // block nobody checks, shrinking the sweep silently — the failure the
  // sweep-sanity assertions next door exist to make impossible.
  // [LAW:no-silent-failure]
  if (openedAt !== null) {
    throw new Error(
      `docs/${page}:${(openedAt as number) + 1} opens a TypeScript fence that is ` +
        `never closed; everything after it would go unchecked`,
    );
  }
  return blocks;
}

/**
 * Parse one block on its own.
 *
 * A docs block is a fragment and often not a valid program — that is expected
 * and does not matter here, because the parser recovers and still produces a
 * tree over everything it did understand. Nothing downstream reads diagnostics.
 */
function parseBlock(block: CodeBlock): ts.SourceFile {
  return ts.createSourceFile(
    `${block.page}:${block.line}.ts`,
    block.code,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
  );
}

/** The 1-based line in the page that a node inside a block sits on. */
function pageLineOf(block: CodeBlock, source: ts.SourceFile, node: ts.Node): number {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return block.line + 1 + line;
}

/**
 * Every name every block on the page imports, from any specifier.
 *
 * Filtering to this package's entry points is the caller's job — the rule that
 * knows which specifiers are ours is the one that holds `package.json`. Pages
 * legitimately import `express` and `mobx` to show integration, and dropping
 * those here would hide them from a caller that might want to say so.
 *
 * Named imports only. `import * as ns` names a module rather than any export
 * of it — the same exclusion the demo-coverage gate makes for the same reason
 * — and a default import names whatever the module chose to call its default.
 */
export function extractImportedNames(block: CodeBlock): ImportedName[] {
  return importedNamesIn(block, parseBlock(block)).map((found) => found.imported);
}

/**
 * The same walk, over a source the caller already parsed, keeping each import's
 * node so a caller that needs to order imports against other page positions can.
 */
function importedNamesIn(
  block: CodeBlock,
  source: ts.SourceFile,
): { imported: ImportedName; node: ts.Node }[] {
  const names: { imported: ImportedName; node: ts.Node }[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      names.push({
        node: element,
        imported: {
          page: block.page,
          line: pageLineOf(block, source, element),
          specifier: statement.moduleSpecifier.text,
          // `escape as escapeMarkup` is exported as `escape`; the local alias is
          // the page's business, not the entry module's — but the member check
          // needs both halves, because the page writes the alias.
          name: (element.propertyName ?? element.name).text,
          local: element.name.text,
        },
      });
    }
  }
  return names;
}

/**
 * Every member read off a receiver the page built, across the whole page.
 *
 * A page is one running document, so the scan is page-wide: `markup.md` writes
 * `console.print` in its first block and constructs its `Console` five sections
 * later, and a block-scoped binding would report every one of those calls as
 * unresolved — a check that manufactures its own findings, which is the trap
 * that produced 66 fictional `Property 'print' does not exist on type
 * 'Console'` errors when an earlier attempt let the ambient `console` global
 * bind instead of the page's own.
 *
 * Page-wide is not the same as last-one-wins, and the difference is
 * load-bearing; `nearestBinding` below owns that rule and its evidence.
 *
 * `ourSpecifiers` is the set of module specifiers this package owns, passed
 * rather than imported: the rule that knows which specifiers are ours is the
 * one that holds `package.json`, and this file stays a parser.
 * [LAW:effects-at-boundaries]
 */
export function extractMemberUses(
  blocks: readonly CodeBlock[],
  ourSpecifiers: ReadonlySet<string>,
): MemberUse[] {
  const parsed = blocks.map((block) => ({ block, source: parseBlock(block) }));

  // Declarations in page order, so "nearest" below is a distance on this list.
  //
  // A declaration binds a name to whatever receiver its initializer describes,
  // which is the same question `describeReceiver` answers for a use — so it is
  // asked with the same function, and `const grid = Table.grid()` records the
  // chain `Table` + `["grid"]` exactly as `Table.grid().addRow(…)` does.
  // [LAW:single-enforcer] This used to demand `new X()` and drop anything else,
  // which silently took every member call on a static-factory receiver out of
  // the gate: `docs/tables.md`'s grid section and `docs/style.md`'s
  // `Style.parse` section were unchecked, and nothing reported that they were.
  //
  // A declaration whose initializer describes no receiver — `const output:
  // string[] = []` — is still recorded, with nothing to follow. Dropping it
  // outright would leave the name looking unbound, and the fallback-forward rule
  // would then hand it a *different* declaration further down the page:
  // `docs/console.md` binds `output` to an array in one section and to
  // `console.endCapture()` in another, and the check reported the array's
  // members against a string. A name a page binds is bound.
  // [LAW:parse-dont-validate]
  const declarations: Binding<Receiver | undefined>[] = [];
  parsed.forEach(({ source }, blockIndex) => {
    visit(source, (node) => {
      if (!ts.isVariableDeclaration(node)) return;
      if (!ts.isIdentifier(node.name)) return;
      const initializer = unwrapAwait(node.initializer);
      if (!initializer) return;
      declarations.push({
        ordinal: ordinalOf(blockIndex, source, node),
        name: node.name.text,
        value: describeReceiver(initializer),
      });
    });
  });

  // What each imported name is called in its entry module. A page writing
  // `import { Console as RichConsole }` then `new RichConsole()` names a class
  // the caller's surface map has never heard of, and the caller drops receivers
  // it does not recognize — so the alias would silently take the whole page's
  // member calls out of the check. [LAW:one-source-of-truth] the same import
  // walk answers this that answers the import check.
  //
  // Only imports from `ourSpecifiers` bind. Translating an alias from a module
  // this package does not own turns a safe drop into a confident wrong answer:
  // `import { Layout as X } from "some-other-lib"` would resolve `new X()` to
  // *our* `Layout` and check a third-party object's members against a class it
  // has nothing to do with. Unrecognized is the correct outcome there.
  // [LAW:no-silent-failure]
  const aliases: Binding<string>[] = [];
  parsed.forEach(({ block, source }, blockIndex) => {
    for (const { imported, node } of importedNamesIn(block, source)) {
      if (!ourSpecifiers.has(imported.specifier)) continue;
      aliases.push({
        ordinal: ordinalOf(blockIndex, source, node),
        name: imported.local,
        value: imported.name,
      });
    }
  });

  // The name the page wrote, as its entry module exports it.
  const unaliased = (local: string, ordinal: number): string =>
    nearestBinding(aliases, local, ordinal)?.value ?? local;

  /**
   * What a chain root is rooted in, following variables back to their origin.
   *
   * Three answers, and `docs/` needs all three. `new Table()` names its class on
   * the spot. `grid`, declared from `Table.grid()`, is a variable whose own
   * receiver has to be resolved and whose path prefixes the use's — so this
   * recurses, and `seen` is what stops `const a = b.x; const b = a.y` from
   * recursing forever. A bare `Table` the page declared nothing for, but *did*
   * import from this package, is the class object itself; that is the whole
   * trick that makes a static factory resolvable, and it is why the root carries
   * `rootIsClassObject` outward rather than being flattened into a class name
   * here.
   *
   * A declaration answers even when it bound nothing followable, because the
   * name is taken either way: falling through to the imports would resolve a
   * page's own `const table = […]` to this package's `Table` and check an
   * array's members against it.
   */
  const resolveRoot = (
    root: ChainRoot,
    ordinal: number,
    seen: ReadonlySet<string>,
  ): ResolvedRoot | undefined => {
    if (root.kind === "class") {
      return { className: unaliased(root.name, ordinal), path: [], rootIsClassObject: false };
    }
    if (seen.has(root.name)) return undefined;
    const declared = nearestBinding(declarations, root.name, ordinal);
    if (declared) {
      const bound = declared.value;
      if (!bound) return undefined;
      const inner = resolveRoot(bound.root, ordinal, new Set([...seen, root.name]));
      return inner && { ...inner, path: [...inner.path, ...bound.path] };
    }
    const imported = nearestBinding(aliases, root.name, ordinal);
    return imported && { className: imported.value, path: [], rootIsClassObject: true };
  };

  const uses: MemberUse[] = [];
  parsed.forEach(({ block, source }, blockIndex) => {
    visit(source, (node) => {
      if (!ts.isPropertyAccessExpression(node)) return;
      const receiver = describeReceiver(node.expression);
      if (!receiver) return;
      const resolved = resolveRoot(receiver.root, ordinalOf(blockIndex, source, node), new Set());
      if (!resolved) return;
      uses.push({
        page: block.page,
        line: pageLineOf(block, source, node),
        rootClass: resolved.className,
        path: [...resolved.path, ...receiver.path],
        member: node.name.text,
        rootIsClassObject: resolved.rootIsClassObject,
        text: `${node.expression.getText(source)}.${node.name.text}`,
      });
    });
  });
  return uses;
}

/** Where a chain begins, once every variable in it has been followed back. */
interface ResolvedRoot {
  readonly className: string;
  /** Hops the followed declarations contributed, before the use's own. */
  readonly path: readonly string[];
  readonly rootIsClassObject: boolean;
}

/** A position that orders every node on the page, across blocks. */
function ordinalOf(blockIndex: number, source: ts.SourceFile, node: ts.Node): number {
  return blockIndex * 1_000_000 + node.getStart(source);
}

/**
 * A local name bound to something at one position on the page.
 *
 * Two things produce these and they are the same kind of fact: `const strip =
 * new Strip()` binds a variable to a receiver, `import { Strip as S }` binds an
 * alias to an exported name. Both can be written twice on one page with
 * different right-hand sides, so both need position, and giving them one type is
 * what lets them share the resolver below rather than growing two orderings that
 * can disagree. [LAW:one-type-per-behavior]
 *
 * What the two bind *to* differs, so it travels as the parameter: the shared
 * behaviour is the page-ordering rule, and only that.
 */
interface Binding<T> {
  readonly ordinal: number;
  readonly name: string;
  readonly value: T;
}

/**
 * The binding of `name` in effect at `ordinal` — nearest preceding, else
 * nearest following.
 *
 * [LAW:single-enforcer] One page-ordering rule, asked by both binding kinds.
 * `docs/strip.md` declares `const strip = new Strip(…)` and, 130 lines later,
 * `const strip = new FlexStrip(…)`; last-one-wins would check the first
 * section's uses against the second section's class. The fallback forward is
 * what keeps `docs/markup.md` working, where `console.print` appears five
 * sections before the `Console` is constructed — a page is one running
 * document, so a use may legitimately precede its binding.
 *
 * The binding comes back, not its value. A declaration may bind a name to
 * nothing this file can follow, and returning the value alone collapses that
 * into "no such binding" — the one distinction the fallback forward turns on.
 * [LAW:parse-dont-validate]
 */
function nearestBinding<T>(
  bindings: readonly Binding<T>[],
  name: string,
  ordinal: number,
): Binding<T> | undefined {
  const matches = bindings.filter((binding) => binding.name === name);
  const preceding = matches.filter((binding) => binding.ordinal <= ordinal);
  return preceding.length > 0 ? preceding[preceding.length - 1] : matches[0];
}

/**
 * Where a receiver chain begins, as written.
 *
 * [LAW:types-are-the-program] A chain starts at one of exactly two syntactic
 * things and they resolve differently: `new Table().addRow(…)` names its class
 * on the spot, while `console.print` and `Table.grid()` both begin at a bare
 * name that means nothing until the page is searched for what bound it — a
 * `const`, an import, or nothing at all. Returning a bare string made the caller
 * guess, and it guessed "variable" — so the fluent form on `docs/console.md`
 * resolved to no declaration and every member on it was dropped.
 *
 * Which of the three a name turned out to be is `resolveRoot`'s answer, not
 * this one's; a parser reads syntax, and `Table` and `console` are the same
 * syntax.
 */
type ChainRoot =
  | { readonly kind: "variable"; readonly name: string }
  | { readonly kind: "class"; readonly name: string };

/** A chain root and the members read from it, outermost last. */
interface Receiver {
  readonly root: ChainRoot;
  readonly path: readonly string[];
}

/**
 * Where a receiver expression starts, and the members read between there and here.
 *
 * `console` -> variable `console`, no path. `layout.getByName("body")!` ->
 * variable `layout`, path `["getByName"]`. `progress.console.print` -> variable
 * `progress`, path `["console"]` — a getter is a hop like any other, which is
 * why the call case below delegates here rather than duplicating the walk.
 * `Table.grid()` -> variable `Table`, path `["grid"]`, by the same rules and
 * with no case of its own: a static factory is a member read off a name, and
 * the name happening to be a class is resolution's business.
 *
 * Anything else — an array index, a literal, a bare call — returns undefined and
 * the use is dropped. That is not a silent hole: a receiver of that shape names
 * nothing the page constructed, so there is no class to check the member
 * against. The drops that would matter are the ones rooted in this package's
 * surface, and those are reported by `resolveChain` rather than dropped.
 */
function describeReceiver(expression: ts.Expression): Receiver | undefined {
  if (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression)) {
    return describeReceiver(expression.expression);
  }
  if (ts.isIdentifier(expression)) {
    return { root: { kind: "variable", name: expression.text }, path: [] };
  }
  if (ts.isNewExpression(expression) && ts.isIdentifier(expression.expression)) {
    return { root: { kind: "class", name: expression.expression.text }, path: [] };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const inner = describeReceiver(expression.expression);
    if (!inner) return undefined;
    return { root: inner.root, path: [...inner.path, expression.name.text] };
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    return describeReceiver(expression.expression);
  }
  return undefined;
}

function unwrapAwait(node: ts.Expression | undefined): ts.Expression | undefined {
  return node && ts.isAwaitExpression(node) ? node.expression : node;
}

function visit(node: ts.Node, onNode: (node: ts.Node) => void): void {
  onNode(node);
  node.forEachChild((child) => visit(child, onNode));
}
