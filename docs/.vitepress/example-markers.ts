/**
 * What a TypeScript fence on a docs page is: the marker vocabulary, and the one
 * parser that reads it.
 *
 * A fence's info string is its language and at most one marker word:
 * ```` ```ts ````, ```` ```ts silent ````. Static is the default and has no
 * word. The build-time runner, the example widget, the docs gate and
 * `test/docs/code-blocks.ts` all read fences through `scanFences`.
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
 * build. `note` is the sentence the reader sees in place of output. Only a
 * block that shows no output has one.
 */
export type MarkerRule =
  | { readonly run: "build"; readonly outcome: "prints" | "silent" | "throws"; readonly note: string | null }
  | { readonly run: "browser"; readonly note: null }
  | { readonly run: "never"; readonly note: string };

export const MARKERS = {
  static: { run: "build", outcome: "prints", note: null },
  silent: {
    run: "build",
    outcome: "silent",
    note: "This example prints nothing. It sets up names the examples below it use.",
  },
  throws: { run: "build", outcome: "throws", note: null },
  live: { run: "browser", note: null },
  shape: { run: "never", note: "Not run: this is a shape to implement, not a complete program." },
  node: {
    run: "never",
    note: "Not run here: it needs a real Node process (a file, stdin, or process exit). Run it locally to see it.",
  },
} as const satisfies Record<string, MarkerRule>;

export type Marker = keyof typeof MARKERS;

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

const FENCE = /^(`{3,})(.*)$/;

/**
 * Every TypeScript fence on one page, in source order.
 *
 * Every fence is tracked, whatever its language, so a line inside a `bash` or
 * output block is never read as the start of TypeScript. An unknown marker word
 * or an unterminated fence throws, naming the page and line: either would
 * otherwise drop code from every reader at once.
 */
export function scanFences(page: string, markdown: string): Fence[] {
  const lines = markdown.split("\n");
  const fences: Fence[] = [];
  let open: { readonly index: number; readonly ticks: string; readonly info: string } | null = null;
  lines.forEach((text, index) => {
    const match = FENCE.exec(text);
    if (match === null) return;
    const [, ticks, info] = match as unknown as [string, string, string];
    if (open === null) {
      open = { index, ticks, info: info.trim() };
      return;
    }
    if (ticks.length < open.ticks.length || info.trim() !== "") return;
    const marker = typescriptMarker(page, open.index + 1, open.info);
    if (marker !== null) {
      fences.push({
        page,
        line: open.index + 1,
        closeLine: index + 1,
        marker,
        code: lines.slice(open.index + 1, index).join("\n"),
      });
    }
    open = null;
  });
  if (open !== null) {
    throw new Error(`docs/${page}:${(open as { index: number }).index + 1} opens a fence that is never closed`);
  }
  return fences;
}

/** The marker of a TypeScript fence's info string, or `null` for another language. */
function typescriptMarker(page: string, line: number, info: string): Marker | null {
  const [language = "", ...words] = info.split(/\s+/);
  if (!TYPESCRIPT.has(language)) return null;
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
