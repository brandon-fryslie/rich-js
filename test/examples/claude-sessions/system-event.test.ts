/**
 * A system record in a claude-sessions viewer says what happened. Only a
 * `turn_duration` record carries a duration, and the rule once titled every
 * other subtype by its missing duration alone, so a slash command or a stop
 * hook drew as an empty '⚫ —' (rich-demos-k78j.0d5).
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "../../../src/index.js";
import type { RawLine } from "../../../examples/claude-sessions/data/loader.js";
import { parseBlocks } from "../../../examples/claude-sessions/data/parser.js";
import { renderBlock } from "../../../examples/claude-sessions/views/block-renderers/index.js";

const system = (fields: Record<string, unknown>): RawLine[] => {
  const parsed = { type: "system", uuid: "s1", parentUuid: null, timestamp: "2026-10-16T22:00:00Z", ...fields };
  return [{ lineNumber: 1, raw: JSON.stringify(parsed), parsed }];
};

/** The block's rows as a reader sees them, rule glyphs and padding gone. */
function drawn(fields: Record<string, unknown>): string[] {
  const block = parseBlocks(system(fields))[0]!;
  const out = renderToString(renderBlock(block, { isSelected: false, isExpanded: false, viewMode: "pretty" }), { width: 60, colorSystem: null });
  return out.trimEnd().split("\n").map((row) => row.replace(/─+/g, "").trim());
}

describe("claude-sessions system records", () => {
  it("titles a turn's duration as the turn it timed", () => {
    expect(drawn({ subtype: "turn_duration", durationMs: 328792 })).toEqual(["⌛ turn · 5m 29s"]);
  });

  it("titles a slash command by its command line, over its output", () => {
    expect(drawn({
      subtype: "local_command",
      content: "<local-command-stdout>Resume cancelled</local-command-stdout>",
      commandRun: { command: "resume", args: "" },
    })).toEqual(["⚫ /resume", "Resume cancelled"]);
  });

  it("reads the command line a command record without commandRun carries in its content", () => {
    expect(drawn({
      subtype: "local_command",
      content: "<command-name>/btw</command-name>\n  <command-message>btw</command-message>\n  <command-args>How are docs built?</command-args>",
    })).toEqual(["⚫ /btw How are docs built?"]);
  });

  it("counts the stop hooks that ran, over the errors they raised", () => {
    expect(drawn({ subtype: "stop_hook_summary", hookCount: 2, hookErrors: [] })).toEqual(["⚫ 2 stop hooks"]);
    expect(drawn({ subtype: "stop_hook_summary", hookCount: 1, hookErrors: ["EAGAIN: posix_spawn '/bin/sh'"] }))
      .toEqual(["⚫ 1 stop hook", "EAGAIN: posix_spawn '/bin/sh'"]);
  });

  it("draws a subtype it does not name by that name, over its content", () => {
    expect(drawn({ subtype: "brand_new_notice", content: "Something Claude Code said." }))
      .toEqual(["⚫ brand new notice", "Something Claude Code said."]);
  });
});
