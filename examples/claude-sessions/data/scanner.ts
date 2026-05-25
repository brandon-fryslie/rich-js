/**
 * Scans `<home>/.claude/projects/` for project directories and their session
 * JSONL files. Reads only stats + the first line of each file (for slug
 * extraction). Skips subagent/tool-results subdirectories — only top-level
 * `*.jsonl` in each project directory counts as a "session".
 *
 * [LAW:capabilities-over-context] All filesystem access is via the injected
 * `FileSystem` capability — there is no `node:fs` import here. The same code
 * runs against `NodeFileSystem` in the terminal entry and a
 * `MemoryFileSystem` populated with a fixture in the browser entry.
 */

import type { FileSystem } from "../../_capabilities/index.js";
import type { ProjectMeta, SessionMeta } from "./types.js";

function projectsRoot(fs: FileSystem): string {
  return fs.join(fs.homeDir(), ".claude", "projects");
}

function extractMeta(firstLine: string | null): { slug: string | null; firstPrompt: string | null } {
  if (!firstLine) return { slug: null, firstPrompt: null };
  try {
    const parsed = JSON.parse(firstLine) as Record<string, unknown>;
    const slug = typeof parsed["slug"] === "string" ? parsed["slug"] as string : null;
    let firstPrompt: string | null = null;
    const message = parsed["message"] as Record<string, unknown> | undefined;
    if (message && typeof message["content"] === "string") {
      firstPrompt = (message["content"] as string).slice(0, 200);
    }
    return { slug, firstPrompt };
  } catch {
    return { slug: null, firstPrompt: null };
  }
}

function prettifyDirName(name: string): string {
  // -Users-bmf-code-rich-js  → just trim the leading dash. Reconstructing the
  // original path is ambiguous because both '/' and '-' map to '-' in the
  // encoded form, so we present the encoded name minus the leading dash and
  // let the user infer.
  return name.startsWith("-") ? name.slice(1) : name;
}

function firstLine(text: string | null): string | null {
  if (text === null) return null;
  const nl = text.indexOf("\n");
  return nl >= 0 ? text.slice(0, nl) : text;
}

function scanSessions(fs: FileSystem, projectDir: string): SessionMeta[] {
  const out: SessionMeta[] = [];
  for (const name of fs.readDir(projectDir)) {
    if (!name.endsWith(".jsonl")) continue;
    const full = fs.join(projectDir, name);
    const s = fs.stat(full);
    if (s === null || !s.isFile) continue;
    const head = firstLine(fs.readFirstBytes(full, 4096));
    const { slug, firstPrompt } = extractMeta(head);
    out.push({
      path: full,
      fileName: name.replace(/\.jsonl$/, ""),
      size: s.size,
      mtime: s.mtime,
      slug,
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

