/**
 * Main loop for claude-sessions. Same shape as rich-explore: raw-mode stdin
 * → action → reducer → render. Search-typing mode bypasses the keymap and
 * consumes raw characters directly.
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
  jumpToParent,
  jumpToRelated,
  searchEnter,
  searchType,
  searchBackspace,
  searchSubmit,
  searchNext,
  searchExit,
  type AppState,
} from "./state.js";
import { lookup, type Action } from "./keymap.js";
import { buildShell } from "./views/shell.js";

function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "move":
      return state.focus === "sidebar"
        ? moveSidebar(state, action.delta)
        : moveViewer(state, action.delta);
    case "first":
      return state.focus === "sidebar" ? state : viewerFirst(state);
    case "last":
      return state.focus === "sidebar" ? state : viewerLast(state);
    case "open":
      return state.focus === "sidebar" ? descendSidebar(state) : state;
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
    case "jump-parent":
      return state.focus === "viewer" ? jumpToParent(state) : state;
    case "jump-related":
      return state.focus === "viewer" ? jumpToRelated(state) : state;
    case "search-enter":
      return state.focus === "viewer" ? searchEnter(state) : state;
    case "search-next":
      return state.focus === "viewer" ? searchNext(state, 1) : state;
    case "search-prev":
      return state.focus === "viewer" ? searchNext(state, -1) : state;
    case "search-exit":
      // esc: if search active, exit search; otherwise quit
      if (state.search.mode !== "off") return searchExit(state);
      return { ...state, statusMessage: "(press q to quit)" };
    case "quit":
    case "none":
      return state;
  }
}

/**
 * Handle a raw stdin chunk in search-typing mode. Printable chars append to
 * query; backspace deletes; enter submits; esc cancels.
 */
function reduceSearchTyping(state: AppState, chunk: string): AppState {
  if (chunk === "\r" || chunk === "\n") return searchSubmit(state);
  if (chunk === "\x1b") return searchExit(state);
  if (chunk === "\x7f" || chunk === "\b") return searchBackspace(state);
  // Only printable single-byte chars
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

  const render = () => {
    const termHeight = process.stdout.rows || 24;
    process.stdout.write("\x1b[2J\x1b[H");
    consoleOut.print(buildShell(state, termHeight));
  };

  render();

  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: string) => {
      try {
        let next: AppState;
        if (state.search.mode === "typing") {
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
