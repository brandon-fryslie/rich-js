/**
 * The claude-sessions footer shows every hint's key and label as text. Its
 * `\` hint once reached the markup unescaped and swallowed the closing tag
 * after it, so the bar printed `[/bold white on blue]` (rich-demos-qmk).
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "../../../src/index.js";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import { initialState, type AppState } from "../../../examples/claude-sessions/state.js";
import { buildStatusBar } from "../../../examples/claude-sessions/views/status-bar.js";

function footer(state: AppState): string {
  return renderToString(buildStatusBar(state), { width: 200, colorSystem: null }).trimEnd();
}

const base = initialState(
  new MemoryFileSystem({ home: "/home/demo", root: { kind: "directory", children: {} } }),
);

describe("claude-sessions status bar", () => {
  it("shows the sidebar hints as text", () => {
    expect(footer({ ...base, focus: "sidebar" })).toBe(
      " ↑↓/jk move  →/⏎ open  ← back  tab focus  \\ hide  S search all  ^z suspend  q quit",
    );
  });

  it("shows the viewer hints as text", () => {
    expect(footer({ ...base, focus: "viewer" })).toBe(
      " ↑↓/jk block  g/G top/bot  ⏎ drill  u back  v raw  e expand  H hidden  p parent" +
        "  / find  S find all  n/N next/prev  tab focus  ^z suspend  q quit",
    );
  });

  it("shows the global-results hints as text", () => {
    expect(footer({ ...base, search: { ...base.search, mode: "results-global" } })).toBe(
      " ↑↓/jk hit  ⏎ open  esc exit  q quit",
    );
  });
});
