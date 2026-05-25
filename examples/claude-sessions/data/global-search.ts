/**
 * Global search: scans every (project, session) JSONL file for a substring
 * match and returns hits with enough context to open and jump to them.
 *
 * Synchronous by design — tested fast enough on ~10K files with early
 * termination at maxHits. Streaming/async is a future extension if needed.
 *
 * [LAW:capabilities-over-context] All file reads go through the injected
 * `FileSystem`; no `node:fs` import. Browser bundles supply a
 * `MemoryFileSystem` and the search runs against fixture data without any
 * code-path branching.
 */

import type { FileSystem } from "../../_capabilities/index.js";
import type { ProjectMeta } from "./types.js";

export interface GlobalHit {
  readonly projectIndex: number;
  readonly sessionIndex: number;
  readonly sessionPath: string;
  readonly projectDisplayName: string;
  readonly sessionLabel: string;
  readonly lineNumber: number;
  readonly snippet: string;
  readonly uuid: string | null;
}

export interface GlobalSearchOptions {
  readonly maxHits?: number;
  readonly maxFileSizeMB?: number;
}

function makeSnippet(line: string, matchStart: number, radius = 60): string {
  const lo = Math.max(0, matchStart - radius);
  const hi = Math.min(line.length, matchStart + radius);
  const leading = lo > 0 ? "…" : "";
  const trailing = hi < line.length ? "…" : "";
  const raw = line.slice(lo, hi);
  // Collapse whitespace runs so snippet fits one visual line
  return leading + raw.replace(/\s+/g, " ") + trailing;
}

function extractUuid(line: string): string | null {
  // Regex-only by design — JSON.parse on a multi-MB line is expensive and
  // any line that hit a substring match is already a candidate to open.
  // The uuid pattern is unambiguous enough that false positives are
  // tolerable (they map to "no block found by uuid" downstream, which
  // gracefully falls back to opening the session at line 0).
  const m = line.match(/"uuid"\s*:\s*"([^"]+)"/);
  return m ? (m[1] ?? null) : null;
}

export function searchGlobal(
  fs: FileSystem,
  projects: ReadonlyArray<ProjectMeta>,
  query: string,
  opts?: GlobalSearchOptions,
): GlobalHit[] {
  if (query.length === 0) return [];
  const needle = query.toLowerCase();
  const maxHits = opts?.maxHits ?? 200;
  const maxBytes = (opts?.maxFileSizeMB ?? 25) * 1024 * 1024;
  const hits: GlobalHit[] = [];

  outer: for (let pi = 0; pi < projects.length; pi++) {
    const project = projects[pi]!;
    for (let si = 0; si < project.sessions.length; si++) {
      const session = project.sessions[si]!;
      if (session.size > maxBytes) continue;

      let text: string;
      try {
        text = fs.readFile(session.path);
      } catch {
        continue;
      }
      // Cheap pre-filter: skip files that don't contain the needle at all
      if (text.toLowerCase().indexOf(needle) < 0) continue;

      const lines = text.split("\n");
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li]!;
        if (line.length === 0) continue;
        const lower = line.toLowerCase();
        const pos = lower.indexOf(needle);
        if (pos < 0) continue;

        hits.push({
          projectIndex: pi,
          sessionIndex: si,
          sessionPath: session.path,
          projectDisplayName: project.displayName,
          sessionLabel: session.slug ?? session.fileName.slice(0, 8),
          lineNumber: li + 1,
          snippet: makeSnippet(line, pos),
          uuid: extractUuid(line),
        });
        if (hits.length >= maxHits) break outer;
      }
    }
  }

  return hits;
}
