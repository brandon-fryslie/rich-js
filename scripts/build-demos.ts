/**
 * Compiles `src/` and `examples/` into `dist-demo/` under `tsconfig.demo.json`,
 * for a demo's `npm run` script to run in Node.
 *
 * A demo imports the library by its published names, `@promptctl/rich-js/…`,
 * as a docs card running it does (examples/rich-strip/main.ts). Node would
 * resolve those through the package's own `exports`, to `dist/`, which is a
 * different build and maybe none at all; so the compiler resolves them to
 * `src/` (`PUBLISHED_PATHS`) and the emit rewrites each into a relative import
 * of that file as compiled beside it. Plain `tsc` can do the first and not the
 * second, which is why this is a script.
 *
 * [LAW:one-source-of-truth] Both halves read `ENTRY_BY_SPECIFIER`, the walk of
 * `package.json#exports` every other reader of the published names uses.
 *
 * Run by Node's own TypeScript type stripping, so it imports `.ts` by name;
 * that is the Node `package.json#devEngines` asks a contributor for.
 */
import ts from "typescript";
import path from "node:path";
import { ENTRY_BY_SPECIFIER, PUBLISHED_PATHS, REPO_ROOT } from "./repo-facts.ts";

const CONFIG = path.join(REPO_ROOT, "tsconfig.demo.json");

/** Each published specifier, by the absolute source file it names. */
const SOURCE_BY_SPECIFIER = new Map([...ENTRY_BY_SPECIFIER].map(([specifier, src]) => [specifier, path.join(REPO_ROOT, src)]));

/**
 * `specifier`, imported from `importer`, as Node finds the compiled file: a
 * published name as the relative path to its entry's emitted `.js`, which sits
 * where its source does relative to the importer's, since `rootDir` is the
 * repository; any other specifier as it is.
 */
function emitted(specifier: string, importer: string): string {
  const source = SOURCE_BY_SPECIFIER.get(specifier);
  if (source === undefined) return specifier;
  const relative = path.relative(path.dirname(importer), source).split(path.sep).join("/").replace(/\.ts$/, ".js");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/** The emit transform: every module specifier in an import, an export or an `import()` rewritten by `emitted`. */
const rewriteSpecifiers: ts.TransformerFactory<ts.SourceFile> = (context) => (file) => {
  const { factory } = context;
  const literal = (node: ts.Expression | undefined) =>
    node !== undefined && ts.isStringLiteral(node) ? factory.createStringLiteral(emitted(node.text, file.fileName)) : node;
  const visit = (node: ts.Node): ts.Node => {
    if (ts.isImportDeclaration(node)) {
      return factory.updateImportDeclaration(node, node.modifiers, node.importClause, literal(node.moduleSpecifier)!, node.attributes);
    }
    if (ts.isExportDeclaration(node)) {
      return factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, literal(node.moduleSpecifier), node.attributes);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [first, ...rest] = node.arguments;
      return factory.updateCallExpression(node, node.expression, node.typeArguments, [literal(first)!, ...rest].filter((a) => a !== undefined));
    }
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitEachChild(file, visit, context);
};

const read = ts.readConfigFile(CONFIG, ts.sys.readFile);
if (read.error) throw new Error(ts.formatDiagnostic(read.error, ts.createCompilerHost({})));
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO_ROOT, undefined, CONFIG);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, paths: PUBLISHED_PATHS } });
const result = program.emit(undefined, undefined, undefined, false, { after: [rewriteSpecifiers] });
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
// [LAW:no-silent-failure] Reported as `tsc` reports them, and a failing exit,
// so a demo script chained after this one does not run stale output.
if (diagnostics.length > 0) {
  const host: ts.FormatDiagnosticsHost = { getCanonicalFileName: (f) => f, getCurrentDirectory: () => REPO_ROOT, getNewLine: () => "\n" };
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  process.exit(1);
}
