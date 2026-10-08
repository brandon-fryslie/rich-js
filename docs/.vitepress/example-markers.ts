/// <reference path="./markdown-it-container.d.ts" />
/**
 * What a fenced block on a docs page is: the marker vocabulary a TypeScript
 * fence takes, and the one parser that reads fences.
 *
 * A fence's info string is its language and at most one marker word:
 * ```` ```ts ````, ```` ```ts silent ````. Static is the default and has no
 * word, and it may sit among VitePress's own fence attributes. The build-time
 * runner reads TypeScript through `scanFences`; the docs-example gate reads
 * every block through `scanBlocks`, which `scanFences` is built on.
 *
 * [LAW:one-source-of-truth] That sharing is the point. A sweep of the pages
 * once matched fences with its own pattern that accepted only a bare
 * `typescript` or `ts`, so the first marker added to a page would have
 * silently dropped that block from it. With one parser, a block is
 * a TypeScript block for every reader or for none.
 */

import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import { DRAWN, RAN, RUNNING } from "./example-card.js";

/**
 * What happens to a block, and what the reader is told about it.
 *
 * `run` says where the block executes: at build time in the page's chain,
 * in the browser in a live terminal, or nowhere. Wherever it runs, a block is
 * type-checked, and one that does not compile fails the build. A build block
 * also says what it must do (print, print nothing, or throw), and breaking
 * that fails the build.
 *
 * The rest is what the example card shows under the code. `label` names the
 * panel; `caption`, beside it, says where its contents came from, which is
 * what tells a reader the output below is the code above, run. A block that
 * runs nowhere shows no output, and its `note` says why in its place. What a
 * block that ran shows when it printed nothing is not a marker's to say: an
 * edit of any build block can print nothing, and the card says so for all of
 * them (`PRINTS_NOTHING` in example-card.ts).
 */
export type MarkerRule =
  | { readonly run: "build"; readonly outcome: "prints" | "silent" | "throws"; readonly label: string; readonly caption: string }
  | { readonly run: "browser"; readonly label: string; readonly caption: string }
  | { readonly run: "never"; readonly label: string; readonly note: string };

export const MARKERS = {
  static: { run: "build", outcome: "prints", ...DRAWN },
  silent: { run: "build", outcome: "silent", ...DRAWN },
  throws: { run: "build", outcome: "throws", label: DRAWN.label, caption: `${RAN}, which throws` },
  live: { run: "browser", ...RUNNING },
  shape: { run: "never", label: "Not run", note: "This is a shape to implement, not a complete program." },
  node: {
    run: "never",
    label: "Not run",
    note: "It needs a real Node process (a file, stdin, or process exit). Run it locally to see it.",
  },
} as const satisfies Record<string, MarkerRule>;

export type Marker = keyof typeof MARKERS;

/** The markers whose blocks run at build time, in the page's chain. */
export type BuildMarker = { [M in Marker]: (typeof MARKERS)[M]["run"] extends "build" ? M : never }[Marker];

/** Whether a block runs at build time; the runner's chain is exactly these. */
export function runsAtBuild(fence: Fence): fence is Fence & { readonly marker: BuildMarker } {
  return MARKERS[fence.marker].run === "build";
}

/** The word a page writes for each marker, `static` having none. */
const MARKER_BY_WORD: ReadonlyMap<string, Marker> = new Map(
  (Object.keys(MARKERS) as Marker[]).filter((m) => m !== "static").map((m) => [m, m]),
);

const TYPESCRIPT = new Set(["ts", "typescript"]);

/** The `:::` containers VitePress registers; any other `:::` line is prose. */
const CONTAINERS = ["tip", "info", "warning", "danger", "details", "raw", "v-pre", "code-group"] as const;

/** A block a fence can sit in: a list item, a blockquote, or one of VitePress's containers. */
export type Enclosure = "list item" | "blockquote" | `::: ${(typeof CONTAINERS)[number]}`;

/** A fenced block of any language, where it sits on its page. */
export interface Block {
  readonly page: string;
  /** 1-based line of the opening fence. */
  readonly line: number;
  /** 1-based line of the closing fence. */
  readonly closeLine: number;
  /** What the fence sits in, outermost first; empty at the page's top level. */
  readonly within: readonly Enclosure[];
  /** The heading the fence sits under, as written; null above the page's first. */
  readonly section: string | null;
  /**
   * The language as VitePress's highlighter reads it: lowercased, a `-vue`
   * suffix dropped, `""` for none. A ```` ```TS ```` fence is TypeScript.
   */
  readonly language: string;
  /** The rest of the info string: VitePress's own attributes and any marker word. */
  readonly attributes: string;
  readonly code: string;
}

/** A fenced block of TypeScript, where it sits on its page. */
export interface Fence {
  readonly page: string;
  /** 1-based line of the opening fence. */
  readonly line: number;
  /** 1-based line of the closing fence. */
  readonly closeLine: number;
  readonly within: readonly Enclosure[];
  readonly section: string | null;
  readonly marker: Marker;
  readonly code: string;
}

/**
 * The page's block structure as VitePress parses it: CommonMark with HTML
 * blocks, and VitePress's containers, each matched on the first word of its
 * info string as VitePress matches it. Only the block rules run; nothing here
 * reads inline content.
 *
 * [LAW:one-source-of-truth] Where a fence is, and what it is inside, is the
 * parser's answer, not a second one worked out line by line. A line scanner
 * stood here first and could not see a fence indented four spaces into a list
 * item, which markdown renders all the same: every reader of the page skipped
 * it, and nothing said so.
 */
export const PAGE_PARSER: MarkdownIt = CONTAINERS.reduce(
  (md, name) => md.use(container, name),
  new MarkdownIt({ html: true }),
).use((md) => md.core.ruler.enableOnly(["normalize", "block"]));

/** Reads a heading's inline markup, which `PAGE_PARSER`, block rules only, leaves as written. */
const INLINE_PARSER = new MarkdownIt();

/** A heading's text as the page shows it: its markup (`code`, emphasis, links, escapes) read as what it renders. */
function headingText(markdown: string): string {
  return INLINE_PARSER.parseInline(markdown, {})[0]!.children!.flatMap((child) => (child.type === "text" || child.type === "code_inline" ? [child.content] : [])).join("");
}

const ENCLOSURE: Readonly<Record<string, Enclosure>> = {
  list_item_open: "list item",
  blockquote_open: "blockquote",
  ...Object.fromEntries(CONTAINERS.map((name) => [`container_${name}_open`, `::: ${name}`])),
};

/**
 * A page's lines, split where markdown-it splits them: at `\r\n`, `\r` or
 * `\n`. Every reader that numbers a page's lines numbers them this way, so a
 * line markdown-it reports is the line every reader means.
 */
export function pageLines(markdown: string): string[] {
  return markdown.split(/\r\n?|\n/);
}

/**
 * The index of the line that closes the page's frontmatter, or -1 for a page
 * with none. As VitePress's gray-matter reads it: opened by a first line that
 * starts with `---` and no fourth `-`, closed by the next line that starts
 * with `---`.
 */
export function frontmatterEnd(lines: readonly string[]): number {
  return /^---(?!-)/.test(lines[0] ?? "") ? lines.findIndex((line, i) => i > 0 && line.startsWith("---")) : -1;
}

/**
 * Every fenced block on one page, of any language, in source order.
 *
 * An unterminated fence throws, naming the page and line: markdown closes it at
 * the end of its container, and everything after would be read as code.
 */
export function scanBlocks(page: string, markdown: string): Block[] {
  const lines = pageLines(markdown);
  // Frontmatter is VitePress's to read, never markdown; blanked, so every line keeps its number.
  const close = frontmatterEnd(lines);
  const body = lines.map((line, i) => (i <= close ? "" : line)).join("\n");
  // Every block open around the current token, each an enclosure or not one.
  const open: (Enclosure | null)[] = [];
  const blocks: Block[] = [];
  let section: string | null = null;
  const tokens = PAGE_PARSER.parse(body, {});
  for (const [i, token] of tokens.entries()) {
    if (token.nesting === 1) open.push(ENCLOSURE[token.type] ?? null);
    if (token.nesting === -1) open.pop();
    if (token.type === "heading_open") section = headingText(tokens[i + 1]!.content);
    if (token.type !== "fence") continue;
    const [start, end] = token.map!;
    // markdown-it's own answer: a closed fence spans its content lines plus two fence lines.
    const code = token.content.replace(/\n$/, "");
    if ((token.content === "" ? 0 : code.split("\n").length) !== end - start - 2) {
      throw new Error(`docs/${page}:${start + 1} opens a fence that is never closed`);
    }
    const [, written, attributes] = LANGUAGE.exec(token.info.trim()) as unknown as [string, string, string];
    blocks.push({
      page,
      line: start + 1,
      closeLine: end,
      within: open.filter((enclosure) => enclosure !== null),
      section,
      language: written.replace(/-vue$/, "").toLowerCase(),
      attributes,
      code,
    });
  }
  return blocks;
}

/**
 * Every TypeScript fence on one page, in source order.
 *
 * Read from every block, whatever its language, so a line inside a `bash` or
 * output block is never read as the start of TypeScript. An unknown marker
 * word throws, naming the page and line.
 */
export function scanFences(page: string, markdown: string): Fence[] {
  return typescriptFences(scanBlocks(page, markdown));
}

/** The TypeScript fences among blocks already scanned. */
export function typescriptFences(blocks: readonly Block[]): Fence[] {
  return blocks
    .filter((block) => TYPESCRIPT.has(block.language))
    .map(({ page, line, closeLine, within, section, attributes, code }) => ({ page, line, closeLine, within, section, marker: markerOf(page, line, attributes), code }));
}

/**
 * VitePress's own info-string attributes: highlighted lines (`{2,4}`), line
 * numbers (`:line-numbers`, `:line-numbers=5`, `:no-line-numbers`) and a
 * code-group title (`[config.ts]`). They are VitePress's to read, so they are
 * neither the language nor a marker. VitePress ends the language at the first
 * `{`, `:`, `[` or space, and so does this: a `ts{2}` fence is TypeScript.
 */
const VITEPRESS_ATTRIBUTE = /\{[^}]*\}|\[[^\]]*\]|:(?:no-)?line-numbers(?:=\d+)?/g;
const LANGUAGE = /^([^\s{:[]*)(.*)$/s;

/** The marker a TypeScript fence's attributes name. */
function markerOf(page: string, line: number, attributes: string): Marker {
  const words = attributes.replace(VITEPRESS_ATTRIBUTE, " ").split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return "static";
  const marker = words.length === 1 ? MARKER_BY_WORD.get(words[0]!) : undefined;
  if (marker === undefined) {
    throw new Error(
      `docs/${page}:${line}: unknown example marker "${words.join(" ")}"; ` +
        `a TypeScript fence takes at most one of ${[...MARKER_BY_WORD.keys()].join(", ")}`,
    );
  }
  return marker;
}
