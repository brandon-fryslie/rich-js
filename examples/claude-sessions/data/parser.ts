/**
 * parser.ts — turns raw JSONL records into a clean Block[] for the viewer.
 *
 * Pipeline (each step is a pure data transformation):
 *   raw lines → drop hidden types → dedup streaming chunks
 *              → consume tool_use+tool_result pairs → emit Blocks
 *
 * The parser is intentionally lenient: any line whose shape is unfamiliar
 * is either dropped (when its `type` is in HIDDEN_TYPES) or rendered as a
 * synthetic ErrorBlock so the user can still inspect it via raw view.
 */

import type { RawLine } from "./loader.js";
import type {
  Block,
  HumanBlock,
  AssistantBlock,
  ToolCallBlock,
  SubagentBlock,
  SystemBlock,
  ErrorBlock,
} from "./types.js";

const HIDDEN_TYPES = new Set([
  "file-history-snapshot",
  "progress",
  "queue-operation",
  "last-prompt",
  "pr-link",
]);

interface AssistantContent {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;        // tool_use id
  name?: string;      // tool_use name
  input?: unknown;    // tool_use input
  tool_use_id?: string; // tool_result link
  content?: unknown;  // tool_result content
  is_error?: boolean;
}

interface MessageShape {
  id?: string;
  role?: string;
  model?: string;
  stop_reason?: string | null;
  content?: string | AssistantContent[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface RawRecord {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  isMeta?: boolean;
  isApiErrorMessage?: boolean;
  error?: string;
  promptId?: string;
  subtype?: string;
  durationMs?: number;
  message?: MessageShape;
  toolUseResult?: { agentId?: string } | unknown;
  sourceToolAssistantUUID?: string;
}

/** Extract agentId for a Task tool_use. Prefer the structured
 *  toolUseResult.agentId field on the wrapping user record; fall back to
 *  the tool_result content (sometimes echoed there). Null if none found. */
function extractAgentId(
  userRecord: RawRecord | undefined,
  resolvedContent: AssistantContent | undefined,
): string | null {
  if (userRecord && typeof userRecord.toolUseResult === "object" && userRecord.toolUseResult) {
    const id = (userRecord.toolUseResult as { agentId?: unknown }).agentId;
    if (typeof id === "string" && id.length > 0) return id;
  }
  if (resolvedContent && typeof resolvedContent.content === "object" && resolvedContent.content) {
    const id = (resolvedContent.content as { agentId?: unknown }).agentId;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return JSON.stringify(v);
}

function extractTextFromContent(content: string | AssistantContent[] | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
  }
  return parts.join("\n");
}

function isToolResultContent(content: string | AssistantContent[] | undefined): boolean {
  return Array.isArray(content) && content.some((c) => c.type === "tool_result");
}

function toolResultsByUseId(content: AssistantContent[]): Map<string, AssistantContent> {
  const map = new Map<string, AssistantContent>();
  for (const c of content) {
    if (c.type === "tool_result" && typeof c.tool_use_id === "string") {
      map.set(c.tool_use_id, c);
    }
  }
  return map;
}

function flattenToolResultText(c: AssistantContent): string {
  if (typeof c.content === "string") return c.content;
  if (Array.isArray(c.content)) {
    const parts: string[] = [];
    for (const item of c.content as Array<{ type?: string; text?: string }>) {
      if (item && typeof item.text === "string") parts.push(item.text);
    }
    return parts.join("\n");
  }
  return "";
}

/**
 * Step 1: drop hidden types (unless showHidden is true).
 * Lines without a `type` are always dropped — they're not renderable.
 */
function dropHidden(lines: ReadonlyArray<RawLine>, showHidden: boolean): RawLine[] {
  const out: RawLine[] = [];
  for (const line of lines) {
    const r = line.parsed as RawRecord;
    if (typeof r.type !== "string") continue;
    if (!showHidden && HIDDEN_TYPES.has(r.type)) continue;
    out.push(line);
  }
  return out;
}

/**
 * Step 2: dedup streaming assistant chunks. For consecutive assistant lines
 * sharing the same message.id, keep only the last one. The last record holds
 * the final stop_reason and the complete content; earlier ones are partial.
 */
function dedupStreaming(lines: ReadonlyArray<RawLine>): RawLine[] {
  const out: RawLine[] = [];
  for (const line of lines) {
    const r = line.parsed as RawRecord;
    if (r.type !== "assistant") {
      out.push(line);
      continue;
    }
    const id = r.message?.id;
    if (!id) {
      out.push(line);
      continue;
    }
    // If the previous emitted line is also an assistant with the same id, replace it
    const prev = out[out.length - 1];
    const prevRec = prev?.parsed as RawRecord | undefined;
    if (prev && prevRec?.type === "assistant" && prevRec.message?.id === id) {
      out[out.length - 1] = line;
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Step 3: emit Blocks. Tool-use assistant content blocks are paired with the
 * matching tool_result in the next user message; the standalone tool_result
 * user message is consumed (not emitted as its own Block).
 */
function emitBlocks(lines: ReadonlyArray<RawLine>): Block[] {
  const out: Block[] = [];
  // Map of toolUseId → resolved AssistantContent (the result), populated as
  // we walk forward and consume tool_result user messages.
  const consumedResultIndices = new Set<number>();

  // Pre-index tool_results by tool_use_id → { lineIndex, content }
  const resultIndex = new Map<string, { lineIndex: number; content: AssistantContent }>();
  for (let i = 0; i < lines.length; i++) {
    const r = lines[i]!.parsed as RawRecord;
    if (r.type === "user" && isToolResultContent(r.message?.content)) {
      const map = toolResultsByUseId(r.message!.content as AssistantContent[]);
      for (const [id, content] of map) {
        resultIndex.set(id, { lineIndex: i, content });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (consumedResultIndices.has(i)) continue;
    const line = lines[i]!;
    const r = line.parsed as RawRecord;
    const uuid = r.uuid ?? `line-${line.lineNumber}`;
    const parentUuid = r.parentUuid ?? null;
    const timestamp = r.timestamp ?? "";

    // System turn-duration → SystemBlock
    if (r.type === "system") {
      const block: SystemBlock = {
        kind: "system",
        uuid,
        parentUuid,
        timestamp,
        raw: line.parsed,
        subtype: r.subtype ?? "system",
        durationMs: typeof r.durationMs === "number" ? r.durationMs : null,
      };
      out.push(block);
      continue;
    }

    // API error assistant message
    if (r.type === "assistant" && r.isApiErrorMessage) {
      const text = extractTextFromContent(r.message?.content);
      const block: ErrorBlock = {
        kind: "error",
        uuid,
        parentUuid,
        timestamp,
        raw: line.parsed,
        errorType: r.error ?? "error",
        text: text || asString(r.error) || "(unknown error)",
      };
      out.push(block);
      continue;
    }

    // Assistant message
    if (r.type === "assistant" && r.message) {
      const content = r.message.content;
      const text = extractTextFromContent(content);
      const toolUses: AssistantContent[] = Array.isArray(content)
        ? content.filter((c) => c.type === "tool_use")
        : [];

      // Emit text block first if there is text
      if (text.trim().length > 0) {
        const block: AssistantBlock = {
          kind: "assistant",
          uuid,
          parentUuid,
          timestamp,
          raw: line.parsed,
          text,
          model: r.message.model ?? "(unknown)",
          inputTokens: r.message.usage?.input_tokens ?? 0,
          outputTokens: r.message.usage?.output_tokens ?? 0,
        };
        out.push(block);
      }

      // Emit one block per tool_use (paired with its result)
      for (const tu of toolUses) {
        const toolUseId = tu.id ?? "";
        const toolName = tu.name ?? "(unknown)";
        const resolved = resultIndex.get(toolUseId);
        const resultText = resolved ? flattenToolResultText(resolved.content) : "";
        const isError = resolved?.content.is_error === true;
        if (resolved) consumedResultIndices.add(resolved.lineIndex);

        if (toolName === "Task") {
          const input = (tu.input ?? {}) as Record<string, unknown>;
          const resultUserRecord = resolved
            ? (lines[resolved.lineIndex]!.parsed as RawRecord)
            : undefined;
          const agentId = extractAgentId(resultUserRecord, resolved?.content);
          const block: SubagentBlock = {
            kind: "subagent",
            uuid: `${uuid}#${toolUseId}`,
            parentUuid: uuid,
            timestamp,
            raw: { tool_use: tu, tool_result: resolved?.content ?? null },
            toolUseId,
            subagentType: typeof input["subagent_type"] === "string"
              ? input["subagent_type"] as string
              : "task",
            description: typeof input["description"] === "string"
              ? input["description"] as string
              : "",
            prompt: typeof input["prompt"] === "string"
              ? input["prompt"] as string
              : "",
            resultText,
            hasResult: resolved !== undefined,
            agentId,
          };
          out.push(block);
        } else {
          const block: ToolCallBlock = {
            kind: "tool-call",
            uuid: `${uuid}#${toolUseId}`,
            parentUuid: uuid,
            timestamp,
            raw: { tool_use: tu, tool_result: resolved?.content ?? null },
            toolName,
            toolUseId,
            input: tu.input ?? null,
            result: resultText,
            resultRaw: resolved?.content ?? null,
            isError,
            hasResult: resolved !== undefined,
          };
          out.push(block);
        }
      }
      continue;
    }

    // User message
    if (r.type === "user" && r.message) {
      // Skip pure tool_result messages — they were consumed above
      if (isToolResultContent(r.message.content) && consumedResultIndices.has(i)) {
        continue;
      }
      // Tool results that didn't get paired (orphan) — show as a generic
      // human block with the raw text so the user isn't confused
      const text = typeof r.message.content === "string"
        ? r.message.content
        : extractTextFromContent(r.message.content);
      // Skip empty content
      if (text.trim().length === 0 && !isToolResultContent(r.message.content)) {
        continue;
      }
      const block: HumanBlock = {
        kind: "human",
        uuid,
        parentUuid,
        timestamp,
        raw: line.parsed,
        text: text || "(tool result orphan — see raw view)",
        promptId: typeof r.promptId === "string" ? r.promptId : null,
        isMeta: r.isMeta === true,
      };
      out.push(block);
      continue;
    }

    // Unknown type — synthesize an Error block so user can inspect via raw view
    const fallback: ErrorBlock = {
      kind: "error",
      uuid,
      parentUuid,
      timestamp,
      raw: line.parsed,
      errorType: r.type ?? "unknown",
      text: `(unknown record type: ${r.type ?? "?"})`,
    };
    out.push(fallback);
  }

  return out;
}

export interface ParseOptions {
  readonly showHidden?: boolean;
}

export function parseBlocks(
  lines: ReadonlyArray<RawLine>,
  opts?: ParseOptions,
): Block[] {
  const showHidden = opts?.showHidden === true;
  return emitBlocks(dedupStreaming(dropHidden(lines, showHidden)));
}
