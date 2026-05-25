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
import { hostStream } from "../../src/widgets/host-stream.js";
import type { FileSystem } from "../_capabilities/index.js";
import type { TerminalHost } from "../../src/widgets/terminal-host.js";
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

export async function run(
  host: TerminalHost,
  fs: FileSystem,
  startPath: string,
): Promise<void> {
  // [LAW:single-enforcer] Console writes through the host via hostStream so
  // there is exactly one sink for terminal output. Node wraps process.stdout;
  // browser wraps xterm.js — same render path, different backing.
  const consoleOut = new Console({
    forceTerminal: true,
    file: hostStream(host) as unknown as NodeJS.WritableStream,
  });
  // [LAW:dataflow-not-control-flow] Width and height are data flowing from
  // the host. Console's defaults fall back to `process.stdout` dimensions,
  // which are 80×24 in the browser (no real stdout), so layout would clip
  // even though xterm.js is at 100×N. Both overrides are required for Live:
  // `Live.refresh` reads `console.height` to crop frames (src/renderables/
  // live.ts:124), so without the height override, browser frames would be
  // truncated to 24 rows regardless of the xterm viewport size. Reading
  // `host.size()` lazily makes render dimensions track the terminal in both
  // environments and on resize.
  Object.defineProperty(consoleOut, "width", {
    get: () => host.size().cols,
  });
  Object.defineProperty(consoleOut, "height", {
    get: () => host.size().rows,
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

  const render = () => {
    const termHeight = host.size().rows;
    live.update(buildShell(state, termHeight), { refresh: true });
  };

  render();

  await new Promise<void>((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    // Hoist the decoder out of the hot path — node delivers Buffer chunks on
    // every keystroke; one shared decoder avoids per-event allocation and
    // keeps the demo body free of `Buffer`, which the browser lacks.
    const decoder = new TextDecoder();
    const onData = (chunk: Uint8Array | string) => {
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk);
      const action = lookup(text);
      if (action.type === "quit") {
        unsubscribe?.();
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
