/**
 * Loads a session JSONL file as raw text + parsed JSON lines.
 *
 * Strategy: synchronous full-file read. Even 50MB files are split + parsed
 * in well under 2s on modern hardware. Streaming is an extension point for
 * future giant-file handling.
 */

import { readFileSync } from "node:fs";

export interface RawLine {
  readonly lineNumber: number;
  readonly raw: string;
  readonly parsed: Record<string, unknown>;
}

export interface LoadResult {
  readonly path: string;
  readonly lines: ReadonlyArray<RawLine>;
  readonly skipped: number;            // unparseable / blank lines skipped
}

export function loadSession(path: string): LoadResult {
  const text = readFileSync(path, "utf-8");
  const rawLines = text.split("\n");
  const lines: RawLine[] = [];
  let skipped = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    if (raw.trim() === "") {
      skipped++;
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      lines.push({ lineNumber: i + 1, raw, parsed });
    } catch {
      skipped++;
    }
  }
  return { path, lines, skipped };
}
