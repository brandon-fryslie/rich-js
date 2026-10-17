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

/** `records` as a session's lines, each one the child of the one before it. */
const session = (...records: Record<string, unknown>[]): RawLine[] =>
  records.map((fields, i) => {
    const parsed = { uuid: `r${i}`, parentUuid: i === 0 ? null : `r${i - 1}`, timestamp: "2026-10-16T22:00:00Z", ...fields };
    return { lineNumber: i + 1, raw: JSON.stringify(parsed), parsed };
  });

/** Each block's rows as a reader sees them, rule glyphs, borders and padding gone. */
function blocks(...records: Record<string, unknown>[]): string[][] {
  return parseBlocks(session(...records)).map((block) => {
    const out = renderToString(renderBlock(block, { isSelected: false, isExpanded: false, viewMode: "pretty" }), { width: 60, colorSystem: null });
    return out.trimEnd().split("\n").map((row) => row.replace(/[─│╭╮╰╯]+/g, "").trim());
  });
}

/** One system record's rows. */
const drawn = (fields: Record<string, unknown>): string[] => blocks({ type: "system", ...fields })[0]!;

const CLEAR = "<command-name>/clear</command-name>\n            <command-message>clear</command-message>\n            <command-args></command-args>";

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

  it("keeps a stop hook's reason when it prevented continuation", () => {
    expect(drawn({ subtype: "stop_hook_summary", hookCount: 1, hookErrors: [], preventedContinuation: true, stopReason: "tests failing" }))
      .toEqual(["⚫ 1 stop hook · prevented continuation", "tests failing"]);
  });

  it("does not count stop hooks a record does not count", () => {
    expect(drawn({ subtype: "stop_hook_summary" })).toEqual(["⚫ stop hooks"]);
  });

  it("keeps output the stager cut short, closing tag and all", () => {
    expect(drawn({
      subtype: "local_command",
      content: "<local-command-stdout>Context usage\n… 400 more characters",
      commandRun: { command: "context", args: "" },
    })).toEqual(["⚫ /context", "Context usage", "… 400 more characters"]);
  });

  it("reads a command's output through its escape codes", () => {
    expect(drawn({
      subtype: "local_command",
      content: "<local-command-stdout>\u001b[1mTotal\u001b[22m $1.23</local-command-stdout>",
      commandRun: { command: "cost", args: "" },
    })).toEqual(["⚫ /cost", "Total $1.23"]);
  });

  it("draws a record whose fields are not the types Claude Code writes, not a failed session", () => {
    expect(drawn({ subtype: "local_command", content: ["not", "text"], durationMs: "soon" })).toEqual(["⚫ local command", '["not","text"]']);
  });

  it("keeps what a command record says outside its output tags", () => {
    expect(drawn({ subtype: "local_command", content: "Set model to opus", commandRun: { command: "model", args: "opus" } }))
      .toEqual(["⚫ /model opus", "Set model to opus"]);
  });

  it("joins a command to its output across a hidden record, shown or not", () => {
    const lines = session(
      { type: "user", message: { role: "user", content: CLEAR } },
      { type: "file-history-snapshot", uuid: "snap", parentUuid: null },
      { type: "system", subtype: "local_command", parentUuid: "r0", content: "<local-command-stdout></local-command-stdout>" },
    );
    const kinds = (showHidden: boolean) => parseBlocks(lines, { showHidden }).map((b) => (b.kind === "system" ? b.label : b.kind));
    expect(kinds(false)).toEqual(["/clear"]);
    expect(kinds(true)).toEqual(["/clear", "record"]);
  });

  it("draws a slash command once: the prompt that ran it and its output are one block", () => {
    expect(blocks(
      { type: "user", message: { role: "user", content: CLEAR } },
      { type: "system", subtype: "local_command", content: "<local-command-stdout></local-command-stdout>", commandRun: { command: "clear", args: "" } },
    )).toEqual([["⚫ /clear"]]);
    expect(blocks(
      { type: "system", subtype: "local_command", content: "<command-name>/login</command-name>\n<command-message>login</command-message>\n<command-args></command-args>" },
      { type: "system", subtype: "local_command", content: "<local-command-stdout>Login successful</local-command-stdout>", commandRun: { command: "login", args: "" } },
    )).toEqual([["⚫ /login", "Login successful"]]);
  });

  it("reads a prompt that runs a command with no output of its own as its command line", () => {
    const [prompt] = blocks({ type: "user", message: { role: "user", content: "<command-message>lit:next</command-message>\n<command-name>/lit:next</command-name>" } });
    expect(prompt).toContain("/lit:next");
    expect(prompt!.join("\n")).not.toContain("<command-");
  });

  it("draws a subtype it does not name by that name, over its content", () => {
    expect(drawn({ subtype: "brand_new_notice", content: "Something Claude Code said." }))
      .toEqual(["⚫ brand new notice", "Something Claude Code said."]);
  });
});
