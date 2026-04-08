/**
 * Data types for the Claude Code session browser.
 *
 * Block is a discriminated union — every JSONL line, after streaming dedup
 * and tool-call grouping, becomes one Block. This is the unit the viewer
 * navigates and the renderer dispatches on.
 */

export type BlockKind =
  | "human"
  | "assistant"
  | "tool-call"
  | "subagent"
  | "system"
  | "error";

export interface BlockBase {
  readonly kind: BlockKind;
  readonly uuid: string;
  readonly parentUuid: string | null;
  readonly timestamp: string;       // ISO 8601
  readonly raw: unknown;            // parsed JSON for raw view
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
  readonly subagentType: string;    // from input.subagent_type, fallback "task"
  readonly description: string;     // from input.description
  readonly prompt: string;          // from input.prompt (truncated)
  readonly resultText: string;
  readonly hasResult: boolean;
}

export interface SystemBlock extends BlockBase {
  readonly kind: "system";
  readonly subtype: string;
  readonly durationMs: number | null;
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
  | ErrorBlock;

// --- Sidebar / scanner types ---

export interface SessionMeta {
  readonly path: string;            // absolute path to .jsonl
  readonly fileName: string;        // basename, no .jsonl
  readonly size: number;
  readonly mtime: Date;
  readonly slug: string | null;     // best-effort first-line slug
  readonly firstPrompt: string | null;
}

export interface ProjectMeta {
  readonly dirName: string;         // dir name on disk
  readonly displayName: string;     // pretty version of dir name
  readonly path: string;            // absolute path to project dir
  readonly sessions: ReadonlyArray<SessionMeta>;
}
