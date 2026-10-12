/**
 * The files rich-explore browses in its card, where a page has no file system
 * to give it: one of each kind the preview pane draws.
 */
import type { MemoryTree } from "../_capabilities/memory-file-system.js";

// One small fixture tree exercising every renderer kind so the demo's
// preview pane has something interesting for each:
//   - markdown (`.md`)         → renderMarkdown
//   - source   (`.ts`, `.json` text via `.ts` here) → renderSyntax
//   - json     (`.json`)        → renderJson
//   - directory                 → renderDirectory
//   - binary   (`.png` ext)     → renderBinary (metadata only)
//   - fallback (no extension)   → renderFallback
const README_MD = `# rich-explore (the card's files)

This is a self-contained in-memory fixture so the demo runs in its card on the docs site.

## Controls

- **↑/↓** or **j/k** — move selection
- **→/enter/l** — expand a directory
- **←/h** — collapse / go up
- **tab** — switch focus between tree and preview
- **c** — toggle the coverage view (exercises every rich-js export)

The tree below has one file of each renderer kind so the preview pane
demonstrates Markdown, Syntax, JSON, Directory, Binary, and Fallback paths.
`;

const SAMPLE_TS = `// A small TypeScript sample for the syntax renderer.
import type { Renderable } from "./protocol";

export interface Greeting {
  readonly target: string;
  readonly enthusiastic: boolean;
}

export function greet({ target, enthusiastic }: Greeting): string {
  const punct = enthusiastic ? "!" : ".";
  return \`Hello, \${target}\${punct}\`;
}

greet({ target: "world", enthusiastic: true });
`;

const SAMPLE_JSON = JSON.stringify(
  {
    name: "rich-explore",
    kind: "demo",
    capabilities: ["FileSystem", "TerminalHost"],
    renderers: {
      markdown: { ext: ".md" },
      source: { ext: [".ts", ".js", ".py", ".rs"] },
      json: { ext: ".json" },
      directory: { ext: null, note: "any directory entry" },
      binary: { ext: [".png", ".pdf", ".zip"], note: "metadata only" },
      fallback: { ext: null, note: "anything else" },
    },
    nested: { array: [1, 2, 3], deep: { value: true } },
  },
  null,
  2,
);

const NOTES_TXT = `notes (no extension — rendered by the fallback renderer)

The fallback renderer simply prints file contents as plain text. It is
used for any file whose extension is not recognised by fs/kinds.ts.
`;

// "Binary" here is a small ASCII payload, but the FileKind is decided by
// extension — `.png` lands in the binary table without ever touching the
// content, so the metadata-only renderer fires regardless.
const ICON_PNG = "(png bytes elided — the binary renderer reads metadata only)";

export const FIXTURE_TREE: MemoryTree = {
  home: "/home/demo",
  root: {
    kind: "directory",
    children: {
      "README.md": { kind: "file", content: README_MD },
      "notes": { kind: "file", content: NOTES_TXT },
      "config.json": { kind: "file", content: SAMPLE_JSON },
      "icon.png": { kind: "file", content: ICON_PNG },
      src: {
        kind: "directory",
        children: {
          "greet.ts": { kind: "file", content: SAMPLE_TS },
          "protocol.ts": {
            kind: "file",
            content:
              "export interface Renderable {\n  render(): Iterable<string>;\n}\n",
          },
        },
      },
      docs: {
        kind: "directory",
        children: {
          "ARCHITECTURE.md": {
            kind: "file",
            content:
              "# Architecture\n\nrich-explore is built on three layers:\n\n1. **State** — immutable, path-keyed.\n2. **Reducers** — pure functions of `(state, action)`.\n3. **Views** — pure functions of state, rendered via rich-js.\n",
          },
        },
      },
    },
  },
};
