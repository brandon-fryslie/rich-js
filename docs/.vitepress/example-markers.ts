/**
 * What a TypeScript fence on a docs page is: the marker vocabulary, and the one
 * parser that reads it.
 *
 * A fence's info string is its language and at most one marker word:
 * ```` ```ts ````, ```` ```ts silent ````. Static is the default and has no
 * word, and it may sit among VitePress's own fence attributes. The build-time
 * runner and `test/docs/code-blocks.ts` both read fences through `scanFences`.
 *
 * [LAW:one-source-of-truth] That sharing is the point. The symbol-existence
 * sweep once matched fences with its own pattern that accepted only a bare
 * `typescript` or `ts`, so the first marker added to a page would have
 * silently dropped that block from the sweep. With one parser, a block is
 * a TypeScript block for every reader or for none.
 */

/**
 * What happens to a block, and what the reader is told about it.
 *
 * `run` says where the block executes: at build time in the page's chain,
 * in the browser in a live terminal, or nowhere. A build block also says what
 * it must do (print, print nothing, or throw), and breaking that fails the
 * build.
 *
 * The rest is what the example widget shows under the code. `label` names the
 * panel; `caption`, beside it, says where its contents came from, which is
 * what tells a reader the output below is the code above, run. `note` is the
 * sentence shown in place of output; only a block that shows no output has
 * one.
 */
export type MarkerRule =
  | {
      readonly run: "build";
      readonly outcome: "prints" | "silent" | "throws";
      readonly label: string;
      readonly caption: string;
      readonly note: string | null;
    }
  | { readonly run: "browser"; readonly label: string; readonly caption: string; readonly note: null }
  | { readonly run: "never"; readonly label: string; readonly caption: null; readonly note: string };

const RAN = "produced by running the code above";

export const MARKERS = {
  static: { run: "build", outcome: "prints", label: "Output", caption: RAN, note: null },
  silent: {
    run: "build",
    outcome: "silent",
    label: "Output",
    caption: RAN,
    note: "This example prints nothing when it runs.",
  },
  throws: { run: "build", outcome: "throws", label: "Output", caption: `${RAN}, which throws`, note: null },
  live: { run: "browser", label: "Live", caption: "the code above, running in your browser", note: null },
  shape: {
    run: "never",
    label: "Not run",
    caption: null,
    note: "This is a shape to implement, not a complete program.",
  },
  node: {
    run: "never",
    label: "Not run",
    caption: null,
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

/** A fenced block of TypeScript, where it sits on its page. */
export interface Fence {
  readonly page: string;
  /** 1-based line of the opening fence. */
  readonly line: number;
  /** 1-based line of the closing fence. */
  readonly closeLine: number;
  readonly marker: Marker;
  readonly code: string;
}

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/**
 * Every TypeScript fence on one page, in source order.
 *
 * Every fence is tracked, whatever its language, so a line inside a `bash` or
 * output block is never read as the start of TypeScript. A fence is
 * CommonMark's: up to three spaces of indent, a run of backticks or of tildes,
 * closed by a run of the same character at least as long. An unknown marker word
 * or an unterminated fence throws, naming the page and line: either would
 * otherwise drop code from every reader at once.
 */
export function scanFences(page: string, markdown: string): Fence[] {
  // A page saved with CRLF endings is read line by line all the same; a `\r`
  // left on a fence line would stop it matching and hide the page's examples.
  const lines = markdown.split(/\r?\n/);
  const fences: Fence[] = [];
  let open: { readonly index: number; readonly indent: number; readonly run: string; readonly info: string } | null = null;
  lines.forEach((text, index) => {
    const match = FENCE.exec(text);
    if (match === null) return;
    const [, indent, run, info] = match as unknown as [string, string, string, string];
    if (open === null) {
      // A backtick fence's info string cannot hold a backtick: "```ts``` is…" is prose.
      if (run[0] === "`" && info.includes("`")) return;
      open = { index, indent: indent.length, run, info: info.trim() };
      return;
    }
    if (run[0] !== open.run[0] || run.length < open.run.length || info.trim() !== "") return;
    const marker = typescriptMarker(page, open.index + 1, open.info);
    const outdent = new RegExp(`^ {0,${open.indent}}`);
    if (marker !== null) {
      fences.push({
        page,
        line: open.index + 1,
        closeLine: index + 1,
        marker,
        code: lines
          .slice(open.index + 1, index)
          .map((line) => line.replace(outdent, ""))
          .join("\n"),
      });
    }
    open = null;
  });
  if (open !== null) {
    throw new Error(`docs/${page}:${(open as { index: number }).index + 1} opens a fence that is never closed`);
  }
  return fences;
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

/** The marker of a TypeScript fence's info string, or `null` for another language. */
function typescriptMarker(page: string, line: number, info: string): Marker | null {
  const [, language, attributes] = LANGUAGE.exec(info) as unknown as [string, string, string];
  if (!TYPESCRIPT.has(language)) return null;
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
