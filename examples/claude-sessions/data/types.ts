/**
 * Data types for the Claude Code session browser.
 *
 * Block is a discriminated union — every JSONL line, after streaming dedup
 * and tool-call grouping, becomes one Block. This is the unit the viewer
 * navigates and the renderer dispatches on.
 */

import type { RawLine } from "./loader.js";

export type BlockKind =
  | "human"
  | "assistant"
  | "tool-call"
  | "subagent"
  | "system"
  | "record"
  | "error";

export interface BlockBase {
  readonly kind: BlockKind;
  readonly uuid: string;
  readonly parentUuid: string | null;
  readonly timestamp: string;       // ISO 8601
  /** The JSONL records this block is drawn from, verbatim and in file order
   *  (parser.ts): what its raw view shows, and what a lookup by a record's
   *  uuid finds it by (state.ts, blockIndexOf). */
  readonly source: readonly RawLine[];
}

export interface HumanBlock extends BlockBase {
  readonly kind: "human";
  readonly text: string;
  readonly promptId: string | null;
  readonly isMeta: boolean;         // command/system injected
}

export interface AssistantBlock extends BlockBase {
  readonly kind: "assistant";
  readonly text: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ToolCallBlock extends BlockBase {
  readonly kind: "tool-call";
  readonly toolName: string;
  readonly toolUseId: string;
  readonly input: unknown;
  readonly result: string;          // stringified for display
  readonly resultRaw: unknown;      // for raw view
  readonly isError: boolean;
  readonly hasResult: boolean;
}

export interface SubagentBlock extends BlockBase {
  readonly kind: "subagent";
  readonly toolUseId: string;
  readonly subagentType: string;    // input.subagent_type, or a forked skill's input.skill; else "task"
  readonly description: string;     // from input.description
  readonly prompt: string;          // input.prompt, or a forked skill's input.args
  readonly resultText: string;
  readonly hasResult: boolean;
  /** Short agent id used to locate the subagent's own JSONL file. Null if
   *  the tool result didn't carry one (rare — usually early-terminated runs). */
  readonly agentId: string | null;
}

export interface SystemBlock extends BlockBase {
  readonly kind: "system";
  readonly subtype: string;
  readonly durationMs: number | null;
}

/** A record the viewer keeps out of the conversation (parser.ts, RECORD_TYPES), drawn when hidden records are shown. */
export interface RecordBlock extends BlockBase {
  readonly kind: "record";
  readonly recordType: string;
}

export interface ErrorBlock extends BlockBase {
  readonly kind: "error";
  readonly errorType: string;
  readonly text: string;
}

export type Block =
  | HumanBlock
  | AssistantBlock
  | ToolCallBlock
  | SubagentBlock
  | SystemBlock
  | RecordBlock
  | ErrorBlock;

// --- Sidebar / scanner types ---

export interface SessionMeta {
  readonly path: string;            // absolute path to .jsonl
  readonly fileName: string;        // basename, no .jsonl
  readonly size: number;
  readonly mtime: Date;
  readonly title: string | null;    // custom-title, else ai-title, else slug (scanner.ts)
}

export interface ProjectMeta {
  readonly dirName: string;         // dir name on disk
  readonly displayName: string;     // pretty version of dir name
  readonly path: string;            // absolute path to project dir
  readonly sessions: ReadonlyArray<SessionMeta>;
}
