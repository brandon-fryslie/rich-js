/**
 * Immutable AppState for the claude-sessions browser.
 *
 * Reducers in app.ts produce new states; views are pure functions of state.
 *
 * Extension points:
 * - SearchMode: add "global-typing" / "global-results" variants
 * - Mode: add a top-level mode for filter expressions / REPL
 */

import type { Block, ProjectMeta, SessionMeta } from "./data/types.js";
import { scanProjects } from "./data/scanner.js";
import { loadSession } from "./data/loader.js";
import { parseBlocks } from "./data/parser.js";
import { localSearch } from "./data/search.js";

export type Focus = "sidebar" | "viewer";
export type ViewMode = "pretty" | "raw";
export type SearchMode = "off" | "typing" | "results";

export interface SearchState {
  readonly mode: SearchMode;
  readonly query: string;
  readonly matches: ReadonlyArray<number>;  // block indices
  readonly cursor: number;                  // index into matches
}

export interface AppState {
  // Sidebar
  readonly projects: ReadonlyArray<ProjectMeta>;
  readonly selectedProjectIndex: number;
  readonly selectedSessionIndex: number;
  readonly sidebarVisible: boolean;
  readonly sidebarLevel: "project" | "session"; // which list is active

  // Viewer
  readonly loadedSessionPath: string | null;
  readonly blocks: ReadonlyArray<Block>;
  readonly selectedBlockIndex: number;
  readonly viewMode: ViewMode;
  readonly expanded: ReadonlySet<number>;   // block indices with expanded=true

  // Focus
  readonly focus: Focus;

  // Search
  readonly search: SearchState;

  // Status
  readonly statusMessage: string | null;
  readonly errorMessage: string | null;
}

export function initialState(): AppState {
  const projects = scanProjects();
  return {
    projects,
    selectedProjectIndex: 0,
    selectedSessionIndex: 0,
    sidebarVisible: true,
    sidebarLevel: "project",
    loadedSessionPath: null,
    blocks: [],
    selectedBlockIndex: 0,
    viewMode: "pretty",
    expanded: new Set(),
    focus: "sidebar",
    search: { mode: "off", query: "", matches: [], cursor: 0 },
    statusMessage: projects.length === 0
      ? "No projects found in ~/.claude/projects/"
      : `${projects.length} projects loaded`,
    errorMessage: null,
  };
}

// --- Selectors ---

export function selectedProject(state: AppState): ProjectMeta | undefined {
  return state.projects[state.selectedProjectIndex];
}

export function selectedSession(state: AppState): SessionMeta | undefined {
  return selectedProject(state)?.sessions[state.selectedSessionIndex];
}

export function selectedBlock(state: AppState): Block | undefined {
  return state.blocks[state.selectedBlockIndex];
}

// --- Reducer helpers ---

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function moveSidebar(state: AppState, delta: number): AppState {
  if (state.sidebarLevel === "project") {
    if (state.projects.length === 0) return state;
    const next = clamp(state.selectedProjectIndex + delta, 0, state.projects.length - 1);
    if (next === state.selectedProjectIndex) return state;
    return { ...state, selectedProjectIndex: next, selectedSessionIndex: 0 };
  }
  const sessions = selectedProject(state)?.sessions ?? [];
  if (sessions.length === 0) return state;
  const next = clamp(state.selectedSessionIndex + delta, 0, sessions.length - 1);
  if (next === state.selectedSessionIndex) return state;
  return { ...state, selectedSessionIndex: next };
}

export function descendSidebar(state: AppState): AppState {
  if (state.sidebarLevel === "project") {
    const sessions = selectedProject(state)?.sessions ?? [];
    if (sessions.length === 0) return state;
    return { ...state, sidebarLevel: "session", selectedSessionIndex: 0 };
  }
  // Already at session level → open it
  return openSelectedSession(state);
}

export function ascendSidebar(state: AppState): AppState {
  if (state.sidebarLevel === "session") {
    return { ...state, sidebarLevel: "project" };
  }
  return state;
}

export function openSelectedSession(state: AppState): AppState {
  const session = selectedSession(state);
  if (!session) return state;
  if (session.path === state.loadedSessionPath) {
    // Already loaded → focus viewer
    return { ...state, focus: "viewer" };
  }
  try {
    const result = loadSession(session.path);
    const blocks = parseBlocks(result.lines);
    return {
      ...state,
      loadedSessionPath: session.path,
      blocks,
      selectedBlockIndex: 0,
      expanded: new Set(),
      focus: "viewer",
      search: { mode: "off", query: "", matches: [], cursor: 0 },
      statusMessage: `Loaded ${blocks.length} blocks (${result.skipped} lines skipped)`,
      errorMessage: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...state, errorMessage: `Load failed: ${msg}` };
  }
}

export function moveViewer(state: AppState, delta: number): AppState {
  if (state.blocks.length === 0) return state;
  const next = clamp(state.selectedBlockIndex + delta, 0, state.blocks.length - 1);
  if (next === state.selectedBlockIndex) return state;
  return { ...state, selectedBlockIndex: next };
}

export function viewerFirst(state: AppState): AppState {
  if (state.blocks.length === 0 || state.selectedBlockIndex === 0) return state;
  return { ...state, selectedBlockIndex: 0 };
}

export function viewerLast(state: AppState): AppState {
  if (state.blocks.length === 0) return state;
  const last = state.blocks.length - 1;
  if (state.selectedBlockIndex === last) return state;
  return { ...state, selectedBlockIndex: last };
}

export function toggleSidebar(state: AppState): AppState {
  return {
    ...state,
    sidebarVisible: !state.sidebarVisible,
    focus: state.sidebarVisible ? "viewer" : state.focus,
  };
}

export function toggleFocus(state: AppState): AppState {
  if (!state.sidebarVisible) return state; // can't focus a hidden sidebar
  return { ...state, focus: state.focus === "sidebar" ? "viewer" : "sidebar" };
}

export function toggleViewMode(state: AppState): AppState {
  return { ...state, viewMode: state.viewMode === "pretty" ? "raw" : "pretty" };
}

export function toggleExpand(state: AppState): AppState {
  const idx = state.selectedBlockIndex;
  if (state.blocks[idx] === undefined) return state;
  const next = new Set(state.expanded);
  if (next.has(idx)) next.delete(idx);
  else next.add(idx);
  return { ...state, expanded: next };
}

export function jumpToParent(state: AppState): AppState {
  const block = selectedBlock(state);
  if (!block || !block.parentUuid) return state;
  const idx = state.blocks.findIndex((b) => b.uuid === block.parentUuid);
  if (idx < 0) return state;
  return { ...state, selectedBlockIndex: idx };
}

export function jumpToRelated(state: AppState): AppState {
  const block = selectedBlock(state);
  if (!block) return state;
  // For tool-call/subagent: jump to the assistant message that issued it
  // (uuid is `${parentUuid}#${toolUseId}`); selectedBlockIndex moves to parent.
  // Re-uses jumpToParent logic for now — extension point: forward jump to a
  // *next* tool-call after a result, etc.
  return jumpToParent(state);
}

// --- Search ---

export function searchEnter(state: AppState): AppState {
  return {
    ...state,
    search: { mode: "typing", query: "", matches: [], cursor: 0 },
    focus: "viewer",
  };
}

export function searchType(state: AppState, ch: string): AppState {
  if (state.search.mode !== "typing") return state;
  return { ...state, search: { ...state.search, query: state.search.query + ch } };
}

export function searchBackspace(state: AppState): AppState {
  if (state.search.mode !== "typing") return state;
  return {
    ...state,
    search: { ...state.search, query: state.search.query.slice(0, -1) },
  };
}

export function searchSubmit(state: AppState): AppState {
  if (state.search.mode !== "typing") return state;
  const matches = localSearch(state.blocks, state.search.query);
  if (matches.length === 0) {
    return {
      ...state,
      search: { mode: "results", query: state.search.query, matches: [], cursor: 0 },
      statusMessage: `No matches for "${state.search.query}"`,
    };
  }
  const first = matches[0]!;
  return {
    ...state,
    search: { mode: "results", query: state.search.query, matches, cursor: 0 },
    selectedBlockIndex: first,
    statusMessage: `${matches.length} matches for "${state.search.query}"`,
  };
}

export function searchNext(state: AppState, delta: number): AppState {
  if (state.search.mode !== "results" || state.search.matches.length === 0) return state;
  const next = (state.search.cursor + delta + state.search.matches.length) % state.search.matches.length;
  const idx = state.search.matches[next]!;
  return {
    ...state,
    search: { ...state.search, cursor: next },
    selectedBlockIndex: idx,
  };
}

export function searchExit(state: AppState): AppState {
  if (state.search.mode === "off") return state;
  return { ...state, search: { mode: "off", query: "", matches: [], cursor: 0 } };
}
