/**
 * Loads a session JSONL file as raw text + parsed JSON lines.
 *
 * Strategy: synchronous full-file read. Even 50MB files are split + parsed
 * in well under 2s on modern hardware. Streaming is an extension point for
 * future giant-file handling.
 *
 * [LAW:effects-at-boundaries] File reads go through the injected
 * `FileSystem`; there is no `node:fs` import. This is the seam that lets
 * the card load an embedded session fixture via the same code path.
 */

import type { FileSystem } from "../../_capabilities/file-system.js";

export interface RawLine {
  readonly lineNumber: number;
  readonly raw: string;
  readonly parsed: Record<string, unknown>;
}

export interface LoadResult {
  readonly path: string;
  readonly lines: ReadonlyArray<RawLine>;
  readonly skipped: number;            // non-blank lines holding no JSON object
}

/**
 * One JSONL line read as a record: the JSON object it holds, or undefined when
 * it holds none — malformed JSON, or JSON that is not an object (`null`, `42`,
 * `[]`). The one reading of a line as a record that the loader and the
 * scanner's title window share.
 */
export function jsonlRecord(line: string): Record<string, unknown> | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function loadSession(fs: FileSystem, path: string): LoadResult {
  const text = fs.readFile(path);
  const rawLines = text.split("\n");
  const lines: RawLine[] = [];
  let skipped = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    // A blank line carries no record, wherever it falls — the newline ending
    // a JSONL file leaves one — so nothing was lost and it is not skipped.
    if (raw.trim() === "") continue;
    const parsed = jsonlRecord(raw);
    if (parsed === undefined) skipped++;
    else lines.push({ lineNumber: i + 1, raw, parsed });
  }
  return { path, lines, skipped };
}
