/**
 * Scans `<home>/.claude/projects/` for project directories and their session
 * JSONL files. Reads only stats + the first bytes of each file (for the
 * session's title and first prompt). Skips subagent/tool-results subdirectories —
 * only top-level `*.jsonl` in each project directory counts as a "session".
 *
 * [LAW:effects-at-boundaries] All filesystem access is via the injected
 * `FileSystem` capability — there is no `node:fs` import here. The same code
 * runs against `NodeFileSystem` in the terminal entry and a
 * `MemoryFileSystem` populated with a fixture in the card entry.
 */

import type { FileSystem } from "../../_capabilities/file-system.js";
import type { ProjectMeta, SessionMeta } from "./types.js";

function projectsRoot(fs: FileSystem): string {
  return fs.join(fs.homeDir(), ".claude", "projects");
}

/**
 * A session's title as Claude Code names it: the name a person gave it
 * (`custom-title`), else the one it was given (`ai-title`), else its `slug`.
 * Each is a record of its own, written near the top of the file; the first
 * prompt is the first record's, when that is a prompt. The line the head's
 * cut ends inside does not parse, and is passed over like any other.
 */
function extractMeta(head: readonly string[]): { title: string | null; firstPrompt: string | null } {
  const records = head.flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
  const field = (name: string) => records.map((r) => r[name]).find((v): v is string => typeof v === "string") ?? null;
  const message = records[0]?.["message"] as Record<string, unknown> | undefined;
  const firstPrompt = typeof message?.["content"] === "string" ? message["content"].slice(0, 200) : null;
  return { title: field("customTitle") ?? field("aiTitle") ?? field("slug"), firstPrompt };
}

function prettifyDirName(name: string): string {
  // -Users-bmf-code-rich-js  → just trim the leading dash. Reconstructing the
  // original path is ambiguous because both '/' and '-' map to '-' in the
  // encoded form, so we present the encoded name minus the leading dash and
  // let the user infer.
  return name.startsWith("-") ? name.slice(1) : name;
}

function scanSessions(fs: FileSystem, projectDir: string): SessionMeta[] {
  const out: SessionMeta[] = [];
  for (const name of fs.readDir(projectDir)) {
    if (!name.endsWith(".jsonl")) continue;
    const full = fs.join(projectDir, name);
    const s = fs.stat(full);
    if (s === null || !s.isFile) continue;
    const { title, firstPrompt } = extractMeta((fs.readFirstBytes(full, 4096) ?? "").split("\n"));
    out.push({
      path: full,
      fileName: name.replace(/\.jsonl$/, ""),
      size: s.size,
      mtime: s.mtime,
      title,
      firstPrompt,
    });
  }
  out.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return out;
}

export function scanProjects(fs: FileSystem): ProjectMeta[] {
  const root = projectsRoot(fs);
  const dirs = fs.readDir(root);
  const projects: ProjectMeta[] = [];
  for (const dirName of dirs) {
    const projectPath = fs.join(root, dirName);
    const s = fs.stat(projectPath);
    if (s === null || !s.isDirectory) continue;
    const sessions = scanSessions(fs, projectPath);
    if (sessions.length === 0) continue;
    projects.push({
      dirName,
      displayName: prettifyDirName(dirName),
      path: projectPath,
      sessions,
    });
  }
  projects.sort((a, b) => {
    const aT = a.sessions[0]?.mtime.getTime() ?? 0;
    const bT = b.sessions[0]?.mtime.getTime() ?? 0;
    return bT - aT;
  });
  return projects;
}

