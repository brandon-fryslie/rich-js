/**
 * Scans ~/.claude/projects/ for project directories and their session JSONL
 * files. Reads only stats + the first line of each file (for slug/firstPrompt).
 * Skips subagent/tool-results subdirectories — only top-level *.jsonl in each
 * project directory counts as a "session".
 */

import { readdirSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ProjectMeta, SessionMeta } from "./types.js";

const PROJECTS_ROOT = join(homedir(), ".claude", "projects");

/**
 * Read up to ~4KB from the start of a file and return the first complete line.
 * Used for cheap slug/firstPrompt extraction without loading large files.
 */
function readFirstLine(path: string): string | null {
  let fd = -1;
  try {
    fd = openSync(path, "r");
    const buf = Buffer.alloc(4096);
    const n = readSync(fd, buf, 0, buf.length, 0);
    if (n === 0) return null;
    const text = buf.toString("utf-8", 0, n);
    const nl = text.indexOf("\n");
    return nl >= 0 ? text.slice(0, nl) : text;
  } catch {
    return null;
  } finally {
    if (fd >= 0) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
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

function scanSessions(projectDir: string): SessionMeta[] {
  const out: SessionMeta[] = [];
  let entries: string[];
  try {
    entries = readdirSync(projectDir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!name.endsWith(".jsonl")) continue;
    const full = join(projectDir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (!s.isFile()) continue;
    const firstLine = readFirstLine(full);
    const { slug, firstPrompt } = extractMeta(firstLine);
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

export function scanProjects(): ProjectMeta[] {
  let dirs: string[];
  try {
    dirs = readdirSync(PROJECTS_ROOT);
  } catch {
    return [];
  }
  const projects: ProjectMeta[] = [];
  for (const dirName of dirs) {
    const projectPath = join(PROJECTS_ROOT, dirName);
    let s;
    try {
      s = statSync(projectPath);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;
    const sessions = scanSessions(projectPath);
    if (sessions.length === 0) continue;
    projects.push({
      dirName,
      displayName: prettifyDirName(dirName),
      path: projectPath,
      sessions,
    });
  }
  // Sort projects by most-recent session activity
  projects.sort((a, b) => {
    const aT = a.sessions[0]?.mtime.getTime() ?? 0;
    const bT = b.sessions[0]?.mtime.getTime() ?? 0;
    return bT - aT;
  });
  return projects;
}

export const PROJECTS_ROOT_PATH = PROJECTS_ROOT;
