/*
 * Every symbol the documentation names is a symbol the library exports.
 *
 * The failures this exists for were all shipped, all on the published site,
 * and all indistinguishable from working code to a reader: `RenderGroup` for
 * `Group`, a `richReprAuto` decorator for a protocol that was never built,
 * `console.status` / `console.pager` / `console.input` transliterated from
 * Python Rich's `Console` onto a class that has eight methods.
 *
 * WHEN THIS GOES RED THERE ARE TWO WAYS TO MAKE IT GREEN AND ONLY ONE IS
 * CORRECT. Fix the page. The code is the truth and the page is a claim about
 * it, so a documented symbol that does not exist is a false page, never a
 * missing feature — implementing the symbol to satisfy the doc lets an
 * unreviewed sentence set the roadmap. That is not hypothetical caution: this
 * suite exists because `docs/logging.md` documented a `RichHandler` class end
 * to end across five snippets, and the resolution was to delete the page. If
 * the symbol is genuinely wanted, it gets filed on its own merits.
 *
 * THE CEILING, AND IT IS LOWER THAN THE TITLE SOUNDS. Symbol existence is the
 * weakest of the three ways a docs page lies, and it is the only one checked
 * here. Measured across the five pages audited before this landed:
 *
 *   1. The symbol does not exist. Caught here.
 *   2. The symbol exists and does something else. `docs/strip.md` taught
 *      `end: ""` as the option that makes a `RichText` behave as an inline
 *      cell; it is inert, because `RichText.render` never emits the default
 *      end for non-empty text. Every symbol on that page resolved, and every
 *      such check would have passed it. Six defects, none visible here.
 *   3. A true statement about one code path, generalized into a claim about
 *      the surface. `docs/console.md` said "any other string throws" of
 *      `colorSystem`, where the real table silently maps `"vscode"` to
 *      truecolor. No snippet fails to compile and no printed byte is wrong,
 *      because the defect is in a sentence.
 *
 * On one page this check would have caught six ghosts; on the next it would
 * have caught nothing at all, and the difference was provenance — a page
 * transliterated from Python inherits Python's API surface and lies about
 * existence, a page written alongside the commits that built the subsystem
 * lies about behavior. Read a green bar here as "no page names a symbol that
 * is missing", never as "these pages are true". Classes 2 and 3 are a
 * reviewer's job, and the move that finds them is to read every branch of the
 * function a universally-quantified claim ("any", "all", "never", "only")
 * depends on, rather than sampling two inputs and generalizing.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  ENTRY_BY_SPECIFIER,
  REPO_ROOT,
  loadCompilerOptions,
  resolveAlias,
} from "../coverage/extract.js";
import {
  extractCodeBlocks,
  extractImportedNames,
  extractMemberUses,
  type CodeBlock,
  type ImportedName,
  type MemberUse,
} from "./code-blocks.js";

const DOCS_ROOT = path.join(REPO_ROOT, "docs");

interface Page {
  readonly slug: string;
  readonly blocks: readonly CodeBlock[];
}

function readPages(): Page[] {
  return readdirSync(DOCS_ROOT)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      slug: name.slice(0, -".md".length),
      blocks: extractCodeBlocks(name, readFileSync(path.join(DOCS_ROOT, name), "utf-8")),
    }));
}

const pages = readPages();
const allBlocks = pages.flatMap((page) => page.blocks);

/**
 * One program over the entry modules, and the two questions asked of it.
 *
 * `exportsBySpecifier` answers "does this entry point export this name";
 * `classesByName` answers "what public members does this class have, and is
 * the name unambiguous". Both come from one `ts.createProgram` and one pass
 * over each module's exports — building the program is the expensive step, and
 * `test/coverage/coverage.test.ts` next door already takes care to build it
 * once and reuse it across three checks.
 */
interface ClassInfo {
  /** Public instance members, or undefined when the name is ambiguous. */
  readonly members: Set<string>;
  /** Every entry module exporting a class under this name. */
  readonly origins: string[];
  /** Return type name of each method, for resolving a receiver chain. */
  readonly returns: Map<string, string>;
}

function resolveSurface(): {
  exportedNames: Map<string, Set<string>>;
  classesByName: Map<string, ClassInfo>;
} {
  const rootNames = [...ENTRY_BY_SPECIFIER.values()].map((p) => path.join(REPO_ROOT, p));
  const program = ts.createProgram({ rootNames, options: loadCompilerOptions() });
  const checker = program.getTypeChecker();

  const exportedNames = new Map<string, Set<string>>();
  const classesByName = new Map<string, ClassInfo>();

  for (const [specifier, srcPath] of ENTRY_BY_SPECIFIER) {
    const sourceFile = program.getSourceFile(path.join(REPO_ROOT, srcPath));
    if (!sourceFile) {
      throw new Error(
        `docs symbol check: entry module ${srcPath} for '${specifier}' is not ` +
          `in the program — did the path move?`,
      );
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      throw new Error(`docs symbol check: no module symbol for ${srcPath}`);
    }
    const symbols = checker.getExportsOfModule(moduleSymbol);
    exportedNames.set(specifier, new Set(symbols.map((s) => s.name)));

    for (const symbol of symbols) {
      // The full alias chain, not one hop: a class re-exported through two
      // modules resolves to a re-export specifier under a single
      // `getAliasedSymbol`, fails `isClassDeclaration`, and drops out of the
      // check silently. [LAW:one-source-of-truth] one resolver, in extract.ts.
      const target = resolveAlias(symbol, checker);
      const declaration = target.declarations?.[0];
      if (!declaration || !ts.isClassDeclaration(declaration)) continue;

      const instanceType = checker.getDeclaredTypeOfSymbol(target);
      const properties = checker.getPropertiesOfType(instanceType).filter((member) => {
        const modifiers = member.valueDeclaration
          ? ts.getCombinedModifierFlags(member.valueDeclaration)
          : ts.ModifierFlags.None;
        return (modifiers & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) === 0;
      });

      const returns = new Map<string, string>();
      for (const member of properties) {
        const signatures = member.valueDeclaration
          ? checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration).getCallSignatures()
          : [];
        const returned = signatures[0]?.getReturnType();
        // A method's return type names the next class in a receiver chain.
        // `Layout.getByName` returns `Layout | undefined`, so the union is
        // walked rather than read whole.
        for (const part of returned?.isUnion() ? returned.types : returned ? [returned] : []) {
          const name = part.getSymbol()?.name;
          if (name && name !== "undefined") returns.set(member.name, name);
        }
      }

      const existing = classesByName.get(symbol.name);
      classesByName.set(symbol.name, {
        members: new Set(properties.map((m) => m.name)),
        origins: [...(existing?.origins ?? []), srcPath],
        returns,
      });
    }
  }
  return { exportedNames, classesByName };
}

const { exportedNames, classesByName } = resolveSurface();

/**
 * The class a receiver chain ends at, or why it could not be resolved.
 *
 * A docs page supplies a bare class name and nothing else, so an ambiguous
 * name — two entry points exporting different classes as `Console` — cannot be
 * disambiguated from the input. It is reported rather than silently resolved
 * to whichever module was walked last. [LAW:no-silent-failure]
 */
function resolveChain(use: MemberUse): { className: string } | { unresolved: string } {
  let className = use.rootClass;
  for (const method of use.path) {
    const info = classesByName.get(className);
    if (!info) return { unresolved: `${className} is not a class this package exports` };
    if (info.origins.length > 1) {
      return { unresolved: `'${className}' is exported by ${info.origins.join(" and ")}` };
    }
    const next = info.returns.get(method);
    if (!next) {
      return { unresolved: `${className}.${method} has no class return type to follow` };
    }
    className = next;
  }
  const info = classesByName.get(className);
  if (info && info.origins.length > 1) {
    return { unresolved: `'${className}' is exported by ${info.origins.join(" and ")}` };
  }
  return { className };
}

const documentedImports: ImportedName[] = allBlocks
  .flatMap(extractImportedNames)
  .filter((imported) => ENTRY_BY_SPECIFIER.has(imported.specifier));

/**
 * Every documented member use, paired with the class the chain lands on.
 *
 * A receiver rooted in a class this package does not export is dropped, not
 * reported: a page constructing an `express()` app or a `Map` documents
 * someone else's surface and this gate has nothing true to say about it. A
 * chain that starts in our surface and then fails to resolve is a different
 * thing entirely, and it is reported — silently not checking is the failure
 * mode that let `docs/layout.md`'s whole access pattern go unexamined.
 */
const resolvedMembers = pages
  .flatMap((page) => extractMemberUses(page.blocks))
  .filter((use) => classesByName.has(use.rootClass))
  .map((use) => ({ use, resolution: resolveChain(use) }));

function describeImport(imported: ImportedName): string {
  return `docs/${imported.page}:${imported.line} imports '${imported.name}' from '${imported.specifier}', which does not export it`;
}

function describeMember(use: MemberUse, className: string): string {
  return `docs/${use.page}:${use.line} calls '${use.text}', but ${className} has no public '${use.member}'`;
}

describe("documented symbols exist", () => {
  // [LAW:verifiable-goals] The sweep before the rules. Every assertion below
  // is a claim about a set built by scanning `docs/`, and an empty scan makes
  // all of them pass — a green bar that means nothing was checked looks
  // exactly like a green bar that means everything passed.
  it("finds the code blocks it is meant to check", () => {
    expect(pages.map((p) => p.slug)).toContain("console");
    expect(pages.map((p) => p.slug)).toContain("strip");
    expect(allBlocks.length).toBeGreaterThanOrEqual(150);
  });

  it("finds imports from this package's entry points", () => {
    expect(documentedImports.length).toBeGreaterThanOrEqual(50);
    expect(documentedImports.map((i) => i.specifier)).toContain("@promptctl/rich-js");
  });

  it("finds members called on classes this package exports", () => {
    expect(resolvedMembers.length).toBeGreaterThanOrEqual(50);
    expect(resolvedMembers.map((r) => r.use.rootClass)).toContain("Console");
  });

  // The chained pattern specifically, because it was invisible once and the
  // page that uses it throughout would not have failed either way.
  it("follows a receiver chain through a method's return type", () => {
    const chained = resolvedMembers.filter((r) => r.use.path.length > 0);
    expect(chained.length).toBeGreaterThan(0);
    expect(
      chained.map((r) => ("className" in r.resolution ? r.resolution.className : "")),
    ).toContain("Layout");
  });

  it("resolved the entry points it checks against", () => {
    expect(exportedNames.get("@promptctl/rich-js")?.has("Console")).toBe(true);
    expect(classesByName.get("Console")?.members.has("print")).toBe(true);
  });

  // A receiver rooted in this package's surface that cannot be followed is
  // named, never dropped. [LAW:no-silent-failure]
  it("resolves every receiver chain it starts", () => {
    const stuck = resolvedMembers
      .filter((r) => "unresolved" in r.resolution)
      .map((r) =>
        `docs/${r.use.page}:${r.use.line} calls '${r.use.text}' but the receiver ` +
        `could not be resolved: ${"unresolved" in r.resolution ? r.resolution.unresolved : ""}`,
      );
    expect(stuck).toEqual([]);
  });

  it("imports only names their entry point exports", () => {
    const ghosts = documentedImports.filter(
      (imported) => !exportedNames.get(imported.specifier)?.has(imported.name),
    );
    expect(ghosts.map(describeImport)).toEqual([]);
  });

  it("calls only members the receiver's class has", () => {
    const ghosts = resolvedMembers.flatMap(({ use, resolution }) => {
      if (!("className" in resolution)) return [];
      const info = classesByName.get(resolution.className);
      if (!info || info.members.has(use.member)) return [];
      return [describeMember(use, resolution.className)];
    });
    expect(ghosts).toEqual([]);
  });
});
