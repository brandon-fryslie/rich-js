/**
 * Main loop: data → reducer → render, in an `App` on the alternate screen.
 *
 * [LAW:capabilities-over-context] `run` is parameterised on a `TerminalHost`
 * (where I/O goes) and a `FileSystem` (where files come from). The demo
 * body never branches on environment; the two capabilities are the values
 * that differ between node and browser entries.
 */

import { App, type TerminalHost } from "../../src/host/index.js";
import type { Viewport } from "../../src/index.js";
import type { FileSystem } from "../_capabilities/index.js";
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function selectByDelta(state: AppState, delta: number): AppState {
  const visible = visibleNodes(state);
  if (visible.length === 0) return state;
  const idx = visible.findIndex((n) => n.entry.path === state.selectedPath);
  const base = idx < 0 ? 0 : idx;
  const nextIdx = clamp(base + delta, 0, visible.length - 1);
  const nextPath = visible[nextIdx]!.entry.path;
  if (nextPath === state.selectedPath) return state;
  return { ...state, selectedPath: nextPath };
}

function selectFirst(state: AppState): AppState {
  const visible = visibleNodes(state);
  const first = visible[0];
  if (!first || first.entry.path === state.selectedPath) return state;
  return { ...state, selectedPath: first.entry.path };
}

function selectLast(state: AppState): AppState {
  const visible = visibleNodes(state);
  const last = visible[visible.length - 1];
  if (!last || last.entry.path === state.selectedPath) return state;
  return { ...state, selectedPath: last.entry.path };
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
      return state.focus === "preview" ? scrolled(state, () => preview.scrollTo(0)) : selectFirst(state);
    case "move-last":
      return state.focus === "preview" ? scrolled(state, () => preview.scrollTo(Infinity)) : selectLast(state);
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

  // Hoist the decoder out of the hot path — node delivers Buffer chunks on
  // every keystroke; one shared decoder avoids per-event allocation and
  // keeps the demo body free of `Buffer`, which the browser lacks.
  // `{ stream: true }` preserves partial multibyte sequences across chunks
  // (a UTF-8 codepoint split between two onData calls — possible on paste
  // of non-ASCII text — would otherwise decode to U+FFFD).
  const decoder = new TextDecoder();
  host.onData((chunk) => {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    const action = lookup(text);
    switch (action.type) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        void app.suspend();
        return;
    }
    // [LAW:no-silent-failure] The host calls this handler, so a reducer that
    // throws here would reach neither `done` nor the terminal's hand-back.
    try {
      state = reduce(state, action, view.previewOf(state));
    } catch (error) {
      app.fail(error);
      return;
    }
    // Every key repaints: a scroll moves the preview's viewport and leaves
    // the state as it was.
    app.refresh();
  });

  return { done: app.run(), stop: () => app.stop() };
}
