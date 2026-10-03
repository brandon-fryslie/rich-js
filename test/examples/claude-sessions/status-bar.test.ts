/**
 * The claude-sessions footer shows every hint's key and label as text. Its
 * `\` hint once reached the markup unescaped and swallowed the closing tag
 * after it, so the bar printed `[/bold white on blue]` (rich-demos-qmk). It is
 * one row, and once wrapped at 80 columns, losing its second line without a
 * trace (rich-demos-z4hd).
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "../../../src/index.js";
import { MemoryFileSystem } from "../../../examples/_capabilities/memory-file-system.js";
import { initialState, type AppState } from "../../../examples/claude-sessions/state.js";
import { buildStatusBar } from "../../../examples/claude-sessions/views/status-bar.js";

function footer(state: AppState, width = 200): string {
  return renderToString(buildStatusBar(state), { width, colorSystem: null }).trimEnd();
}

const base = initialState(
  new MemoryFileSystem({ home: "/home/demo", root: { kind: "directory", children: {} } }),
);

describe("claude-sessions status bar", () => {
  it("shows the sidebar hints as text", () => {
    expect(footer({ ...base, focus: "sidebar" })).toBe(
      " ↑↓/jk move  →/⏎ open  ← back  tab focus  q quit  \\ hide  S search all  ^z suspend",
    );
  });

  it("shows the viewer hints as text", () => {
    expect(footer({ ...base, focus: "viewer" })).toBe(
      " ↑↓/jk block  ⏎ drill  u back  tab focus  q quit  / find  n/N next/prev" +
        "  g/G top/bot  e expand  v raw  H hidden  p parent  S find all  ^z suspend",
    );
  });

  it("shows the global-results hints as text", () => {
    expect(footer({ ...base, search: { ...base.search, mode: "results-global" } })).toBe(
      " ↑↓/jk hit  ⏎ open  esc exit  q quit",
    );
  });

  it("at 80 columns, keeps to one row and counts the sidebar hints it leaves out", () => {
    expect(footer({ ...base, focus: "sidebar" }, 80)).toBe(
      " ↑↓/jk move  →/⏎ open  ← back  tab focus  q quit  \\ hide  S search all  +1 more",
    );
  });

  it("at 80 columns, keeps to one row and counts the viewer hints it leaves out", () => {
    expect(footer({ ...base, focus: "viewer" }, 80)).toBe(
      " ↑↓/jk block  ⏎ drill  u back  tab focus  q quit  / find  +8 more",
    );
  });

  it("keeps to one row, cut with an ellipsis, where not even the count fits", () => {
    expect(footer({ ...base, focus: "viewer" }, 8)).toBe(" +14 mo…");
  });

  it("shows every hint, with no count, where they all fit", () => {
    expect(footer({ ...base, search: { ...base.search, mode: "results-global" } }, 37)).toBe(
      " ↑↓/jk hit  ⏎ open  esc exit  q quit",
    );
  });
});
