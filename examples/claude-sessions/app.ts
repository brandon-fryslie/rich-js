/**
 * Main loop for claude-sessions: key → action → reducer → render, in an `App`
 * on the alternate screen. Search-typing mode bypasses the keymap and
 * consumes raw characters directly.
 *
 * [LAW:capabilities-over-context] `run` is parameterised on both a
 * `TerminalHost` (where I/O goes) and a `FileSystem` (where session data
 * comes from). The demo body never branches on environment; the two
 * capabilities are the values that differ between node and browser entries.
 */

import { App, type TerminalHost } from "../../src/host/index.js";
import type { FileSystem } from "../_capabilities/index.js";
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
import { buildShell, sessionsView } from "./views/shell.js";

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
    case "suspend":
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

export async function run(host: TerminalHost, fs: FileSystem): Promise<void> {
  if (!host.isTTY) {
    throw new Error("claude-sessions requires an interactive TTY");
  }

  let state = initialState(fs);
  const view = sessionsView();
  // The app redraws on keypress and resize only; each frame is the shell of
  // the state as it is then.
  const app = new App({ host, surface: "alternate", view: () => buildShell(state, view) });

  // Hoist the decoder out of the hot path — node delivers Buffer chunks on
  // every keystroke. `{ stream: true }` keeps a multibyte sequence split
  // across two chunks whole.
  const decoder = new TextDecoder();
  // [LAW:no-silent-failure] A key the reducer throws on ends the app with that
  // error, as a frame that throws does: the host calls this handler, so a
  // throw left in it would reach neither `run`'s caller nor the terminal's
  // hand-back.
  let failure: { readonly error: unknown } | undefined;
  const update = (step: (state: AppState) => AppState): void => {
    try {
      state = step(state);
    } catch (error) {
      failure = { error };
      app.stop();
      return;
    }
    app.refresh();
  };
  host.onData((chunk) => {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    if (isTyping(state)) return update((s) => reduceSearchTyping(s, text));
    const action = lookup(text);
    switch (action.type) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        void app.suspend();
        return;
      default:
        return update((s) => reduce(s, action));
    }
  });

  await app.run();
  if (failure) throw failure.error;
}
