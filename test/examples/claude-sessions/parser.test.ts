/**
 * Pins how parseBlocks reads an assistant message Claude Code wrote one
 * content block per record: the message is all of them, not its last record.
 */
import { describe, expect, it } from "vitest";
import type { RawLine } from "../../../examples/claude-sessions/data/loader.js";
import { parseBlocks } from "../../../examples/claude-sessions/data/parser.js";

function lines(records: readonly Record<string, unknown>[]): RawLine[] {
  return records.map((parsed, i) => ({ lineNumber: i + 1, raw: JSON.stringify(parsed), parsed }));
}

const part = (uuid: string, content: unknown, stop_reason: string) => ({
  type: "assistant",
  uuid,
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
});
