/**
 * claude-sessions — browser bootstrap. Constructs `BrowserTerminalHost` over
 * the xterm.js Terminal provided by the page shell, hands the shared demo
 * body a `MemoryFileSystem` populated with an embedded session fixture, and
 * returns the mount handle.
 *
 * [LAW:one-source-of-truth] The same `run` function from app.ts powers the
 * node and browser entries. No forked code path; the two capabilities are
 * the values that differ.
 *
 * [LAW:dataflow-not-control-flow] The fixture below is data. Adding a
 * second session is a matter of adding another file entry; no demo-side
 * logic changes.
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

/**
 * One embedded session — enough to render an interesting first frame.
 *
 * - The first line of the JSONL carries a `slug` field so the scanner's
 *   first-line peek attaches a name to the session in the sidebar.
 * - The records use enough of the real schema (`type`, `uuid`,
 *   `parentUuid`, `timestamp`, `message`) that parser.ts emits real
 *   `HumanBlock` / `AssistantBlock` / `ToolCallBlock` blocks rather than
 *   the unknown-record fallback.
 */
const SESSION_JSONL = [
  JSON.stringify({
    type: "user",
    uuid: "u1",
    parentUuid: null,
    timestamp: "2026-05-25T12:00:00Z",
    slug: "rich-js-port",
    message: {
      role: "user",
      content: "Welcome to the claude-sessions demo. This browser bundle uses an in-memory fixture so the same TUI runs against fixture data instead of ~/.claude/projects/.",
    },
  }),
  JSON.stringify({
    type: "assistant",
    uuid: "u2",
    parentUuid: "u1",
    timestamp: "2026-05-25T12:00:05Z",
    message: {
      id: "msg-1",
      role: "assistant",
      model: "claude-opus-4-7",
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Use the arrow keys to move between blocks, Tab to switch focus between the sidebar and viewer, and `v` to toggle the raw JSONL view. Press `q` to quit (in a real terminal — the browser tab just stays open).",
        },
      ],
      usage: { input_tokens: 42, output_tokens: 58 },
    },
  }),
  JSON.stringify({
    type: "user",
    uuid: "u3",
    parentUuid: "u2",
    timestamp: "2026-05-25T12:00:10Z",
    message: {
      role: "user",
      content: "How is the filesystem isolated in this build?",
    },
  }),
  JSON.stringify({
    type: "assistant",
    uuid: "u4",
    parentUuid: "u3",
    timestamp: "2026-05-25T12:00:15Z",
    message: {
      id: "msg-2",
      role: "assistant",
      model: "claude-opus-4-7",
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "The `FileSystem` capability (examples/_capabilities/) is the seam. `NodeFileSystem` wraps node:fs/path/os for the terminal entry; `MemoryFileSystem` serves this embedded fixture in the browser entry. The demo body never branches on environment.",
        },
      ],
      usage: { input_tokens: 78, output_tokens: 64 },
    },
  }),
].join("\n");

const FIXTURE_TREE: MemoryTree = {
  home: "/home/demo",
  root: {
    kind: "directory",
    children: {
      ".claude": {
        kind: "directory",
        children: {
          projects: {
            kind: "directory",
            children: {
              "-home-demo-rich-js": {
                kind: "directory",
                children: {
                  "fixture-session.jsonl": {
                    kind: "file",
                    content: SESSION_JSONL,
                    mtime: new Date("2026-05-25T12:00:15Z"),
                  },
                },
              },
            },
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
  // run() resolves on a "quit" action — `q` and Ctrl-C both map to quit in
  // keymap.ts, and xterm delivers those keystrokes here just like a terminal
  // would. When that happens the promise resolves cleanly; the page shell
  // does not auto-unmount or close the tab, so the user sees the post-quit
  // alt-screen restore but no further interaction. The promise can also
  // reject if initialization throws — when that happens, log to the browser
  // console and release the host so a partially-started subscription set
  // doesn't hang on. We deliberately do not update the page-shell status
  // badge: mount.ts.tmpl has already set it to "ready" by the time this
  // would fire, and reaching back into the DOM from here would couple
  // wire.ts to the shell's structure (a separate seam).
  void run(host, fs).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("claude-sessions: run() rejected after mount", err);
    host.stop();
  });
  return {
    host,
    stop(): void {
      // Detaching the host's data subscribers is enough to let run()'s
      // outer Promise stop receiving keystrokes. The Promise itself remains
      // pending — that's fine, the page is going away.
      host.stop();
    },
  };
}

export default mount;
