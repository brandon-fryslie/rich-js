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
 *   - the prelude: every name the main barrel exports that those imports do
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
 * The prelude, the context and each block end by writing a sentinel to
 * `process.stdout`, and that is how the runner cuts one captured stream into
 * per-block output and tells which part a run stopped in. The terminal the
 * program writes to belongs to the runner, so a sentinel cannot collide with
 * anything a real terminal would receive.
 */

import ts from "typescript";
import { frontmatterEnd, pageLines, type Fence } from "./example-markers.js";

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
  const lines = pageLines(markdown);
  const end = frontmatterEnd(lines);
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
  if (body.every((line) => line.trim() === "")) {
    throw new Error(`docs/${page}:${keyAt + 2}: exampleContext is empty; its code must be indented under \`exampleContext: |\``);
  }
  const indent = Math.min(...body.filter((l) => l.trim() !== "").map((l) => /^\s*/.exec(l)![0].length));
  return { code: body.map((l) => l.slice(indent)).join("\n"), line: keyAt + 2 };
}

/**
 * One import on the page, hoisted: a bare import, kept whole, or one name an
 * import binds and the export that name is. Two blocks importing one export
 * merge into one import however each wrote it.
 */
type Hoisted = Bare | Binding;

interface Bare {
  readonly kind: "bare";
  readonly text: string;
  readonly line: number;
}

interface Binding {
  readonly kind: "binding";
  readonly line: number;
  readonly local: string;
  readonly from: string;
  /** The export's name: `default` for a default import, `*` for a namespace. */
  readonly imported: string;
  readonly typeOnly: boolean;
}

/** A name the main barrel exports, and whether it is a type and nothing else. */
export interface BarrelExport {
  readonly name: string;
  readonly typeOnly: boolean;
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

/** An import declaration as one hoisted import per name it binds; a bare import binds none and is kept whole. */
function importsOf(statement: ts.ImportDeclaration, source: ts.SourceFile, line: number): Hoisted[] {
  const clause = statement.importClause;
  if (clause === undefined) return [{ kind: "bare", text: statement.getText(source), line }];
  const from = (statement.moduleSpecifier as ts.StringLiteral).text;
  const binding = (local: string, imported: string, typeOnly: boolean): Binding => ({
    kind: "binding",
    line,
    local,
    from,
    imported,
    typeOnly: clause.isTypeOnly || typeOnly,
  });
  const bindings = clause.namedBindings;
  return [
    ...(clause.name === undefined ? [] : [binding(clause.name.text, "default", false)]),
    ...(bindings === undefined
      ? []
      : ts.isNamespaceImport(bindings)
        ? [binding(bindings.name.text, "*", false)]
        : bindings.elements.map((element) => binding(element.name.text, element.propertyName?.text ?? element.name.text, element.isTypeOnly))),
  ];
}

function importText(binding: Binding): string {
  const type = binding.typeOnly ? "type " : "";
  const from = JSON.stringify(binding.from);
  const { local, imported } = binding;
  if (imported === "*") return `import ${type}* as ${local} from ${from};`;
  if (imported === "default") return `import ${type}${local} from ${from};`;
  return `import { ${type}${imported === local ? local : `${imported} as ${local}`} } from ${from};`;
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

/**
 * The line a thrown value is shown as, the way Node reports it: an `Error` as
 * `Name: message` (just `Name` when the message is empty), anything else as
 * `Uncaught` and the value, a string quoted so `throw ""` still shows.
 */
const THREW_HELPER = [
  "const __richExampleThrew = (error: unknown): string =>",
  `  ${JSON.stringify(BLOCK_THREW)} +`,
  "  JSON.stringify(error instanceof Error ? Error.prototype.toString.call(error) : `Uncaught ${typeof error === \"string\" ? JSON.stringify(error) : String(error)}`) +",
  `  ${JSON.stringify(THREW_CLOSE)};`,
].join("\n");

const WRITE_END = `process.stdout.write(${JSON.stringify(BLOCK_END)});`;

/**
 * The page's chain: its build blocks in order under the page's imports,
 * prelude and context, each part ending in the sentinel `splitRecords` cuts at.
 */
export function buildProgram(
  page: string,
  context: ExampleContext | null,
  blocks: readonly Fence[],
  barrel: readonly BarrelExport[],
): ExampleProgram {
  return compose(page, context, blocks, barrel, { helper: THREW_HELPER, end: WRITE_END });
}

/**
 * One live block as a program of its own: the page's imports it and the
 * context use, the prelude, the context, and that block. It sees no other
 * block on the page, and writes nothing but what the block does, because its
 * output goes straight to a terminal a reader is watching.
 */
export function buildLiveProgram(
  page: string,
  context: ExampleContext | null,
  block: Fence,
  barrel: readonly BarrelExport[],
): ExampleProgram {
  return compose(page, context, [block], barrel, { helper: "", end: "" });
}

/**
 * What a program writes around its parts: the helper a `throws` block reports
 * through, and the statement ending each part. The chain writes both, so its
 * one captured stream can be cut per block; a live program writes neither.
 */
interface Records {
  readonly helper: string;
  readonly end: string;
}

function compose(
  page: string,
  context: ExampleContext | null,
  blocks: readonly Fence[],
  barrel: readonly BarrelExport[],
  records: Records,
): ExampleProgram {
  const parts = blocks.map((block) => ({ block, ...splitImports(block.code, block.line + 1) }));
  const contextPart = context === null ? null : { line: context.line, ...splitImports(context.code, context.line) };
  const barrelValues = new Set(barrel.filter((e) => !e.typeOnly).map((e) => e.name));

  const bare = new Map<string, Bare>();
  const bound = new Map<string, Binding>();
  for (const imp of [...(contextPart?.imports ?? []), ...parts.flatMap((p) => p.imports)]) {
    if (imp.kind === "bare") {
      if (!bare.has(imp.text)) bare.set(imp.text, imp);
      continue;
    }
    const earlier = bound.get(imp.local);
    if (earlier !== undefined && (earlier.from !== imp.from || earlier.imported !== imp.imported)) {
      throw new Error(`docs/${page}:${imp.line}: imports ${imp.local}, which docs/${page}:${earlier.line} already imports differently`);
    }
    // A value import brings the type too, so one export imported both ways is the value import.
    bound.set(imp.local, earlier === undefined ? imp : { ...earlier, typeOnly: earlier.typeOnly && imp.typeOnly });
  }

  const out = new SourceBuilder();
  for (const imp of bare.values()) out.add(imp.text, imp.line);
  for (const imp of bound.values()) {
    // Every barrel value is a value in every example, so the page's own import of one is never type-only.
    const barrelValue = imp.from === MAIN_BARREL && barrelValues.has(imp.imported);
    out.add(importText({ ...imp, typeOnly: imp.typeOnly && !barrelValue }), imp.line);
  }
  const prelude = barrel.filter((e) => !bound.has(e.name)).map((e) => (e.typeOnly ? `type ${e.name}` : e.name));
  out.add(`import { ${prelude.join(", ")} } from ${JSON.stringify(MAIN_BARREL)};`, null);
  out.add("const console = new Console();", null);
  out.add(records.helper, null);
  out.add(records.end, null);
  out.add("{", null);
  if (contextPart !== null) out.add(contextPart.body, contextPart.line);
  out.add(records.end, null);

  let open = 1;
  for (const { block, body } of parts) {
    if (block.marker === "throws") {
      out.add("try {", null);
      out.add(body, block.line + 1);
      out.add(`${records.end}\n} catch (error) {\n  process.stdout.write(__richExampleThrew(error));\n}`, null);
    } else {
      out.add("{", null);
      out.add(body, block.line + 1);
      out.add(records.end, null);
      open += 1;
    }
  }
  out.add("}".repeat(open), null);

  return { page, source: out.lines.join("\n"), origins: out.origins, blocks };
}

/** One block's share of a run: what it printed, and how it ended. */
export interface BlockRecord {
  readonly output: string;
  readonly ended: { readonly kind: "completed" } | { readonly kind: "threw"; readonly line: string };
}

const RECORD = new RegExp(`${BLOCK_END}|${BLOCK_THREW}(.*?)${THREW_CLOSE}`, "gs");

/**
 * A run's captured stream cut at the sentinels: one record per part of the
 * program that finished, in order (the imports and prelude, the context, then
 * each block). A run that stopped early has fewer records than parts, and the first part without one is
 * where it stopped.
 */
export function splitRecords(stream: string): BlockRecord[] {
  const records: BlockRecord[] = [];
  let at = 0;
  for (const match of stream.matchAll(RECORD)) {
    records.push({
      output: stream.slice(at, match.index),
      ended: match[1] === undefined ? { kind: "completed" } : { kind: "threw", line: JSON.parse(match[1]) as string },
    });
    at = match.index + match[0].length;
  }
  return records;
}
