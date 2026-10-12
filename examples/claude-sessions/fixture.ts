/**
 * The session data the card runs on: one project holding one session, in the
 * layout `~/.claude/projects/` has on disk.
 */
import type { MemoryTree } from "../_capabilities/memory-file-system.js";

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
      content: "Welcome to the claude-sessions demo. This card runs on an in-memory fixture; `npm run sessions` runs the same TUI on ~/.claude/projects/.",
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
          text: "Use the arrow keys to move between blocks, Tab to switch focus between the sidebar and viewer, and `v` to toggle the raw JSONL view. Press `q` to quit.",
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
          text: "The `FileSystem` capability (examples/_capabilities/) is the seam. `NodeFileSystem` wraps node:fs/path/os for the terminal entry; `MemoryFileSystem` serves this embedded fixture to the card. The demo body never branches on environment.",
        },
      ],
      usage: { input_tokens: 78, output_tokens: 64 },
    },
  }),
].join("\n");

export const FIXTURE_TREE: MemoryTree = {
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
