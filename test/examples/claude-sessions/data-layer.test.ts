/**
 * Tests the claude-sessions data layer (scanner / loader / global-search)
 * end-to-end against MemoryFileSystem. Pins the contract that the FileSystem
 * capability is sufficient for every I/O the demo body actually performs.
 */

import { describe, it, expect } from "vitest";
import {
  MemoryFileSystem,
  type MemoryTree,
} from "../../../examples/_capabilities/memory-file-system.js";
import { scanProjects } from "../../../examples/claude-sessions/data/scanner.js";
import { loadSession } from "../../../examples/claude-sessions/data/loader.js";
import { searchGlobal } from "../../../examples/claude-sessions/data/global-search.js";

const FIRST_LINE = JSON.stringify({
  type: "user",
  uuid: "u1",
  parentUuid: null,
  timestamp: "2026-05-25T12:00:00Z",
  slug: "rich-js-port",
  message: { role: "user", content: "Hello world prompt" },
});

const SECOND_LINE = JSON.stringify({
  type: "assistant",
  uuid: "u2",
  parentUuid: "u1",
  timestamp: "2026-05-25T12:00:05Z",
  message: {
    id: "msg-1",
    role: "assistant",
    model: "claude-opus",
    content: [{ type: "text", text: "needle response" }],
    usage: { input_tokens: 5, output_tokens: 7 },
  },
});

const SESSION_CONTENT = `${FIRST_LINE}\n${SECOND_LINE}\n`;

const OTHER_SESSION_CONTENT = `${JSON.stringify({
  type: "user",
  uuid: "x1",
  parentUuid: null,
  timestamp: "2026-05-24T08:00:00Z",
  slug: "other-session",
  message: { role: "user", content: "different topic" },
})}\n`;

function buildTree(): MemoryTree {
  return {
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
                      content: SESSION_CONTENT,
                      mtime: new Date("2026-05-25T12:00:15Z"),
                    },
                  },
                },
                "-home-demo-other": {
                  kind: "directory",
                  children: {
                    "older.jsonl": {
                      kind: "file",
                      content: OTHER_SESSION_CONTENT,
                      mtime: new Date("2026-05-24T08:00:00Z"),
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
}

describe("scanProjects against MemoryFileSystem", () => {
  it("discovers projects + sessions and pulls slug from first line", () => {
    const fs = new MemoryFileSystem(buildTree());
    const projects = scanProjects(fs);
    expect(projects).toHaveLength(2);

    // Sorted most-recent-session first
    expect(projects[0]?.dirName).toBe("-home-demo-rich-js");
    expect(projects[0]?.displayName).toBe("home-demo-rich-js");
    expect(projects[0]?.sessions).toHaveLength(1);

    const session = projects[0]!.sessions[0]!;
    expect(session.slug).toBe("rich-js-port");
    expect(session.firstPrompt).toBe("Hello world prompt");
    expect(session.size).toBeGreaterThan(0);
    expect(session.fileName).toBe("fixture-session");
  });

  it("returns empty when ~/.claude/projects is missing", () => {
    const fs = new MemoryFileSystem({
      home: "/home/demo",
      root: { kind: "directory", children: {} },
    });
    expect(scanProjects(fs)).toEqual([]);
  });
});

describe("loadSession against MemoryFileSystem", () => {
  it("parses JSONL lines and tracks skipped blanks", () => {
    const fs = new MemoryFileSystem(buildTree());
    const result = loadSession(
      fs,
      "/home/demo/.claude/projects/-home-demo-rich-js/fixture-session.jsonl",
    );
    expect(result.lines).toHaveLength(2);
    expect(result.skipped).toBe(1); // trailing newline yields one empty line
    expect((result.lines[0]?.parsed as { type?: string }).type).toBe("user");
    expect((result.lines[1]?.parsed as { type?: string }).type).toBe("assistant");
  });

  it("propagates read errors so the demo can surface them as status", () => {
    const fs = new MemoryFileSystem(buildTree());
    expect(() => loadSession(fs, "/missing/path.jsonl")).toThrow();
  });
});

describe("searchGlobal against MemoryFileSystem", () => {
  it("finds substring matches across all sessions", () => {
    const fs = new MemoryFileSystem(buildTree());
    const projects = scanProjects(fs);
    const hits = searchGlobal(fs, projects, "needle");
    expect(hits).toHaveLength(1);
    const hit = hits[0]!;
    expect(hit.sessionPath).toBe(
      "/home/demo/.claude/projects/-home-demo-rich-js/fixture-session.jsonl",
    );
    expect(hit.snippet).toContain("needle");
    expect(hit.uuid).toBe("u2");
  });

  it("returns empty array when query is empty", () => {
    const fs = new MemoryFileSystem(buildTree());
    const projects = scanProjects(fs);
    expect(searchGlobal(fs, projects, "")).toEqual([]);
  });

  it("ignores sessions where the substring is absent", () => {
    const fs = new MemoryFileSystem(buildTree());
    const projects = scanProjects(fs);
    expect(searchGlobal(fs, projects, "definitely-not-in-any-file")).toEqual([]);
  });
});
