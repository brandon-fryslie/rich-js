/**
 * Main loop: data → reducer → render, in an `App` on the alternate screen.
 *
 * [LAW:effects-at-boundaries] `run` is parameterised on a `TerminalHost`
 * (where I/O goes) and a `FileSystem` (where files come from). The demo
 * body never branches on environment; `main.ts` and `node.ts` differ only in
 * the `FileSystem` they pass.
 */

import { App, type TerminalHost } from "@promptctl/rich-js/host";
import { moveSelection, type Viewport } from "@promptctl/rich-js";
import type { FileSystem } from "../_capabilities/file-system.js";
import {
  initialState,
  toggleExpand,
  collapse,
  visibleNodes,
  parentPath,
  type AppState,
} from "./state.js";
import { lookup, type Action } from "./keymap.js";
import { buildShell, ExploreView } from "./views/shell.js";

/** `delta` entries on; `-Infinity` and `Infinity` are the first and the last. */
function selectByDelta(state: AppState, delta: number): AppState {
  const visible = visibleNodes(state);
  const index = Math.max(0, visible.findIndex((n) => n.entry.path === state.selectedPath));
  const next = visible[moveSelection(index, delta, visible.length)];
  return next === undefined || next.entry.path === state.selectedPath ? state : { ...state, selectedPath: next.entry.path };
}

// [LAW:one-source-of-truth] The preview's scroll position is its viewport's:
// a scroll key moves the viewport and leaves the state as it was.
function scrolled(state: AppState, move: () => void): AppState {
  move();
  return state;
}

function openSelected(state: AppState): AppState {
  const node = state.nodes.get(state.selectedPath);
  if (!node || node.entry.kind !== "directory" || node.entry.error) return state;
  return toggleExpand(state, state.selectedPath);
}

function goUp(state: AppState): AppState {
  const node = state.nodes.get(state.selectedPath);
  if (!node) return state;
  if (node.expanded && node.entry.kind === "directory") {
    return collapse(state, state.selectedPath);
  }
  const parent = parentPath(state, state.selectedPath);
  if (!parent || parent === state.rootPath) return state;
  return { ...state, selectedPath: parent };
}

function reduce(state: AppState, action: Action, preview: Viewport): AppState {
  switch (action.type) {
    case "move":
      return state.focus === "preview"
        ? scrolled(state, () => preview.scrollBy(action.delta))
        : selectByDelta(state, action.delta);
    case "move-first":
      return state.focus === "preview" ? scrolled(state, () => preview.scrollTo(0)) : selectByDelta(state, -Infinity);
    case "move-last":
      return state.focus === "preview" ? scrolled(state, () => preview.scrollTo(Infinity)) : selectByDelta(state, Infinity);
    case "open":
      return state.focus === "preview" ? state : openSelected(state);
    case "up":
      return state.focus === "preview" ? state : goUp(state);
    case "focus-toggle":
      return { ...state, focus: state.focus === "tree" ? "preview" : "tree" };
    case "coverage":
      return { ...state, mode: state.mode === "coverage" ? "browse" : "coverage", focus: "preview" };
    case "suspend":
    case "quit":
    case "none":
      return state;
  }
}

/** The explorer, running: `done` settles as `App.run` does. */
export interface Running {
  readonly done: Promise<void>;
  stop(): void;
}

export function run(host: TerminalHost, fs: FileSystem, startPath: string): Running {
  if (!host.isTTY) {
    throw new Error("rich-explore requires an interactive TTY");
  }

  let state = initialState(fs, startPath);
  const view = new ExploreView();
  // The app redraws on keypress and resize only; each frame is the shell of
  // the state as it is then.
  const app = new App({ host, surface: "alternate", view: () => buildShell(state, view) });

  app.onKey((press) => {
    const action = lookup(press);
    switch (action.type) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        void app.suspend();
        return;
    }
    // A reducer that throws fails the app, the terminal handed back first.
    state = reduce(state, action, view.previewOf(state));
    // Every key repaints: a scroll moves the preview's viewport and leaves
    // the state as it was.
    app.refresh();
  });

  return { done: app.run(), stop: () => app.stop() };
}
