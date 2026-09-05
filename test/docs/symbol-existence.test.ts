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
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  ENTRY_BY_SPECIFIER,
  REPO_ROOT,
  assertProgramClean,
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
import { docsPages } from "./pages.js";
import { resolveChain, type SurfaceType } from "./resolve-chain.js";

interface Page {
  readonly slug: string;
  readonly blocks: readonly CodeBlock[];
}

function readPages(): Page[] {
  return docsPages().map((page) => ({
    slug: page.slug,
    blocks: extractCodeBlocks(page.file, readFileSync(page.absolutePath, "utf-8")),
  }));
}

const pages = readPages();
const allBlocks = pages.flatMap((page) => page.blocks);

/**
 * One program over the entry modules, and the two questions asked of it.
 *
 * `exportedNames` answers "does this entry point export this name";
 * `surfaceByName` answers "what public members does this type have, and is the
 * name unambiguous". Both come from one `ts.createProgram` and one pass
 * over each module's exports — building the program is the expensive step, and
 * `test/coverage/coverage.test.ts` next door already takes care to build it
 * once and reuse it across three checks.
 */
function resolveSurface(): {
  exportedNames: Map<string, Set<string>>;
  surfaceByName: Map<string, SurfaceType>;
} {
  const rootNames = [...ENTRY_BY_SPECIFIER.values()].map((p) => path.join(REPO_ROOT, p));
  const program = ts.createProgram({ rootNames, options: loadCompilerOptions() });
  // [LAW:no-silent-failure] A program with unresolved errors answers short
  // rather than throwing: `getExportsOfModule` and `getPropertiesOfType` return
  // incomplete sets, so a real ghost reads as "the class does not have it" and a
  // real member reads as missing. Both verdicts would be manufactured by the
  // broken build, not found in `docs/`. `coverage.test.ts` gates its program the
  // same way, for the same reason.
  assertProgramClean(program);
  const checker = program.getTypeChecker();

  const exportedNames = new Map<string, Set<string>>();
  const surfaceByName = new Map<string, SurfaceType>();

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
      // Classes and interfaces both, because a chain does not stay in classes:
      // `host.size()` yields the `TerminalSize` interface and `.rows` is a real
      // member of it. With classes alone the hop is unfollowable, and the honest
      // report — "not a class this package exports" — reads as a defect on a
      // page that is correct. Type aliases stay out: they have no declared
      // members to check against.
      const declaresMembers =
        declaration &&
        (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration));
      if (!declaresMembers) continue;

      const instanceType = checker.getDeclaredTypeOfSymbol(target);
      const properties = checker.getPropertiesOfType(instanceType).filter((member) => {
        const modifiers = member.valueDeclaration
          ? ts.getCombinedModifierFlags(member.valueDeclaration)
          : ts.ModifierFlags.None;
        return (modifiers & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) === 0;
      });

      const yields = new Map<string, string>();
      for (const member of properties) {
        const memberType = member.valueDeclaration
          ? checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration)
          : undefined;
        // What a hop yields: a method yields what it returns, and anything else
        // — a getter, a readonly field — yields its own type. One kind of hop,
        // so `progress.console.print` walks the same path as
        // `layout.getByName("x")!.update`. [LAW:one-type-per-behavior] A getter
        // has no call signatures, and reading only those is what made the
        // `.console` hop unresolvable while looking like a resolved chain.
        const yielded = memberType?.getCallSignatures()[0]?.getReturnType() ?? memberType;
        // `Layout.getByName` returns `Layout | undefined`, so a union is walked
        // rather than read whole.
        for (const part of yielded?.isUnion() ? yielded.types : yielded ? [yielded] : []) {
          const name = part.getSymbol()?.name;
          if (name && name !== "undefined") yields.set(member.name, name);
        }
      }

      // File and position, so one class re-exported from two entry points is one
      // origin and two different classes sharing a name are two.
      const identity = `${declaration.getSourceFile().fileName}:${declaration.pos}`;
      const origins = surfaceByName.get(symbol.name)?.origins ?? new Map<string, string>();
      surfaceByName.set(symbol.name, {
        members: new Set(properties.map((m) => m.name)),
        origins: new Map(origins).set(identity, srcPath),
        yields,
      });
    }
  }
  return { exportedNames, surfaceByName };
}

const { exportedNames, surfaceByName } = resolveSurface();

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
  .flatMap((page) => extractMemberUses(page.blocks, new Set(ENTRY_BY_SPECIFIER.keys())))
  .filter((use) => surfaceByName.has(use.rootClass))
  .map((use) => ({ use, resolution: resolveChain(surfaceByName, use) }));

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

  // Every receiver shape this knows how to follow, named one by one.
  //
  // Each was invisible once, and none of the failures announced itself: the
  // sweep stayed green while checking less, and the page using the dropped
  // shape would not have failed either way. A count cannot catch that — losing
  // one shape leaves the total looking healthy — so each is asserted by the
  // class it must land on. [LAW:verifiable-goals]
  it("follows every receiver shape it recognizes", () => {
    const landed = resolvedMembers.map(({ use, resolution }) => ({
      ...use,
      className: "className" in resolution ? resolution.className : "",
    }));
    const classesWhere = (predicate: (u: (typeof landed)[number]) => boolean): string[] =>
      landed.filter(predicate).map((u) => u.className);

    // `layout.getByName("body")!.update` — a hop through a method's return type.
    expect(classesWhere((u) => u.path.length > 0)).toContain("Layout");
    // `new Table().addColumn(…)` — rooted in a constructor, bound to no variable.
    expect(landed.filter((u) => u.text.startsWith("new ")).map((u) => u.rootClass))
      .toContain("Table");
    // `progress.console.print` — a hop through a getter, which has no call signature.
    expect(classesWhere((u) => u.path.includes("console"))).toContain("Console");
    // `host.size().rows` — a hop landing on an interface rather than a class.
    expect(classesWhere((u) => u.path.includes("size"))).toContain("TerminalSize");
  });

  it("resolved the entry points it checks against", () => {
    expect(exportedNames.get("@promptctl/rich-js")?.has("Console")).toBe(true);
    expect(surfaceByName.get("Console")?.members.has("print")).toBe(true);
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
      if (resolution.info.members.has(use.member)) return [];
      return [describeMember(use, resolution.className)];
    });
    expect(ghosts).toEqual([]);
  });
});
