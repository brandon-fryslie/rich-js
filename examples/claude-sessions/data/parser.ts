/**
 * parser.ts — turns raw JSONL records into a clean Block[] for the viewer.
 *
 * Pipeline (each step is a pure data transformation):
 *   raw lines → drop hidden types → dedup streaming chunks
 *              → consume tool_use+tool_result pairs → emit Blocks
 *
 * The parser is intentionally lenient: a record of a type `RECORD_TYPES` keeps
 * out of the conversation is dropped, or drawn as a RecordBlock when hidden
 * records are shown, and one of a type it does not name is drawn as a synthetic
 * ErrorBlock so the user can still inspect it via raw view.
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

/**
 * What the viewer does with each record type Claude Code writes: draws it as
 * the conversation, or keeps it out — session state, titles, file history,
 * hook output — until hidden records are shown (`H`). A type it does not name
 * is one this table does not know: it is drawn as an error, so the reader
 * still sees it and the table's gap is visible. One literal, so a type cannot
 * be named twice: a duplicate key does not compile.
 *
 * [LAW:one-source-of-truth] emitBlocks draws exactly the drawn types: its
 * dispatch over them is exhaustive, so a type made drawn here does not compile
 * until it is drawn. A record's type is the one readRecord reads it as.
 */
const RECORD_USE = {
  user: "drawn",
  assistant: "drawn",
  system: "drawn",
  "agent-name": "hidden",
  "ai-title": "hidden",
  "artifact-autoreact-ledger": "hidden",
  "artifact-comment-monitor": "hidden",
  "atis-latch": "hidden",
  attachment: "hidden",
  "bridge-session": "hidden",
  "continued-in": "hidden",
  "cost-state": "hidden",
  "custom-title": "hidden",
  "file-history-delta": "hidden",
  "file-history-snapshot": "hidden",
  "fork-context-ref": "hidden",
  "frame-link": "hidden",
  "history-suppression": "hidden",
  "last-prompt": "hidden",
  mode: "hidden",
  "permission-mode": "hidden",
  "pr-link": "hidden",
  progress: "hidden",
  "queue-operation": "hidden",
  relocated: "hidden",
  summary: "hidden",
  "worktree-state": "hidden",
} as const satisfies Record<string, "drawn" | "hidden">;
type RecordType = keyof typeof RECORD_USE;
export type DrawnRecordType = { [T in RecordType]: (typeof RECORD_USE)[T] extends "drawn" ? T : never }[RecordType];
export type HiddenRecordType = Exclude<RecordType, DrawnRecordType>;

const RECORD_TYPES: ReadonlyMap<string, "drawn" | "hidden"> = new Map(Object.entries(RECORD_USE));
export const HIDDEN_RECORD_TYPES = [...RECORD_TYPES].flatMap(([type, use]) => (use === "hidden" ? [type] : []));

function isDrawn(type: string): type is DrawnRecordType {
  return RECORD_TYPES.get(type) === "drawn";
}

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

export type RawRecord = {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  isMeta?: boolean;
  isApiErrorMessage?: boolean;
  error?: string;
  promptId?: string;
  // A system record's own fields, as unchecked as the JSON they came from:
  // systemEvent reads each one.
  subtype?: unknown;
  durationMs?: unknown;
  content?: unknown;
  commandRun?: unknown;
  hookCount?: unknown;
  hookErrors?: unknown;
  preventedContinuation?: unknown;
  stopReason?: unknown;
  message?: MessageShape;
  toolUseResult?: { agentId?: string } | unknown;
  sourceToolAssistantUUID?: string;
  attachment?: { type?: string; prompt?: string | AssistantContent[]; isMeta?: boolean };
};

/** A line readRecords kept: one with a `type`, read as a record from there on. */
interface RecordLine extends RawLine {
  readonly parsed: RawRecord;
}

/**
 * The tool that runs a subagent: `Agent`, called `Task` before Claude Code
 * renamed it. A call to any other tool ran one too when its result names the
 * agent — a skill run forked, for one — so that is a subagent call as well.
 */
const SUBAGENT_TOOLS = new Set(["Agent", "Task"]);

/** Extract agentId for a subagent tool_use. Prefer the structured
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
 * A record as the parser reads it, and the lines it was read from (`parts`),
 * verbatim, so each block can say exactly which records it is drawn from
 * (`source`) and the raw view shows what Claude Code wrote.
 */
interface Joined {
  readonly line: RecordLine;
  /** The records the line was read from, first to last, as written. */
  readonly parts: readonly RecordLine[];
}

/**
 * The text inside the first `<name>…</name>` in `content`, trimmed; "" when it
 * has none. One whose closing tag is gone runs to the end of `content`: the
 * stager cuts a long record short, and the cut keeps what it says it lost.
 */
function tagged(content: string, name: string): string {
  return content.match(new RegExp(`<${name}>([\\s\\S]*?)(?:</${name}>|$)`))?.[1]?.trim() ?? "";
}

/** A record that runs a slash command is these tags and nothing else. */
const COMMAND = /^(?:\s*<command-(name|message|args)>[\s\S]*?<\/command-\1>)+\s*$/;

/** What a command record says besides its command line: its content, command tags gone and output tags unwrapped. */
function commandOutput(content: string): string {
  return content
    .replace(/<command-(name|message|args)>[\s\S]*?<\/command-\1>/g, "")
    .replace(/<local-command-std(?:out|err)>|<\/local-command-std(?:out|err)>/g, (tag) => (tag.startsWith("</") ? "\n" : ""))
    .trim();
}

/** The command line `content`'s command tags spell — "/btw How are docs built?" — or "" when it has none. */
function commandTags(content: string): string {
  return `${tagged(content, "command-name")} ${tagged(content, "command-args")}`.trim();
}

/** The command line of a record that runs a slash command; "" for any other text. */
function commandLine(content: string): string {
  return COMMAND.test(content) ? commandTags(content) : "";
}

/** The text a user or system record carries; "" for any other. */
function contentOf(r: RawRecord): string {
  return r.type === "user" ? extractTextFromContent(r.message?.content) : r.type === "system" ? asString(r.content) : "";
}

/** The command line an output record names in `commandRun`; "" when it names none. */
function ranCommand(run: unknown): string {
  if (typeof run !== "object" || run === null) return "";
  const { command, args } = run as Record<string, unknown>;
  return `/${asString(command)} ${asString(args)}`.trim();
}

/** `values` as lines of text, the empty ones left out; a value that is not a list is a list of one. */
function linesOf(...values: unknown[]): string {
  return values.flatMap((v) => (Array.isArray(v) ? v : [v])).map(asString).filter((s) => s !== "").join("\n");
}

/**
 * What a system record says. Claude Code writes one for a turn's duration, a
 * slash command and its output, the stop hooks that ran, and notices that are
 * their `content` — an away summary, a compaction, a usage limit. A subtype not
 * named here is drawn by its name and content, so one nobody has seen still
 * reaches the reader.
 */
function systemEvent(r: RawRecord): Pick<SystemBlock, "subtype" | "label" | "text" | "durationMs"> {
  const subtype = typeof r.subtype === "string" ? r.subtype : "system";
  const content = asString(r.content);
  const durationMs = typeof r.durationMs === "number" ? r.durationMs : null;
  switch (subtype) {
    case "turn_duration":
      return { subtype, label: "turn", text: "", durationMs };
    // The command line is the tags of the record that ran the command, which
    // joinCommandRecords sets ahead of its output; an output record with no such
    // record ahead of it names its command in `commandRun`.
    case "local_command": {
      const command = commandTags(content) || ranCommand(r.commandRun);
      return { subtype, label: command || "local command", text: commandOutput(content), durationMs };
    }
    case "stop_hook_summary": {
      const n = r.hookCount;
      const hooks = typeof n === "number" ? `${n} stop hook${n === 1 ? "" : "s"}` : "stop hooks";
      const prevented = r.preventedContinuation === true ? " · prevented continuation" : "";
      return { subtype, label: hooks + prevented, text: linesOf(r.hookErrors, r.stopReason), durationMs };
    }
    default:
      return { subtype, label: subtype.replaceAll("_", " "), text: content, durationMs };
  }
}

/**
 * A record as what it is. Claude Code files a prompt the user sent while a
 * turn ran as an `attachment` of type `queued_command`, with no user record of
 * its own, so that one is read as the user record it stands for.
 */
export function readRecord(r: RawRecord): RawRecord {
  const a = r.attachment;
  if (r.type !== "attachment" || a?.type !== "queued_command") return r;
  return { ...r, type: "user", isMeta: a.isMeta, message: { role: "user", content: a.prompt } };
}

/**
 * Whether the viewer draws `record` in the conversation.
 * [LAW:one-source-of-truth] scripts/stage-claude-sessions.ts stages the card's
 * sessions by it, so the card and the Node script draw the same records.
 */
export function isDrawnRecord(record: Record<string, unknown>): boolean {
  return typeof record["type"] === "string" && isDrawn(readRecord(record as RawRecord).type);
}

/**
 * Step 1: read each line as its record, dropping hidden types (unless
 * showHidden is true). Lines without a `type` are always dropped — they're
 * not renderable.
 */
function readRecords(lines: ReadonlyArray<RawLine>, showHidden: boolean): Joined[] {
  const out: Joined[] = [];
  for (const line of lines) {
    if (typeof line.parsed["type"] !== "string") continue;
    const written = line as RecordLine;
    const read: RecordLine = { ...written, parsed: readRecord(written.parsed) };
    if (!showHidden && RECORD_TYPES.get(read.parsed.type) === "hidden") continue;
    out.push({ line: read, parts: [written] });
  }
  return out;
}

/**
 * Step 2: join one assistant message's records. Claude Code writes each
 * content block of a message — its thinking, its text, each tool call — as a
 * record of its own, every one carrying the message's id, so consecutive
 * assistant lines sharing an id are one message: its content is theirs in
 * order, its parent is the first one's, and the rest of it (stop_reason,
 * usage) is the last one's.
 */
function joinMessageRecords(records: ReadonlyArray<Joined>): Joined[] {
  const out: Joined[] = [];
  for (const next of records) {
    const { line } = next;
    const r = line.parsed;
    const prev = out[out.length - 1];
    const prevRec = prev?.line.parsed;
    const id = r.type === "assistant" ? r.message?.id : undefined;
    if (prev === undefined || id === undefined || prevRec?.type !== "assistant" || prevRec.message?.id !== id) {
      out.push(next);
      continue;
    }
    const blocks = (record: RawRecord) => (Array.isArray(record.message?.content) ? record.message.content : []);
    out[out.length - 1] = {
      line: { ...line, parsed: { ...r, uuid: prevRec.uuid, parentUuid: prevRec.parentUuid, message: { ...r.message!, content: [...blocks(prevRec), ...blocks(r)] } } },
      parts: [...prev.parts, ...next.parts],
    };
  }
  return out;
}

/**
 * Step 2b: join a slash command's records. Claude Code writes the command line
 * — as a user record, or a `local_command` one when it ran mid-turn — and then
 * a `local_command` record of the command's output whose parent it is, so the
 * two are one command: the output record, holding the line's tags ahead of its
 * own, under the line's uuid and parent, where the line stood. They are found
 * by that parent link, not by sitting together, so a hidden record written
 * between them joins or splits nothing whether hidden records are shown or not.
 */
function joinCommandRecords(records: ReadonlyArray<Joined>): Joined[] {
  const out: Joined[] = [];
  const at = new Map<string, number>();
  for (const next of records) {
    const r = next.line.parsed;
    const i = r.type === "system" && r.subtype === "local_command" && typeof r.parentUuid === "string" ? at.get(r.parentUuid) : undefined;
    const prev = i === undefined ? undefined : out[i];
    if (i === undefined || prev === undefined || commandLine(contentOf(prev.line.parsed)) === "") {
      if (typeof r.uuid === "string") at.set(r.uuid, out.length);
      out.push(next);
      continue;
    }
    const ran = prev.line.parsed;
    out[i] = {
      line: { ...next.line, parsed: { ...r, uuid: ran.uuid, parentUuid: ran.parentUuid, content: `${contentOf(ran)}\n${asString(r.content)}` } },
      parts: [...prev.parts, ...next.parts],
    };
  }
  return out;
}

/** Whether `line` is the record that carries the tool call `toolUseId`. */
function carriesToolUse(line: RecordLine, toolUseId: string): boolean {
  const content = line.parsed.message?.content;
  return Array.isArray(content) && content.some((c) => c.type === "tool_use" && c.id === toolUseId);
}

/**
 * Step 3: emit Blocks. Tool-use assistant content blocks are paired with the
 * matching tool_result in the next user message; the standalone tool_result
 * user message is consumed (not emitted as its own Block).
 */
function emitBlocks(joined: ReadonlyArray<Joined>): Block[] {
  const lines = joined.map((j) => j.line);
  const out: Block[] = [];
  // Map of toolUseId → resolved AssistantContent (the result), populated as
  // we walk forward and consume tool_result user messages.
  const consumedResultIndices = new Set<number>();

  // Pre-index tool_results by tool_use_id → { lineIndex, content }
  const resultIndex = new Map<string, { lineIndex: number; content: AssistantContent }>();
  for (let i = 0; i < lines.length; i++) {
    const r = lines[i]!.parsed;
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
    const parts = joined[i]!.parts;
    const r = line.parsed;
    const uuid = r.uuid ?? `line-${line.lineNumber}`;
    const parentUuid = r.parentUuid ?? null;
    const timestamp = r.timestamp ?? "";
    const error = (errorType: string, text: string): ErrorBlock => ({ kind: "error", uuid, parentUuid, timestamp, source: parts, errorType, text });
    const recordType = r.type;

    // A hidden record reaches here only when hidden records are shown, and is
    // drawn by its type; one of a type RECORD_TYPES does not name is an error,
    // so the reader can still inspect it via raw view.
    if (!isDrawn(recordType)) {
      out.push(RECORD_TYPES.has(recordType)
        ? { kind: "record", uuid, parentUuid, timestamp, source: parts, recordType }
        : error(recordType, `(unknown record type: ${recordType})`));
      continue;
    }

    if (recordType === "system") {
      out.push({ kind: "system", uuid, parentUuid, timestamp, source: parts, ...systemEvent(r) });
      continue;
    }

    // API error assistant message
    if (recordType === "assistant" && r.isApiErrorMessage) {
      const text = extractTextFromContent(r.message?.content);
      out.push(error(r.error ?? "error", text || asString(r.error) || "(unknown error)"));
      continue;
    }

    // A known type that is not what Claude Code writes for it: malformed, not unknown.
    if (!r.message) {
      out.push(error(recordType, `(${recordType} record without a message)`));
      continue;
    }

    // Assistant message
    if (recordType === "assistant") {
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
          // Its text and thinking: every record of the message but its tool calls, each its own block below.
          source: parts.filter((part) => !toolUses.some((tu) => carriesToolUse(part, tu.id ?? ""))),
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

        // The records this call is drawn from: the one that made it and, once
        // answered, the one that answered it — each verbatim, and each where a
        // lookup by its uuid finds this block.
        const madeBy = parts.find((part) => carriesToolUse(part, toolUseId)) ?? line;
        const source = resolved ? [madeBy, ...joined[resolved.lineIndex]!.parts] : [madeBy];
        const parentOf = madeBy.parsed.parentUuid ?? null;

        const agentId = extractAgentId(resolved ? lines[resolved.lineIndex]!.parsed : undefined, resolved?.content);
        if (SUBAGENT_TOOLS.has(toolName) || agentId !== null) {
          const input = (tu.input ?? {}) as Record<string, unknown>;
          const text = (...keys: string[]) => keys.map((key) => input[key]).find((v): v is string => typeof v === "string");
          const block: SubagentBlock = {
            kind: "subagent",
            uuid: `${uuid}#${toolUseId}`,
            parentUuid: parentOf,
            timestamp,
            source,
            toolUseId,
            subagentType: text("subagent_type", "skill") ?? "task",
            description: text("description") ?? "",
            prompt: text("prompt", "args") ?? "",
            resultText,
            hasResult: resolved !== undefined,
            agentId,
          };
          out.push(block);
        } else {
          const block: ToolCallBlock = {
            kind: "tool-call",
            uuid: `${uuid}#${toolUseId}`,
            parentUuid: parentOf,
            timestamp,
            source,
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
    if (recordType === "user") {
      // Skip pure tool_result messages — they were consumed above
      if (isToolResultContent(r.message.content) && consumedResultIndices.has(i)) {
        continue;
      }
      // Tool results that didn't get paired (orphan) — show as a generic
      // human block with the raw text so the user isn't confused
      // A prompt that runs a slash command reads as the command line it runs.
      const said = extractTextFromContent(r.message.content);
      const text = commandLine(said) || said;
      // Skip empty content
      if (text.trim().length === 0 && !isToolResultContent(r.message.content)) {
        continue;
      }
      const block: HumanBlock = {
        kind: "human",
        uuid,
        parentUuid,
        timestamp,
        source: parts,
        text: text || "(tool result orphan — see raw view)",
        promptId: typeof r.promptId === "string" ? r.promptId : null,
        isMeta: r.isMeta === true,
      };
      out.push(block);
      continue;
    }

    recordType satisfies never;
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
  return emitBlocks(joinCommandRecords(joinMessageRecords(readRecords(lines, showHidden))));
}
