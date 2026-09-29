/**
 * Main loop: data → reducer → render. Built on rich-js Live with altScreen
 * for flicker-free full-screen TUI.
 *
 * [LAW:capabilities-over-context] `run` is parameterised on a `TerminalHost`
 * (where I/O goes) and a `FileSystem` (where files come from). The demo
 * body never branches on environment; the two capabilities are the values
 * that differ between node and browser entries.
 */

import { Console, Live } from "../../src/index.js";
import type { Viewport } from "../../src/index.js";
import { hostEnvironment } from "../../src/host/host-environment.js";
import type { FileSystem } from "../_capabilities/index.js";
import type { TerminalHost } from "../../src/host/terminal-host.js";
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
    case "quit":
    case "none":
      return state;
  }
}

export async function run(
  host: TerminalHost,
  fs: FileSystem,
  startPath: string,
): Promise<void> {
  // [LAW:single-enforcer] The host is the console's whole environment: where
  // bytes go, its size and the colours it draws. Height is load-bearing for
  // Live: `Live.refresh` reads `console.height` to crop frames, so it has to
  // be the host's, live through resizes.
  const consoleOut = new Console({
    environment: hostEnvironment(host),
  });
  let state = initialState(fs, startPath);

  if (!host.isTTY) {
    throw new Error("rich-explore requires an interactive TTY");
  }

  // Live + altScreen drives flicker-free full-screen TUI rendering through
  // the host-backed Console. autoRefresh: false — refresh on keypress only.
  const live = new Live(undefined, {
    console: consoleOut,
    altScreen: true,
    autoRefresh: false,
    verticalOverflow: "crop",
  });

  host.start();
  host.setRawMode(true);
  live.start();

  const view = new ExploreView();
  const render = () => {
    live.update(buildShell(state, view), { refresh: true });
  };

  render();

  await new Promise<void>((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    // Hoist the decoder out of the hot path — node delivers Buffer chunks on
    // every keystroke; one shared decoder avoids per-event allocation and
    // keeps the demo body free of `Buffer`, which the browser lacks.
    // `{ stream: true }` preserves partial multibyte sequences across chunks
    // (a UTF-8 codepoint split between two onData calls — possible on paste
    // of non-ASCII text — would otherwise decode to U+FFFD).
    const decoder = new TextDecoder();
    const onData = (chunk: Uint8Array | string) => {
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      const action = lookup(text);
      if (action.type === "quit") {
        unsubscribe?.();
        resolve();
        return;
      }
      try {
        state = reduce(state, action, view.previewOf(state));
        render();
      } catch (err) {
        unsubscribe?.();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    unsubscribe = host.onData(onData);
  }).finally(() => {
    live.stop();
    host.setRawMode(false);
    host.stop();
  });
}
