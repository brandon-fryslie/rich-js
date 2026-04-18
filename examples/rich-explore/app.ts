/**
 * Main loop: raw-mode stdin → action → reducer → render.
 * Uses rich-js Live with altScreen mode for flicker-free full-screen TUI.
 */

import { Console, Live } from "../../src/index.js";
import {
  initialState,
  toggleExpand,
  collapse,
  visibleNodes,
  parentPath,
  type AppState,
} from "./state.js";
import { lookup, type Action } from "./keymap.js";
import { buildShell } from "./views/shell.js";

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
  return { ...state, selectedPath: nextPath, previewOffset: 0 };
}

function selectFirst(state: AppState): AppState {
  const visible = visibleNodes(state);
  const first = visible[0];
  if (!first || first.entry.path === state.selectedPath) return state;
  return { ...state, selectedPath: first.entry.path, previewOffset: 0 };
}

function selectLast(state: AppState): AppState {
  const visible = visibleNodes(state);
  const last = visible[visible.length - 1];
  if (!last || last.entry.path === state.selectedPath) return state;
  return { ...state, selectedPath: last.entry.path, previewOffset: 0 };
}

function scrollPreview(state: AppState, delta: number): AppState {
  const next = Math.max(0, state.previewOffset + delta);
  return next === state.previewOffset ? state : { ...state, previewOffset: next };
}

function scrollPreviewToTop(state: AppState): AppState {
  return state.previewOffset === 0 ? state : { ...state, previewOffset: 0 };
}

function scrollPreviewToBottom(state: AppState): AppState {
  return { ...state, previewOffset: 1 << 20 };
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

function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "move":
      return state.focus === "preview"
        ? scrollPreview(state, action.delta)
        : selectByDelta(state, action.delta);
    case "move-first":
      return state.focus === "preview" ? scrollPreviewToTop(state) : selectFirst(state);
    case "move-last":
      return state.focus === "preview" ? scrollPreviewToBottom(state) : selectLast(state);
    case "open":
      return state.focus === "preview" ? state : openSelected(state);
    case "up":
      return state.focus === "preview" ? state : goUp(state);
    case "focus-toggle":
      return { ...state, focus: state.focus === "tree" ? "preview" : "tree" };
    case "coverage":
      return { ...state, mode: state.mode === "coverage" ? "browse" : "coverage", focus: "preview", previewOffset: 0 };
    case "quit":
    case "none":
      return state;
  }
}

export async function run(startPath: string): Promise<void> {
  const consoleOut = new Console({ forceTerminal: true });
  let state = initialState(startPath);

  const stdin = process.stdin;
  if (!stdin.isTTY) {
    throw new Error("rich-explore requires an interactive TTY");
  }

  // Use Live with altScreen for full-screen TUI rendering.
  // autoRefresh: false — we refresh on keypress only.
  const live = new Live(undefined, {
    console: consoleOut,
    altScreen: true,
    autoRefresh: false,
    verticalOverflow: "crop",
  });

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf-8");
  live.start();

  const render = () => {
    const termHeight = process.stdout.rows || 24;
    live.update(buildShell(state, termHeight), { refresh: true });
  };

  render();

  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: string) => {
      const action = lookup(chunk);
      if (action.type === "quit") {
        stdin.off("data", onData);
        resolve();
        return;
      }
      try {
        const next = reduce(state, action);
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
  }).finally(() => {
    live.stop();
    try { stdin.setRawMode(false); } catch { /* ignore */ }
    stdin.pause();
  });
}
