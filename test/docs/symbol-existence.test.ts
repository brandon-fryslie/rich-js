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
 * The exports of every entry point, keyed by the specifier a reader writes.
 *
 * One program over the same entry modules the coverage gate uses, so "exists"
 * means the same thing in both directions — a name is exported here exactly
 * when that gate would require a demo for it.
 */
function exportsBySpecifier(): Map<string, Set<string>> {
  const rootNames = [...ENTRY_BY_SPECIFIER.values()].map((p) => path.join(REPO_ROOT, p));
  const program = ts.createProgram({ rootNames, options: loadCompilerOptions() });
  const checker = program.getTypeChecker();
  const out = new Map<string, Set<string>>();
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
    out.set(
      specifier,
      new Set(checker.getExportsOfModule(moduleSymbol).map((s) => s.name)),
    );
  }
  return out;
}

/**
 * Public member names of a class exported from any entry point.
 *
 * Keyed by class name because that is what a page gives us — it writes
 * `new Console()`, and the receiver's type is that name. Private and protected
 * members are excluded: a page calling one is documenting something a reader
 * cannot call, which is the same failure as a member that does not exist.
 */
function membersByClass(): Map<string, Set<string>> {
  const rootNames = [...ENTRY_BY_SPECIFIER.values()].map((p) => path.join(REPO_ROOT, p));
  const program = ts.createProgram({ rootNames, options: loadCompilerOptions() });
  const checker = program.getTypeChecker();
  const out = new Map<string, Set<string>>();
  for (const srcPath of ENTRY_BY_SPECIFIER.values()) {
    const sourceFile = program.getSourceFile(path.join(REPO_ROOT, srcPath));
    if (!sourceFile) continue;
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const declaration = target.declarations?.[0];
      if (!declaration || !ts.isClassDeclaration(declaration)) continue;
      const instanceType = checker.getDeclaredTypeOfSymbol(target);
      const names = checker
        .getPropertiesOfType(instanceType)
        .filter((member) => {
          const modifiers = member.valueDeclaration
            ? ts.getCombinedModifierFlags(member.valueDeclaration)
            : ts.ModifierFlags.None;
          const hidden = ts.ModifierFlags.Private | ts.ModifierFlags.Protected;
          return (modifiers & hidden) === 0;
        })
        .map((member) => member.name);
      out.set(symbol.name, new Set(names));
    }
  }
  return out;
}

const exportedNames = exportsBySpecifier();
const classMembers = membersByClass();

const documentedImports: ImportedName[] = allBlocks
  .flatMap(extractImportedNames)
  .filter((imported) => ENTRY_BY_SPECIFIER.has(imported.specifier));

// Only receivers whose class this package actually exports can be checked; a
// page constructing an `express()` app or a `Map` is documenting someone
// else's surface, and this gate has nothing true to say about it.
const documentedMembers: MemberUse[] = pages
  .flatMap((page) => extractMemberUses(page.blocks))
  .filter((use) => classMembers.has(use.className));

function describeImport(imported: ImportedName): string {
  return `docs/${imported.page}:${imported.line} imports '${imported.name}' from '${imported.specifier}', which does not export it`;
}

function describeMember(use: MemberUse): string {
  return `docs/${use.page}:${use.line} calls '${use.text}', but ${use.className} has no public '${use.member}'`;
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
    expect(documentedMembers.length).toBeGreaterThanOrEqual(50);
    expect(documentedMembers.map((u) => u.className)).toContain("Console");
  });

  it("resolved the entry points it checks against", () => {
    expect(exportedNames.get("@promptctl/rich-js")?.has("Console")).toBe(true);
    expect(classMembers.get("Console")?.has("print")).toBe(true);
  });

  it("imports only names their entry point exports", () => {
    const ghosts = documentedImports.filter(
      (imported) => !exportedNames.get(imported.specifier)?.has(imported.name),
    );
    expect(ghosts.map(describeImport)).toEqual([]);
  });

  it("calls only members the constructed class has", () => {
    const ghosts = documentedMembers.filter(
      (use) => !classMembers.get(use.className)?.has(use.member),
    );
    expect(ghosts.map(describeMember)).toEqual([]);
  });
});
