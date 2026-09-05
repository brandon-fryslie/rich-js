/*
 * The block parser, exercised against fixtures rather than against `docs/`.
 *
 * `code-blocks.ts` reads no file and builds no compiler, and this file is the
 * reason that was worth arranging: every rule it implements can be stated as a
 * markdown string in and a shape out. [LAW:effects-at-boundaries]
 *
 * The sweep next door in `symbol-existence.test.ts` cannot do this job, and the
 * distinction is the whole point of having both. That one asserts over the real
 * pages — `resolvedMembers.length >= 50`, "contains `Layout`" — so it can only
 * pin the receiver shapes some page happens to use today. A shape no page uses
 * is invisible to it *and* costs it nothing: the bar stays green whether the
 * parser handles the shape or drops it. That is not hypothetical. The import
 * alias below was reported by review as an unreachable silent drop, and the
 * "follows every receiver shape it recognizes" test could not have found it,
 * because no page aliases an import. A fixture can name a shape the corpus does
 * not contain yet; a corpus assertion can only ever ratify the corpus.
 * [LAW:verifiable-goals]
 */

import { describe, expect, it } from "vitest";

import {
  extractCodeBlocks,
  extractImportedNames,
  extractMemberUses,
  type CodeBlock,
  type MemberUse,
} from "./code-blocks.js";

/**
 * The specifiers a fixture may treat as this package's.
 *
 * The real caller passes `ENTRY_BY_SPECIFIER`'s keys; a fixture passes the one
 * entry point it needs, so that an import from anywhere else is a foreign
 * module by construction rather than by omission.
 */
const OUR_SPECIFIERS: ReadonlySet<string> = new Set(["@promptctl/rich-js"]);

function blocksOf(markdown: string): CodeBlock[] {
  return extractCodeBlocks("fixture.md", markdown);
}

/**
 * The one block a single-block fixture defines.
 *
 * [LAW:parse-dont-validate] Returning `CodeBlock` rather than the first element
 * of an array is what lets the assertions below read the block without asking
 * whether it is there. A fixture that grew a second block, or lost its only
 * one, is a broken fixture and says so here rather than failing later as a
 * confusing assertion on undefined.
 */
function oneBlockOf(markdown: string): CodeBlock {
  const [block, ...rest] = blocksOf(markdown);
  if (!block || rest.length > 0) {
    throw new Error(`fixture defines ${blocksOf(markdown).length} blocks, expected exactly 1`);
  }
  return block;
}

/**
 * A member use as one string, which is the shape every assertion below reads.
 *
 * `Console.print`, `Progress.console.print`, `Layout.getByName.update` — root
 * class, the hops between, then the member. The three fields are asserted
 * together because they are one answer: a use that resolved the root but lost
 * its path is as wrong as one that resolved neither, and comparing them
 * separately lets each half look right on its own.
 */
function signature(use: MemberUse): string {
  return [use.rootClass, ...use.path, use.member].join(".");
}

/**
 * Every use on a page, as a sorted set of signatures.
 *
 * Sorted because the gate consumes the uses as a set and the parser emits them
 * outermost-first, which is an artifact of walking the tree pre-order rather
 * than anything a caller relies on. Asserting the emitted order would fail on a
 * traversal change that altered no behavior. [LAW:behavior-not-structure]
 */
function signaturesIn(markdown: string): string[] {
  return extractMemberUses(blocksOf(markdown), OUR_SPECIFIERS).map(signature).sort();
}

describe("extractCodeBlocks", () => {
  it("takes both spellings of the info string and nothing else", () => {
    const blocks = blocksOf(
      [
        "Prose is not a block.",
        "",
        "```typescript",
        "const a = 1;",
        "```",
        "",
        "```ts",
        "const b = 2;",
        "```",
        "",
        "```bash",
        "npm run build",
        "```",
        "",
        "```",
        "unlabelled",
        "```",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.code)).toEqual(["const a = 1;", "const b = 2;"]);
  });

  it("reports the line of the opening fence, which failures are anchored to", () => {
    const blocks = blocksOf(["# Title", "", "```typescript", "const a = 1;", "```"].join("\n"));
    expect(blocks.map((b) => b.line)).toEqual([3]);
  });

  // An unterminated fence would otherwise swallow the rest of the page into one
  // block, shrinking the sweep with no sign that it shrank. [LAW:no-silent-failure]
  it("throws on a fence that is never closed", () => {
    expect(() => blocksOf(["```typescript", "const a = 1;"].join("\n"))).toThrow(
      /fixture\.md:1 opens a TypeScript fence that is never closed/,
    );
  });
});

describe("extractImportedNames", () => {
  it("records the exported name beside the local one", () => {
    const block = oneBlockOf(
      ["```typescript", 'import { Console, escape as escapeMarkup } from "@promptctl/rich-js";', "```"].join("\n"),
    );
    expect(extractImportedNames(block)).toEqual([
      expect.objectContaining({ specifier: "@promptctl/rich-js", name: "Console", local: "Console" }),
      expect.objectContaining({ specifier: "@promptctl/rich-js", name: "escape", local: "escapeMarkup" }),
    ]);
  });

  // A namespace binding names a module, not any export of it — the same
  // exclusion the demo-coverage gate makes, for the same reason.
  it("ignores namespace and default imports", () => {
    const block = oneBlockOf(
      [
        "```typescript",
        'import * as rich from "@promptctl/rich-js";',
        'import express from "express";',
        "```",
      ].join("\n"),
    );
    expect(extractImportedNames(block)).toEqual([]);
  });
});

describe("extractMemberUses", () => {
  it("binds a variable to the class it was constructed from", () => {
    expect(
      signaturesIn(["```typescript", "const c = new Console();", 'c.print("hi");', "```"].join("\n")),
    ).toEqual(["Console.print"]);
  });

  it("roots a chain in a constructor call bound to no variable", () => {
    expect(
      signaturesIn(
        ["```typescript", 'new Table().addColumn("a").addRow("b");', "```"].join("\n"),
      ),
    ).toEqual(["Table.addColumn", "Table.addColumn.addRow"].sort());
  });

  // `docs/tables.md` writes exactly this, and every member on `grid` was
  // dropped with no report until a binding stopped requiring `new X()`: the
  // declaration recorded nothing, the root resolved to nothing, and a
  // corpus-wide assertion cannot see a shape that was never counted.
  it("binds a variable to the result of a static factory", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'import { Table } from "@promptctl/rich-js";',
          "const grid = Table.grid();",
          "grid.addColumn();",
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Table.grid", "Table.grid.addColumn"].sort());
  });

  it("roots a chain in a static factory bound to no variable", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'import { Table } from "@promptctl/rich-js";',
          'Table.grid().addRow("a");',
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Table.grid", "Table.grid.addRow"].sort());
  });

  // The static-ness is one fact about where the chain starts, and the caller
  // needs it to pick which half of the class to look the first step up on.
  it("marks a chain rooted in a class object, and one rooted in an instance", () => {
    const uses = extractMemberUses(
      blocksOf(
        [
          "```typescript",
          'import { Table } from "@promptctl/rich-js";',
          "const grid = Table.grid();",
          "grid.addColumn();",
          "const table = new Table();",
          "table.addRow();",
          "```",
        ].join("\n"),
      ),
      OUR_SPECIFIERS,
    );
    expect(
      Object.fromEntries(uses.map((u) => [signature(u), u.rootIsClassObject])),
    ).toEqual({
      "Table.grid": true,
      "Table.grid.addColumn": true,
      "Table.addRow": false,
    });
  });

  // `docs/console.md` binds `output` to `console.endCapture()` in one section
  // and to an array in another. An array describes no receiver, and a
  // declaration that recorded nothing would leave the name looking unbound — so
  // the fallback-forward rule would reach past the array to the earlier
  // section's string and report the array's members against it. A name a page
  // binds is bound. [LAW:parse-dont-validate]
  it("lets a declaration it cannot follow still take the name", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          "const out = new Console();",
          "```",
          "",
          "```typescript",
          "const out: string[] = [];",
          "out.push('x');",
          "```",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // The same rule against the imports: a page may name a local after a class it
  // also imported, and the local wins.
  it("lets a local declaration shadow an imported class of the same name", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'import { Table } from "@promptctl/rich-js";',
          "const Table = [1, 2];",
          "Table.map((n) => n);",
          "```",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A bare name that is neither declared nor imported from this package is
  // someone else's; only the import makes `Table` mean our class object.
  it("does not treat an undeclared bare name as a class object", () => {
    expect(
      signaturesIn(["```typescript", "SomeOtherLib.build().run();", "```"].join("\n")),
    ).toEqual([]);
  });

  // Following declarations back to their origin is recursive, so a page whose
  // declarations reference each other in a cycle must terminate rather than
  // taking the whole suite down with a stack overflow.
  it("gives up on a cycle between declarations rather than recursing forever", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          "const a = b.x;",
          "const b = a.y;",
          "a.print();",
          "```",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("treats a property hop as a hop like any other", () => {
    expect(
      signaturesIn(
        ["```typescript", "const p = new Progress();", 'p.console.print("hi");', "```"].join("\n"),
      ),
    ).toEqual(["Progress.console", "Progress.console.print"].sort());
  });

  it("unwraps a non-null assertion between the root and the member", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          "const layout = new Layout();",
          'layout.getByName("body")!.update("x");',
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Layout.getByName", "Layout.getByName.update"].sort());
  });

  // `docs/strip.md` declares `const strip = new Strip(…)` and, 130 lines later,
  // `const strip = new FlexStrip(…)`. Last-one-wins would check the first
  // section's uses against the second section's class.
  it("binds a use to the nearest preceding declaration of its name", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          "const strip = new Strip();",
          "strip.join();",
          "```",
          "",
          "```typescript",
          "const strip = new FlexStrip();",
          "strip.join();",
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Strip.join", "FlexStrip.join"].sort());
  });

  // A page is one running document: `docs/markup.md` calls `console.print` in
  // its first block and constructs the `Console` five sections later.
  it("falls back to a following declaration when none precedes", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'console.print("hi");',
          "```",
          "",
          "```typescript",
          "const console = new Console();",
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Console.print"]);
  });

  // Both arms of the alias case. A root class taken verbatim from the
  // identifier after `new` names something the surface map has never heard of,
  // and an unrecognized root is dropped as someone else's surface — so one
  // alias would take a whole page's member calls out of the check with no
  // report at all. [LAW:no-silent-failure]
  it("resolves an aliased class through the page's imports", () => {
    const imports = 'import { Console as RichConsole, Table as RichTable } from "@promptctl/rich-js";';
    expect(
      signaturesIn(
        [
          "```typescript",
          imports,
          "const c = new RichConsole();",
          'c.print("hi");',
          'new RichTable().addRow("a");',
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Console.print", "Table.addRow"].sort());
  });

  it("resolves an alias imported in a different block than it is used", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'import { Console as RichConsole } from "@promptctl/rich-js";',
          "```",
          "",
          "```typescript",
          "const c = new RichConsole();",
          'c.print("hi");',
          "```",
        ].join("\n"),
      ),
    ).toEqual(["Console.print"]);
  });

  // The regex version of this file reported four defects that were not defects:
  // `docs/tree.md` builds leaves named `"console.test.ts"`, and `docs/console.md`
  // opens with the comment `// shared/console.ts`. A check that invents findings
  // is worse than none, because someone eventually edits a correct page to
  // silence it. [LAW:types-are-the-program]
  it("sees neither string literals nor comments as property access", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          "// shared/console.ts",
          "const c = new Console();",
          'const files = ["console.test.ts", "strip.test.ts"];',
          "```",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("drops a receiver the page never constructed", () => {
    expect(
      signaturesIn(["```typescript", "someUnknownThing.print();", "```"].join("\n")),
    ).toEqual([]);
  });

  // Translating an alias imported from a module this package does not own
  // would turn a safe drop into a confident wrong answer: the third-party
  // object's members would be checked against our class of the same name.
  //
  // The root stays `X`, the name the page wrote. That is the whole mechanism —
  // the caller drops receivers whose class its surface map does not recognize,
  // and `X` is not recognized, whereas `Layout` would have been.
  // [LAW:no-silent-failure]
  it("does not translate an alias imported from a foreign module", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'import { Layout as X } from "some-other-lib";',
          "const x = new X();",
          "x.whateverThatLibraryHas();",
          "```",
        ].join("\n"),
      ),
    ).toEqual(["X.whateverThatLibraryHas"]);
  });

  // The same last-one-wins hazard the declarations already avoid. One page may
  // introduce an alias, use it, then rebind the same local name to a different
  // class in a later section.
  it("binds an alias to the nearest preceding import of its name", () => {
    expect(
      signaturesIn(
        [
          "```typescript",
          'import { Strip as S } from "@promptctl/rich-js";',
          "new S().join();",
          "```",
          "",
          "```typescript",
          'import { FlexStrip as S } from "@promptctl/rich-js";',
          "new S().join();",
          "```",
        ].join("\n"),
      ),
    ).toEqual(["FlexStrip.join", "Strip.join"]);
  });

  it("reports the page line a use sits on", () => {
    const uses = extractMemberUses(
      blocksOf(
        ["# Title", "", "```typescript", "const c = new Console();", 'c.print("hi");', "```"].join(
          "\n",
        ),
      ),
      OUR_SPECIFIERS,
    );
    expect(uses.map((u) => u.line)).toEqual([5]);
  });
});
