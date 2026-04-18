/**
 * Main loop for claude-sessions. Raw-mode stdin → action → reducer → render.
 * Search-typing mode bypasses the keymap and consumes raw characters directly.
 */

import { Console } from "../../src/index.js";
import {
  initialState,
  moveSidebar,
  descendSidebar,
  ascendSidebar,
  moveViewer,
  viewerFirst,
  viewerLast,
  toggleSidebar,
  toggleFocus,
  toggleViewMode,
  toggleExpand,
  toggleHidden,
  jumpToParent,
  drillIntoSelected,
  popSession,
  searchEnter,
  globalSearchEnter,
  searchType,
  searchBackspace,
  searchSubmit,
  searchNext,
  searchExit,
  openSelectedGlobalHit,
  selectedBlock,
  type AppState,
} from "./state.js";
import { lookup, type Action } from "./keymap.js";
import { buildShell } from "./views/shell.js";

function isTyping(state: AppState): boolean {
  return state.search.mode === "typing-local" || state.search.mode === "typing-global";
}

/** `open` is polymorphic by focus/context:
 *   - sidebar: descend into project/session tree
 *   - viewer + global-results: open the selected hit's session
 *   - viewer + selected block is subagent: drill into subagent file
 *   - viewer otherwise: no-op */
function handleOpen(state: AppState): AppState {
  if (state.focus === "sidebar") return descendSidebar(state);
  if (state.search.mode === "results-global") return openSelectedGlobalHit(state);
  const block = selectedBlock(state);
  if (block?.kind === "subagent") return drillIntoSelected(state);
  return state;
}

function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "move":
      // In global-results view, move scrolls the hit list (not the block list)
      if (state.search.mode === "results-global") {
        return searchNext(state, action.delta);
      }
      return state.focus === "sidebar"
        ? moveSidebar(state, action.delta)
        : moveViewer(state, action.delta);
    case "first":
      return state.focus === "sidebar" ? state : viewerFirst(state);
    case "last":
      return state.focus === "sidebar" ? state : viewerLast(state);
    case "open":
      return handleOpen(state);
    case "back":
      return state.focus === "sidebar" ? ascendSidebar(state) : state;
    case "toggle-sidebar":
      return toggleSidebar(state);
    case "toggle-focus":
      return toggleFocus(state);
    case "toggle-view-mode":
      return state.focus === "viewer" ? toggleViewMode(state) : state;
    case "toggle-expand":
      return state.focus === "viewer" ? toggleExpand(state) : state;
    case "toggle-hidden":
      return state.focus === "viewer" ? toggleHidden(state) : state;
    case "jump-parent":
      return state.focus === "viewer" ? jumpToParent(state) : state;
    case "pop-session":
      return state.focus === "viewer" ? popSession(state) : state;
    case "search-enter":
      return state.focus === "viewer" ? searchEnter(state) : state;
    case "global-search-enter":
      return globalSearchEnter(state);
    case "search-next":
      return searchNext(state, 1);
    case "search-prev":
      return searchNext(state, -1);
    case "search-exit":
      if (state.search.mode !== "off") return searchExit(state);
      return { ...state, statusMessage: "(press q to quit)" };
    case "quit":
    case "none":
      return state;
  }
}

function reduceSearchTyping(state: AppState, chunk: string): AppState {
  if (chunk === "\r" || chunk === "\n") return searchSubmit(state);
  if (chunk === "\x1b") return searchExit(state);
  if (chunk === "\x7f" || chunk === "\b") return searchBackspace(state);
  if (chunk.length === 1) {
    const code = chunk.charCodeAt(0);
    if (code >= 0x20 && code < 0x7f) return searchType(state, chunk);
  }
  return state;
}

export async function run(): Promise<void> {
  const consoleOut = new Console({ forceTerminal: true });
  let state = initialState();

  const stdin = process.stdin;
  if (!stdin.isTTY) {
    throw new Error("claude-sessions requires an interactive TTY");
  }

  const cleanup = () => {
    try { stdin.setRawMode(false); } catch { /* ignore */ }
    stdin.pause();
    process.stdout.write("\x1b[?25h\x1b[0m\x1b[?1049l");
  };

  process.stdout.write("\x1b[?1049h\x1b[?25l");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf-8");

  const render = (initial = false) => {
    const termHeight = process.stdout.rows || 24;
    // On first paint, clear the alt screen. Subsequent frames just
    // cursor-home and overwrite — Window pads to exact height so there's
    // no stale content, and no visible flicker.
    process.stdout.write(initial ? "\x1b[2J\x1b[H" : "\x1b[H");
    consoleOut.print(buildShell(state, termHeight));
  };

  render(true);

  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: string) => {
      try {
        let next: AppState;
        if (isTyping(state)) {
          next = reduceSearchTyping(state, chunk);
        } else {
          const action = lookup(chunk);
          if (action.type === "quit") {
            stdin.off("data", onData);
            resolve();
            return;
          }
          next = reduce(state, action);
        }
        if (next !== state) {
          state = next;
          render();
        }
      } catch (err) {
        stdin.off("data", onData);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    stdin.on("data", onData);
  }).finally(cleanup);
}
