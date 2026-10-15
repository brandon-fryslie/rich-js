/**
 * Main loop for claude-sessions: key → action → reducer → render, in an `App`
 * on the alternate screen. Search-typing mode reads keys through its own
 * keymap, which passes every key but the lifecycle ones to the query.
 *
 * [LAW:effects-at-boundaries] `run` is parameterised on both a
 * `TerminalHost` (where I/O goes) and a `FileSystem` (where session data
 * comes from). The demo body never branches on environment; the two
 * capabilities are the values that differ between `main.ts` and `node.ts`.
 */

import { App, keyName, type KeyPress, type TerminalHost } from "@promptctl/rich-js/host";
import type { FileSystem } from "../_capabilities/file-system.js";
import {
  initialState,
  moveSidebar,
  descendSidebar,
  ascendSidebar,
  moveViewer,
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
import { lookup, lookupTyping, type Action } from "./keymap.js";
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
      return state.focus === "sidebar" ? state : moveViewer(state, -Infinity);
    case "last":
      return state.focus === "sidebar" ? state : moveViewer(state, Infinity);
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
    case "search-key":
      return reduceSearchTyping(state, action.press);
    case "suspend":
    case "quit":
    case "none":
      return state;
  }
}

function reduceSearchTyping(state: AppState, press: KeyPress): AppState {
  switch (keyName(press)) {
    case "enter":
      return searchSubmit(state);
    case "escape":
      return searchExit(state);
    case "backspace":
      return searchBackspace(state);
  }
  // A key that types a character types it into the query; any other is ignored.
  return press.ctrl || press.meta || press.character === "" ? state : searchType(state, press.character);
}

/** The viewer, running: `done` settles as `App.run` does. */
export interface Running {
  readonly done: Promise<void>;
  stop(): void;
}

export function run(host: TerminalHost, fs: FileSystem): Running {
  if (!host.isTTY) {
    throw new Error("claude-sessions requires an interactive TTY");
  }

  let state = initialState(fs);
  const view = sessionsView();
  // The app redraws on a change of state and on resize; each frame is the
  // shell of the state as it is then.
  const app = new App({ host, surface: "alternate", view: () => buildShell(state, view) });

  app.onKey((press) => {
    const action = (isTyping(state) ? lookupTyping : lookup)(press);
    switch (action.type) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        void app.suspend();
        return;
    }
    // A reducer that throws fails the app, the terminal handed back first.
    const next = reduce(state, action);
    // A key that changes nothing paints nothing.
    if (next === state) return;
    state = next;
    app.refresh();
  });

  return { done: app.run(), stop: () => app.stop() };
}
