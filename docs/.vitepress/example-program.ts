/**
 * A docs page's examples as one program: the source a reader assembles by
 * reading the page top to bottom.
 *
 * Pure: markdown and the names the main barrel exports go in, TypeScript and a
 * map back to page lines come out. Compiling, bundling and running it are
 * `example-runner.ts`'s job. [LAW:effects-at-boundaries]
 *
 * The program is, in order:
 *   - every import on the blocks it runs, hoisted and merged;
 *   - the prelude: every value the main barrel exports that those imports do
 *     not bind, then `const console = new Console();`. That is exactly what
 *     `docs/introduction.md` tells readers an example assumes, and nothing
 *     more. A name the reader writes themselves goes in the page's
 *     `exampleContext`, never here;
 *   - the page's `exampleContext` frontmatter, if any, in a scope of its own
 *     that every block is nested inside, so it too may redeclare any name;
 *   - the blocks, each nested inside the scope of the one before, so a block
 *     sees everything above it and may redeclare any name, `console`
 *     included. A `throws` block is a `try` in the scope it sits in, so
 *     nothing it declares reaches the blocks below it.
 *
 * Each block ends by writing a sentinel to `process.stdout`, and that is how
 * the runner cuts one captured stream into per-block output. The terminal the
 * program writes to belongs to the runner, so a sentinel cannot collide with
 * anything a real terminal would receive.
 */

import ts from "typescript";
import type { Fence } from "./example-markers.js";

/** Written after a block completes. */
export const BLOCK_END = "\u0000rich-example:end\u0000";
/** Written when a `throws` block throws, around `[name, message]` as JSON. */
export const BLOCK_THREW = "\u0000rich-example:threw:";
const THREW_CLOSE = "\u0000";

/** The main barrel's specifier, which the prelude imports from. */
export const MAIN_BARREL = "@promptctl/rich-js";

/** Program text, and the page line each of its lines came from. */
export interface ExampleProgram {
  readonly page: string;
  readonly source: string;
  /** Per 0-based line of `source`: the 1-based page line, or null for generated code. */
  readonly origins: readonly (number | null)[];
  /** The blocks the program runs, in the order their sentinels are written. */
  readonly blocks: readonly Fence[];
}

/** The page's `exampleContext`: code, and the page line of its first line. */
export interface ExampleContext {
  readonly code: string;
  readonly line: number;
}

/**
 * The `exampleContext` key of a page's frontmatter, written as a YAML block
 * scalar (`exampleContext: |` and indented lines below it); `null` when the
 * page declares none. Any other shape of the key throws rather than being
 * read as something it is not.
 */
export function exampleContext(page: string, markdown: string): ExampleContext | null {
  const lines = markdown.split("\n");
  const end = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const keyAt = lines.slice(0, Math.max(end, 0)).findIndex((line) => /^exampleContext\s*:/.test(line));
  if (keyAt === -1) return null;
  if (!/^exampleContext:\s*\|\s*$/.test(lines[keyAt]!)) {
    throw new Error(`docs/${page}:${keyAt + 1}: exampleContext must be a block scalar, \`exampleContext: |\``);
  }
  const body: string[] = [];
  for (const line of lines.slice(keyAt + 1, end)) {
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l.trim() !== "").map((l) => /^\s*/.exec(l)![0].length));
  return { code: body.map((l) => l.slice(indent)).join("\n"), line: keyAt + 2 };
}

/** One import, as it is written back out. `key` is what makes two of them the same import. */
interface Hoisted {
  readonly key: string;
  readonly text: string;
  readonly line: number;
  /** The local names it binds. */
  readonly binds: readonly string[];
}

/** A block's code split into its imports and the rest, the rest keeping its line count. */
function splitImports(code: string, firstLine: number): { imports: Hoisted[]; body: string } {
  const source = ts.createSourceFile("block.ts", code, ts.ScriptTarget.ES2022, true);
  const imports: Hoisted[] = [];
  let body = code;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const start = statement.getStart(source);
    const line = firstLine + source.getLineAndCharacterOfPosition(start).line;
    imports.push(...importsOf(statement, source, line));
    body = body.slice(0, start) + body.slice(start, statement.end).replace(/[^\n]/g, " ") + body.slice(statement.end);
  }
  return { imports, body };
}

/**
 * An import declaration as one hoisted import per binding, so two blocks
 * importing overlapping names merge to one binding each, and every name it
 * binds is known to the prelude. A bare import binds nothing and is kept whole.
 */
function importsOf(statement: ts.ImportDeclaration, source: ts.SourceFile, line: number): Hoisted[] {
  const clause = statement.importClause;
  if (clause === undefined) {
    const text = statement.getText(source);
    return [{ key: text, text, line, binds: [] }];
  }
  const from = JSON.stringify((statement.moduleSpecifier as ts.StringLiteral).text);
  const typeOnly = clause.isTypeOnly ? "type " : "";
  const one = (text: string, local: string): Hoisted => ({ key: text, text, line, binds: [local] });
  const bindings = clause.namedBindings;
  return [
    ...(clause.name === undefined ? [] : [one(`import ${typeOnly}${clause.name.text} from ${from};`, clause.name.text)]),
    ...(bindings === undefined
      ? []
      : ts.isNamespaceImport(bindings)
        ? [one(`import ${typeOnly}* as ${bindings.name.text} from ${from};`, bindings.name.text)]
        : bindings.elements.map((element) => {
            const local = element.name.text;
            const imported = element.propertyName?.text ?? local;
            const binding = imported === local ? local : `${imported} as ${local}`;
            const elementTypeOnly = clause.isTypeOnly || element.isTypeOnly ? "type " : "";
            return one(`import { ${elementTypeOnly}${binding} } from ${from};`, local);
          })),
  ];
}

/** Lines of generated source, each remembering the page line it came from. */
class SourceBuilder {
  readonly lines: string[] = [];
  readonly origins: (number | null)[] = [];

  /** `text`'s lines, the first from page line `line` (null: generated). */
  add(text: string, line: number | null): void {
    text.split("\n").forEach((piece, i) => {
      this.lines.push(piece);
      this.origins.push(line === null ? null : line + i);
    });
  }
}

const THREW_HELPER = [
  "const __richExampleThrew = (error: unknown): string =>",
  `  ${JSON.stringify(BLOCK_THREW)} +`,
  "  JSON.stringify(error instanceof Error ? [error.name, error.message] : [\"\", String(error)]) +",
  `  ${JSON.stringify(THREW_CLOSE)};`,
].join("\n");

const WRITE_END = `process.stdout.write(${JSON.stringify(BLOCK_END)});`;

/**
 * The program that runs `blocks` in order under the page's imports, prelude
 * and context. For the page's chain, `blocks` is its build blocks; for a live
 * example it is that one block.
 */
export function buildProgram(
  page: string,
  context: ExampleContext | null,
  blocks: readonly Fence[],
  barrelValues: readonly string[],
): ExampleProgram {
  const parts = blocks.map((block) => ({ block, ...splitImports(block.code, block.line + 1) }));
  const contextPart = context === null ? null : { line: context.line, ...splitImports(context.code, context.line) };
  const allImports = [...(contextPart?.imports ?? []), ...parts.flatMap((p) => p.imports)];

  const hoisted = new Map<string, Hoisted>();
  const bound = new Map<string, Hoisted>();
  for (const imp of allImports) {
    if (hoisted.has(imp.key)) continue;
    for (const name of imp.binds) {
      const earlier = bound.get(name);
      if (earlier !== undefined) {
        throw new Error(
          `docs/${page}:${imp.line}: imports ${name}, which docs/${page}:${earlier.line} already imports differently`,
        );
      }
      bound.set(name, imp);
    }
    hoisted.set(imp.key, imp);
  }

  const out = new SourceBuilder();
  for (const imp of hoisted.values()) out.add(imp.text, imp.line);
  const prelude = barrelValues.filter((name) => !bound.has(name));
  out.add(`import { ${prelude.join(", ")} } from ${JSON.stringify(MAIN_BARREL)};`, null);
  out.add("const console = new Console();", null);
  out.add(THREW_HELPER, null);
  out.add("{", null);
  if (contextPart !== null) out.add(contextPart.body, contextPart.line);
  out.add(WRITE_END, null);

  let open = 1;
  for (const { block, body } of parts) {
    if (block.marker === "throws") {
      out.add("try {", null);
      out.add(body, block.line + 1);
      out.add(`${WRITE_END}\n} catch (error) {\n  process.stdout.write(__richExampleThrew(error));\n}`, null);
    } else {
      out.add("{", null);
      out.add(body, block.line + 1);
      out.add(WRITE_END, null);
      open += 1;
    }
  }
  out.add("}".repeat(open), null);

  return { page, source: out.lines.join("\n"), origins: out.origins, blocks };
}

/** One block's share of a run: what it printed, and how it ended. */
export interface BlockRecord {
  readonly output: string;
  readonly ended: { readonly kind: "completed" } | { readonly kind: "threw"; readonly name: string; readonly message: string };
}

const RECORD = new RegExp(`${BLOCK_END}|${BLOCK_THREW}(.*?)${THREW_CLOSE}`, "gs");

/** What the prelude and `exampleContext` wrote, and whether they got to the end. */
export interface ContextRecord {
  readonly output: string;
  readonly finished: boolean;
}

/**
 * A run's captured stream cut at the sentinels: first what the context wrote,
 * then one record per block that finished. A run that stopped early has fewer
 * records than blocks, and the first block without one is where it stopped;
 * one that stopped before the context finished has none.
 */
export function splitRecords(stream: string): { context: ContextRecord; blocks: BlockRecord[] } {
  const records: BlockRecord[] = [];
  let context: string | null = null;
  let at = 0;
  for (const match of stream.matchAll(RECORD)) {
    const output = stream.slice(at, match.index);
    at = match.index + match[0].length;
    if (context === null) {
      context = output;
      continue;
    }
    const threw = match[1] === undefined ? null : (JSON.parse(match[1]) as [string, string]);
    records.push({
      output,
      ended: threw === null ? { kind: "completed" } : { kind: "threw", name: threw[0], message: threw[1] },
    });
  }
  return { context: context === null ? { output: stream, finished: false } : { output: context, finished: true }, blocks: records };
}
