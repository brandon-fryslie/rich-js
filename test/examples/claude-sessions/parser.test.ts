/**
 * Pins how parseBlocks reads an assistant message Claude Code wrote one
 * content block per record: the message is all of them, not its last record,
 * and it sits where its first record does — under the prompt it answers.
 */
import { describe, expect, it } from "vitest";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import type { RawLine } from "../../../examples/claude-sessions/data/loader.js";
import { HIDDEN_RECORD_TYPES, parseBlocks } from "../../../examples/claude-sessions/data/parser.js";
import { blockIndexOf, initialState, jumpToParent, selectedBlock, toggleHidden, type AppState } from "../../../examples/claude-sessions/state.js";

function lines(records: readonly Record<string, unknown>[]): RawLine[] {
  return records.map((parsed, i) => ({ lineNumber: i + 1, raw: JSON.stringify(parsed), parsed }));
}

const part = (uuid: string, content: unknown, stop_reason: string, parentUuid = "p0") => ({
  type: "assistant",
  uuid,
  parentUuid,
  timestamp: "2026-10-04T07:00:00Z",
  message: { id: "msg-1", role: "assistant", model: "claude-opus-5-5", stop_reason, content: [content], usage: { input_tokens: 2, output_tokens: 9 } },
});

describe("parseBlocks", () => {
  it("reads one message written as a record per content block as all of its blocks", () => {
    const blocks = parseBlocks(lines([
      part("a1", { type: "text", text: "Running the tests first." }, "tool_use"),
      part("a2", { type: "tool_use", id: "t1", name: "Bash", input: { command: "npm test" } }, "tool_use"),
      {
        type: "user",
        uuid: "u1",
        timestamp: "2026-10-04T07:00:05Z",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "14 passed", is_error: false }] },
      },
    ]));
    expect(blocks.map((block) => block.kind)).toEqual(["assistant", "tool-call"]);
    expect(blocks[0]).toMatchObject({ kind: "assistant", text: "Running the tests first." });
    expect(blocks[1]).toMatchObject({ kind: "tool-call", toolName: "Bash", result: "14 passed" });
  });

  it("places a message written as several records under the prompt it answers", () => {
    const blocks = parseBlocks(lines([
      { type: "user", uuid: "p0", parentUuid: null, timestamp: "2026-10-04T06:59:59Z", message: { role: "user", content: "Run the tests." } },
      part("a1", { type: "text", text: "Running them." }, "tool_use", "p0"),
      part("a2", { type: "tool_use", id: "t1", name: "Bash", input: { command: "npm test" } }, "tool_use", "a1"),
      part("a3", { type: "tool_use", id: "t2", name: "Bash", input: { command: "npm run lint" } }, "tool_use", "a2"),
    ]));
    const base = initialState(new MemoryFileSystem({ home: "/home/demo", root: { kind: "directory", children: {} } }));
    const state = { ...base, blocks, selectedBlockIndex: blocks.findIndex((block) => block.kind === "assistant") };
    expect(selectedBlock(jumpToParent(state))).toMatchObject({ kind: "human", text: "Run the tests." });
  });

  it("places what follows a message written as several records under that message", () => {
    const blocks = parseBlocks(lines([
      part("a1", { type: "text", text: "Done." }, "tool_use", "p0"),
      part("a2", { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } }, "end_turn", "a1"),
      { type: "system", subtype: "turn_duration", uuid: "s1", parentUuid: "a2", timestamp: "2026-10-04T07:00:09Z", durationMs: 9000 },
    ]));
    const base = initialState(new MemoryFileSystem({ home: "/home/demo", root: { kind: "directory", children: {} } }));
    const state = { ...base, blocks, selectedBlockIndex: blocks.findIndex((block) => block.kind === "system") };
    expect(selectedBlock(jumpToParent(state))).toMatchObject({ kind: "tool-call", toolUseId: "t1" });
  });

  it("reads a call to the Agent tool, and to its old name Task, as a subagent", () => {
    const call = (id: string, name: string) => part(`a-${id}`, { type: "tool_use", id, name, input: { subagent_type: "Explore", description: "find it", prompt: "look" } }, "tool_use");
    const blocks = parseBlocks(lines([
      { ...call("t1", "Agent"), message: { ...call("t1", "Agent").message, id: "msg-1" } },
      { ...call("t2", "Task"), message: { ...call("t2", "Task").message, id: "msg-2" } },
    ]));
    expect(blocks.map((block) => block.kind)).toEqual(["subagent", "subagent"]);
    expect(blocks[0]).toMatchObject({ kind: "subagent", subagentType: "Explore", description: "find it" });
  });

  it("reads a call whose result names the agent it ran, a forked skill's, as a subagent", () => {
    const blocks = parseBlocks(lines([
      part("a1", { type: "tool_use", id: "t1", name: "Skill", input: { skill: "code-review", args: "high" } }, "tool_use"),
      { type: "user", uuid: "r1", parentUuid: "a1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "launched" }] }, toolUseResult: { agentId: "a4df0176" } },
    ]));
    expect(blocks).toMatchObject([{ kind: "subagent", subagentType: "code-review", prompt: "high", agentId: "a4df0176" }]);
  });

  describe("a tool call answered, then a reply", () => {
    const records = [
      { type: "user", uuid: "p0", parentUuid: null, timestamp: "2026-10-04T06:59:59Z", message: { role: "user", content: "List it." } },
      part("a1", { type: "thinking", thinking: "ls will do" }, "tool_use", "p0"),
      part("a2", { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } }, "tool_use", "a1"),
      { type: "user", uuid: "r1", parentUuid: "a2", timestamp: "2026-10-04T07:00:01Z", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "a.ts" }] } },
      { ...part("b1", { type: "text", text: "One file." }, "end_turn", "r1"), message: { ...part("b1", { type: "text", text: "One file." }, "end_turn").message, id: "msg-2" } },
      { type: "progress", uuid: "h1", parentUuid: "b1", timestamp: "2026-10-04T07:00:02Z" },
    ];
    const read = lines(records);
    const opened = (): AppState => {
      const base = initialState(new MemoryFileSystem({ home: "/home/demo", root: { kind: "directory", children: {} } }));
      return { ...base, rawLines: read, blocks: parseBlocks(read) };
    };
    const at = (state: AppState, test: (kind: string, text: string) => boolean): AppState => ({
      ...state,
      selectedBlockIndex: state.blocks.findIndex((b) => test(b.kind, "text" in b ? b.text : "")),
    });

    it("puts the reply under the call whose answer it follows", () => {
      expect(selectedBlock(jumpToParent(at(opened(), (_, text) => text === "One file.")))).toMatchObject({ kind: "tool-call", toolUseId: "t1" });
    });

    it("puts the call under the prompt, past a record no block shows", () => {
      expect(selectedBlock(jumpToParent(at(opened(), (kind) => kind === "tool-call")))).toMatchObject({ kind: "human", text: "List it." });
    });

    it("finds the call by the uuid of the result that answered it", () => {
      const { blocks } = opened();
      expect(blocks[blockIndexOf(blocks, "r1")]).toMatchObject({ kind: "tool-call", toolUseId: "t1" });
    });

    it("draws each block from its records as read, for its raw view", () => {
      const call = opened().blocks.find((b) => b.kind === "tool-call")!;
      expect(call.source).toEqual([read[2], read[3]]);
    });

    it("keeps the selection on its block when hidden records come and go", () => {
      const state = at(opened(), (_, text) => text === "One file.");
      const shown = toggleHidden(state);
      expect(shown.blocks.length).toBeGreaterThan(state.blocks.length);
      expect(selectedBlock(shown)).toMatchObject({ kind: "assistant", text: "One file." });
      expect(selectedBlock(toggleHidden(shown))).toMatchObject({ kind: "assistant", text: "One file." });
    });
  });

  describe("the record types Claude Code writes", () => {
    const session = (types: readonly string[]) => lines([
      ...types.map((type, i) => ({ type, uuid: `h${i}`, parentUuid: i === 0 ? null : `h${i - 1}`, timestamp: "2026-10-16T22:00:00Z" })),
      { type: "user", uuid: "p0", parentUuid: `h${types.length - 1}`, timestamp: "2026-10-16T22:00:01Z", message: { role: "user", content: "Start." } },
    ]);

    it("opens a session on its first message, past every record it keeps out", () => {
      expect(parseBlocks(session(HIDDEN_RECORD_TYPES))).toMatchObject([{ kind: "human", text: "Start." }]);
    });

    it("draws a kept-out record by its type, not as an error, when hidden records are shown", () => {
      const blocks = parseBlocks(session(["mode", "attachment"]), { showHidden: true });
      expect(blocks.map((block) => [block.kind, "recordType" in block ? block.recordType : null])).toEqual([["record", "mode"], ["record", "attachment"], ["human", null]]);
    });

    it("draws a type nobody has seen as an error, so it still reaches the reader", () => {
      const read = session(["not-yet-written"]);
      expect(parseBlocks(read)[0]).toMatchObject({ kind: "error", errorType: "not-yet-written", source: [read[0]] });
    });

    it("draws a known type it cannot read as malformed, not as unknown", () => {
      const read = lines([{ type: "user", uuid: "u0", parentUuid: null, timestamp: "2026-10-16T22:00:00Z" }]);
      expect(parseBlocks(read)).toMatchObject([{ kind: "error", errorType: "user", text: "(user record without a message)", source: [read[0]] }]);
    });
  });
});
