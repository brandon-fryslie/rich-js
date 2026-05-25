/**
 * Behavioural tests for MemoryFileSystem — the browser-side FileSystem
 * implementation backed by an in-memory tree. Pins the contract the data
 * layer of claude-sessions (and downstream demos) depends on.
 */

import { describe, it, expect } from "vitest";
import {
  MemoryFileSystem,
  type MemoryTree,
} from "../../../examples/_capabilities/memory-file-system.js";

function tree(home: string, files: Record<string, string>): MemoryTree {
  // Helper: build a tree from a flat map of absolute paths → contents.
  type Dir = { kind: "directory"; children: Record<string, Dir | { kind: "file"; content: string }> };
  const root: Dir = { kind: "directory", children: {} };
  const homeSegments = home.split("/").filter((s) => s.length > 0);
  for (const [path, content] of Object.entries(files)) {
    const segments = path.split("/").filter((s) => s.length > 0);
    if (segments.length < homeSegments.length) {
      throw new Error(`Test fixture: path ${path} is outside home ${home}`);
    }
    for (let i = 0; i < homeSegments.length; i++) {
      if (segments[i] !== homeSegments[i]) {
        throw new Error(`Test fixture: path ${path} is outside home ${home}`);
      }
    }
    let cursor: Dir = root;
    for (let i = homeSegments.length; i < segments.length - 1; i++) {
      const name = segments[i]!;
      const next = cursor.children[name];
      if (next === undefined) {
        const fresh: Dir = { kind: "directory", children: {} };
        cursor.children[name] = fresh;
        cursor = fresh;
      } else if (next.kind === "file") {
        throw new Error(`Test fixture: ${name} is a file but a parent is needed`);
      } else {
        cursor = next as Dir;
      }
    }
    cursor.children[segments[segments.length - 1]!] = { kind: "file", content };
  }
  return { home, root: root as MemoryTree["root"] };
}

describe("MemoryFileSystem path operations", () => {
  const fs = new MemoryFileSystem({ home: "/home/x", root: { kind: "directory", children: {} } });

  it("join concatenates segments with slash", () => {
    expect(fs.join("a", "b", "c")).toBe("a/b/c");
  });

  it("join treats absolute mid-list as reset", () => {
    expect(fs.join("a", "/b", "c")).toBe("/b/c");
  });

  it("join collapses repeats and resolves . and ..", () => {
    expect(fs.join("/a/b", "..", "c")).toBe("/a/c");
    expect(fs.join("/a", ".", "b")).toBe("/a/b");
    expect(fs.join("/a//b", "c")).toBe("/a/b/c");
  });

  it("basename returns last segment", () => {
    expect(fs.basename("/a/b/c.txt")).toBe("c.txt");
    expect(fs.basename("/a/b/")).toBe("b");
    expect(fs.basename("c.txt")).toBe("c.txt");
  });

  it("basename strips ext when matched", () => {
    expect(fs.basename("/a/b/c.txt", ".txt")).toBe("c");
    expect(fs.basename("/a/b/c.txt", ".md")).toBe("c.txt");
  });

  it("dirname returns parent", () => {
    expect(fs.dirname("/a/b/c.txt")).toBe("/a/b");
    expect(fs.dirname("/a")).toBe("/");
    expect(fs.dirname("/")).toBe("/");
  });
});

describe("MemoryFileSystem lookup operations", () => {
  const fixture = tree("/home/x", {
    "/home/x/.claude/projects/proj-a/session-1.jsonl": "line-1\nline-2\n",
    "/home/x/.claude/projects/proj-a/session-2.jsonl": "",
    "/home/x/.claude/projects/proj-b/session-3.jsonl": "alone",
  });
  const fs = new MemoryFileSystem(fixture);

  it("homeDir returns the configured home", () => {
    expect(fs.homeDir()).toBe("/home/x");
  });

  it("exists reports files and directories", () => {
    expect(fs.exists("/home/x/.claude/projects")).toBe(true);
    expect(fs.exists("/home/x/.claude/projects/proj-a/session-1.jsonl")).toBe(true);
    expect(fs.exists("/home/x/.claude/projects/proj-a/missing.jsonl")).toBe(false);
    expect(fs.exists("/elsewhere")).toBe(false);
  });

  it("readDir returns child names", () => {
    expect(fs.readDir("/home/x/.claude/projects").sort()).toEqual([
      "proj-a",
      "proj-b",
    ]);
    expect(fs.readDir("/home/x/.claude/projects/proj-a").sort()).toEqual([
      "session-1.jsonl",
      "session-2.jsonl",
    ]);
    expect(fs.readDir("/missing")).toEqual([]);
  });

  it("stat distinguishes file from directory", () => {
    const fileStat = fs.stat("/home/x/.claude/projects/proj-a/session-1.jsonl");
    expect(fileStat?.isFile).toBe(true);
    expect(fileStat?.isDirectory).toBe(false);
    expect(fileStat?.size).toBeGreaterThan(0);

    const dirStat = fs.stat("/home/x/.claude/projects/proj-a");
    expect(dirStat?.isFile).toBe(false);
    expect(dirStat?.isDirectory).toBe(true);
  });

  it("stat returns null for missing paths", () => {
    expect(fs.stat("/home/x/.claude/missing")).toBeNull();
  });

  it("readFile returns full contents", () => {
    expect(fs.readFile("/home/x/.claude/projects/proj-a/session-1.jsonl"))
      .toBe("line-1\nline-2\n");
  });

  it("readFile throws on missing path", () => {
    expect(() => fs.readFile("/home/x/.claude/missing")).toThrow();
  });

  it("readFirstBytes returns a prefix of file contents", () => {
    expect(fs.readFirstBytes(
      "/home/x/.claude/projects/proj-a/session-1.jsonl",
      4,
    )).toBe("line");
  });

  it("readFirstBytes returns null for empty or missing files", () => {
    expect(fs.readFirstBytes(
      "/home/x/.claude/projects/proj-a/session-2.jsonl",
      32,
    )).toBeNull();
    expect(fs.readFirstBytes("/missing", 32)).toBeNull();
  });
});
