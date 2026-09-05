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
  return extractMemberUses(blocksOf(markdown)).map(signature).sort();
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

  it("reports the page line a use sits on", () => {
    const uses = extractMemberUses(
      blocksOf(
        ["# Title", "", "```typescript", "const c = new Console();", 'c.print("hi");', "```"].join(
          "\n",
        ),
      ),
    );
    expect(uses.map((u) => u.line)).toEqual([5]);
  });
});
