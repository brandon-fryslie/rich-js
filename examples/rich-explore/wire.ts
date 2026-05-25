/**
 * rich-explore — browser bootstrap. Constructs `BrowserTerminalHost` over
 * the xterm.js Terminal provided by the page shell, hands the shared demo
 * body a `MemoryFileSystem` populated with a small but kind-diverse fixture
 * tree, and returns the mount handle.
 *
 * [LAW:one-source-of-truth] The same `run` function from app.ts powers the
 * node and browser entries. No forked code path; the two capabilities are
 * the values that differ.
 *
 * [LAW:dataflow-not-control-flow] The fixture below is data. Adding more
 * files — or a third entry kind — is a matter of extending the tree; no
 * demo-side logic changes.
 */

import {
  BrowserTerminalHost,
  type TerminalHost,
  type XtermTerminal,
} from "../../src/widgets/terminal-host.js";
import {
  MemoryFileSystem,
  type MemoryTree,
} from "../_capabilities/index.js";
import { run } from "./app.js";

export interface MountHandle {
  readonly host: TerminalHost;
  stop(): void;
}

// One small fixture tree exercising every renderer kind so the demo's
// preview pane has something interesting for each:
//   - markdown (`.md`)         → renderMarkdown
//   - source   (`.ts`, `.json` text via `.ts` here) → renderSyntax
//   - json     (`.json`)        → renderJson
//   - directory                 → renderDirectory
//   - binary   (`.png` ext)     → renderBinary (metadata only)
//   - fallback (no extension)   → renderFallback
const README_MD = `# rich-explore (browser fixture)

This is a self-contained in-memory fixture so the demo runs in the browser.

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

const FIXTURE_TREE: MemoryTree = {
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

export function mount(terminal: XtermTerminal): MountHandle {
  const host = new BrowserTerminalHost({ terminal });
  host.start();
  const fs = new MemoryFileSystem(FIXTURE_TREE);
  // `run()` resolves on a quit action; in the browser `q`/Ctrl-C are still
  // delivered by xterm so the same termination path applies. Page shell
  // does not auto-unmount, so the user sees the post-quit alt-screen
  // restore and the tab stays open. A reject after mount logs to the
  // browser console and releases the host so dangling subscribers don't
  // hang on. We deliberately do not poke the shell's #status — mount.ts
  // has already set it to "ready" by the time this could fire, and
  // reaching back into the DOM here would couple wire.ts to shell layout.
  void run(host, fs, fs.homeDir()).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("rich-explore: run() rejected after mount", err);
    host.stop();
  });
  return {
    host,
    stop(): void {
      host.stop();
    },
  };
}

export default mount;
