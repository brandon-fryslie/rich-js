/**
 * The card opens on staged sessions, and a subagent call in one is drilled
 * into as in the terminal: its transcript is staged beside the session, where
 * Claude Code keeps it.
 */
import { describe, expect, it } from "vitest";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import { STAGED_HOME } from "../../../examples/claude-sessions/staging/projects.js";
import { drillIntoSelected, initialState, openSelectedSession, type AppState } from "../../../examples/claude-sessions/state.js";

/** Every staged session, opened. */
function openedSessions(): AppState[] {
  const base = initialState(new MemoryFileSystem(STAGED_HOME));
  return base.projects.flatMap((project, p) =>
    project.sessions.map((_, s) => openSelectedSession({ ...base, selectedProjectIndex: p, selectedSessionIndex: s, sidebarLevel: "session" })),
  );
}

describe("staged subagent calls", () => {
  it("drill into the subagent's own transcript", () => {
    const drilled = openedSessions().flatMap((state) =>
      state.blocks.flatMap((block, i) => (block.kind === "subagent" && block.agentId !== null ? [drillIntoSelected({ ...state, selectedBlockIndex: i })] : [])),
    );
    expect(drilled.length).toBeGreaterThan(5);
    for (const state of drilled) {
      expect(state.errorMessage).toBeNull();
      expect(state.loadedSessionPath).toMatch(/\/subagents\/agent-[^/]+\.jsonl$/);
      expect(state.sessionStack).toHaveLength(1);
      expect(state.blocks.length).toBeGreaterThan(0);
    }
  });
});
