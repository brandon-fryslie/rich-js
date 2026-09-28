/*
 * The docs-example gate: every example on a page shows its real output, or
 * says why it does not, and no output is drawn by hand.
 *
 * Parsing only, like `code-blocks.ts` beside it — markdown text in, findings
 * out — so each rule is exercised against fixture strings. The `.test.ts`
 * beside this file owns the sweep over `docs/`.
 *
 * WHAT COUNTS AS DRAWN OUTPUT is decided by the fence, never by its contents.
 * A block VitePress shows exactly as typed is drawn output: no language, a
 * plain-text name (`text`, `txt`, …), `ansi`, or any name Shiki has no grammar
 * for, which VitePress draws as plain text after a warning. The gate asks the
 * Shiki VitePress itself resolves, so the two cannot disagree about a name.
 * That was measured before it was decided: of the 35 bare fences on the site
 * when this was written, 34 were an example's output typed by hand, and the
 * one that was not — the call sequence in `docs/strip.md` — says nothing
 * about what it holds. Output also hid in `text` (`docs/markup.md` prints a
 * parse error that way), while the other `text` blocks were Go templates.
 * Telling those apart by reading them is the guessing `code-blocks.ts`'s
 * header warns against: a check that invents findings gets correct pages
 * edited to silence it. So a block that is not output names a language Shiki
 * has a grammar for.
 * [LAW:types-are-the-program] The fence is the declared type; the gate reads
 * the declaration, not a guess at the value.
 *
 * Say the blind spot out loud whenever you cite this gate: drawn output inside
 * a fence that names a grammar — printed JSON in `json`, a session typed into
 * `console` or `log` — is not seen.
 */

import { createRequire } from "node:module";
import { scanBlocks, typescriptFences } from "../../docs/.vitepress/example-markers.js";

// Resolved from where VitePress sits, not from here: a second shiki hoisted
// above VitePress's own would answer for a highlighter the site does not use.
const { bundledLanguages } = (await import(
  createRequire(import.meta.resolve("vitepress")).resolve("shiki")
)) as typeof import("shiki");

/** Whether VitePress shows a block of this language exactly as typed: Shiki has no grammar for it. */
const drawn = (language: string): boolean => !Object.hasOwn(bundledLanguages, language);

/**
 * What is wrong with one page, each finding naming the page and, where there
 * is one, the line.
 *
 * No page may carry drawn output: every example shows its real output.
 *
 * An unknown marker word on a TypeScript fence throws from `typescriptFences`,
 * naming the page and line, rather than returning a finding: the build throws
 * on it too, and one reader must not tolerate what the other refuses.
 */
export function pageFindings(page: string, markdown: string): string[] {
  const blocks = scanBlocks(page, markdown);
  typescriptFences(blocks);
  return blocks.filter((block) => drawn(block.language)).map(
    (block) =>
      `docs/${page}:${block.line}: a ${block.language === "" ? "bare" : `\`${block.language}\``} fence is drawn output; ` +
      "delete it and let the example show its real output, or, if it holds something other than output, name a language Shiki has a grammar for",
  );
}
