/*
 * The docs-example gate: every example on a page shows its real output, or
 * says why it does not, and no output is drawn by hand.
 *
 * Parsing only, like `code-blocks.ts` beside it — markdown text in, findings
 * out — so each rule is exercised against fixture strings. The `.test.ts`
 * beside this file owns the sweep over `docs/`.
 *
 * WHAT COUNTS AS DRAWN OUTPUT is decided by the fence, never by its contents.
 * A block Shiki draws as bare text (no language, or `text`, `txt`, `plain`,
 * `plaintext`) or as terminal output (`ansi`) is drawn output. That was
 * measured before it was decided: of the 35 bare fences on the site when this
 * was written, 34 were an example's output typed by hand, and the one that was
 * not — the call sequence in `docs/strip.md` — says nothing about what it
 * holds. Output also hid in `text` (`docs/markup.md` prints a parse error that
 * way), while the other `text` blocks were Go templates. Telling those apart
 * by reading them is the guessing `code-blocks.ts`'s header warns against: a
 * check that invents findings gets correct pages edited to silence it. So a
 * block that is not output names its language, and a language Shiki has no
 * grammar for goes in `markdown.languageAlias`.
 * [LAW:types-are-the-program] The fence is the declared type; the gate reads
 * the declaration, not a guess at the value.
 *
 * Say the blind spot out loud whenever you cite this gate: drawn output inside
 * a fence that names a code language — printed JSON in a `json` block — is not
 * seen.
 */

import { scanBlocks, scanFences } from "../../docs/.vitepress/example-markers.js";

/** The languages whose blocks are shown exactly as typed: Shiki's plain text, and `ansi`. */
const DRAWN = new Set(["", "text", "txt", "plain", "plaintext", "ansi"]);

/**
 * What is wrong with one page, each finding naming the page and, where there
 * is one, the line.
 *
 * `listed` is whether the page is on `NOT_YET_MIGRATED`. A page off it may
 * carry no drawn output. A page on it must still have something to migrate —
 * a TypeScript fence or drawn output — or the entry is stale, as a
 * `coverage-allowlist.ts` entry is once its export is demonstrated.
 *
 * An unknown marker word on a TypeScript fence throws from `scanFences`,
 * naming the page and line, rather than returning a finding: the build throws
 * on it too, and one reader must not tolerate what the other refuses.
 */
export function pageFindings(page: string, markdown: string, listed: boolean): string[] {
  const fences = scanFences(page, markdown);
  const drawn = scanBlocks(page, markdown).filter((block) => DRAWN.has(block.language));
  if (listed) {
    return fences.length + drawn.length === 0
      ? [`docs/${page}: on NOT_YET_MIGRATED with nothing left to migrate (no TypeScript fence, no drawn output); take it off the list`]
      : [];
  }
  return drawn.map(
    (block) =>
      `docs/${page}:${block.line}: a ${block.language === "" ? "bare" : `\`${block.language}\``} fence is drawn output; ` +
      "delete it and let the example show its real output, or, if it holds something other than output, name its language",
  );
}
