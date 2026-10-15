/**
 * Pins how parseBlocks reads an assistant message Claude Code wrote one
 * content block per record: the message is all of them, not its last record,
 * and it sits where its first record does — under the prompt it answers.
 */
import { describe, expect, it } from "vitest";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import type { RawLine } from "../../../examples/claude-sessions/data/loader.js";
import { parseBlocks } from "../../../examples/claude-sessions/data/parser.js";
import { initialState, jumpToParent, selectedBlock } from "../../../examples/claude-sessions/state.js";

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
    expect(selectedBlock(jumpToParent(state))).toMatchObject({ kind: "assistant", text: "Done." });
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
});
