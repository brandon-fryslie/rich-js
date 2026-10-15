/**
 * Scans `<home>/.claude/projects/` for project directories and their session
 * JSONL files. Reads only stats + the last bytes of each file (for the
 * session's title). Skips subagent/tool-results subdirectories —
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
 * How much of a session's end is read for its title: Claude Code re-appends
 * a session's title records as it writes, so the newest sits near the end
 * and this is the window Claude Code itself reads its metadata from.
 */
const TITLE_WINDOW_BYTES = 64 * 1024;

/**
 * A session's title as Claude Code shows it: the newest name a person gave it
 * (`custom-title`), else the newest it was given (`ai-title`), else its
 * `slug`. A line the window's cut ends inside does not parse, and is passed
 * over like any other.
 */
function extractTitle(tail: readonly string[]): string | null {
  const records = tail.flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
  const newest = (name: string) => records.map((r) => r[name]).filter((v): v is string => typeof v === "string").at(-1) ?? null;
  return newest("customTitle") ?? newest("aiTitle") ?? newest("slug");
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
    const title = extractTitle((fs.readLastBytes(full, TITLE_WINDOW_BYTES) ?? "").split("\n"));
    out.push({
      path: full,
      fileName: name.replace(/\.jsonl$/, ""),
      size: s.size,
      mtime: s.mtime,
      title,
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

