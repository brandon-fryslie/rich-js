/**
 * Immutable AppState for the claude-sessions browser.
 *
 * Reducers produce new states; views are pure functions of state.
 *
 * Extension points:
 * - SearchMode: add more variants for alternate search scopes
 * - Mode: add a top-level mode for filter expressions / REPL
 */

import { basename, dirname, join } from "node:path";
import { existsSync } from "node:fs";
import type { Block, ProjectMeta, SessionMeta } from "./data/types.js";
import { scanProjects } from "./data/scanner.js";
import { loadSession, type RawLine } from "./data/loader.js";
import { parseBlocks } from "./data/parser.js";
import { localSearch } from "./data/search.js";
import { searchGlobal, type GlobalHit } from "./data/global-search.js";

export type Focus = "sidebar" | "viewer";
export type ViewMode = "pretty" | "raw";

/** Search modes form a state machine:
 *    off
 *     └── (/) → typing-local  → (enter)  → results-local
 *     └── (S) → typing-global → (enter)  → results-global
 *    (esc from any non-off → off)
 */
export type SearchMode =
  | "off"
  | "typing-local"
  | "results-local"
  | "typing-global"
  | "results-global";

export interface SearchState {
  readonly mode: SearchMode;
  readonly query: string;
  readonly matches: ReadonlyArray<number>;   // block indices (local)
  readonly cursor: number;                   // cursor into matches (local)
  readonly globalHits: ReadonlyArray<GlobalHit>;
  readonly globalCursor: number;
}

const EMPTY_SEARCH: SearchState = {
  mode: "off",
  query: "",
  matches: [],
  cursor: 0,
  globalHits: [],
  globalCursor: 0,
};

export interface StackFrame {
  readonly path: string;
  readonly selectedBlockIndex: number;
  readonly showHidden: boolean;
  readonly viewMode: ViewMode;
  readonly expanded: ReadonlySet<number>;
}

export interface AppState {
  // Sidebar
  readonly projects: ReadonlyArray<ProjectMeta>;
  readonly selectedProjectIndex: number;
  readonly selectedSessionIndex: number;
  readonly sidebarVisible: boolean;
  readonly sidebarLevel: "project" | "session";

  // Viewer — current session
  readonly loadedSessionPath: string | null;
  readonly rawLines: ReadonlyArray<RawLine>;
  readonly blocks: ReadonlyArray<Block>;
  readonly selectedBlockIndex: number;
  readonly viewMode: ViewMode;
  readonly expanded: ReadonlySet<number>;
  readonly showHidden: boolean;

  // Drill-down stack (parent session frames to pop back to)
  readonly sessionStack: ReadonlyArray<StackFrame>;

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
    rawLines: [],
    blocks: [],
    selectedBlockIndex: 0,
    viewMode: "pretty",
    expanded: new Set(),
    showHidden: false,
    sessionStack: [],
    focus: "sidebar",
    search: EMPTY_SEARCH,
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

export function selectedGlobalHit(state: AppState): GlobalHit | undefined {
  return state.search.globalHits[state.search.globalCursor];
}

// --- Reducer helpers ---

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// --- Sidebar ---

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
  return openSelectedSession(state);
}

export function ascendSidebar(state: AppState): AppState {
  if (state.sidebarLevel === "session") {
    return { ...state, sidebarLevel: "project" };
  }
  return state;
}

// --- Session loading (shared between sidebar-open and drill/pop) ---

function loadPath(state: AppState, path: string, opts: {
  selectedBlockIndex?: number;
  showHidden?: boolean;
  viewMode?: ViewMode;
  expanded?: ReadonlySet<number>;
  statusPrefix?: string;
}): AppState {
  try {
    const result = loadSession(path);
    const showHidden = opts.showHidden ?? false;
    const blocks = parseBlocks(result.lines, { showHidden });
    const blockCount = blocks.length;
    const selectedBlockIndex = Math.min(
      opts.selectedBlockIndex ?? 0,
      Math.max(0, blockCount - 1),
    );
    return {
      ...state,
      loadedSessionPath: path,
      rawLines: result.lines,
      blocks,
      selectedBlockIndex,
      viewMode: opts.viewMode ?? "pretty",
      expanded: opts.expanded ?? new Set(),
      showHidden,
      focus: "viewer",
      search: EMPTY_SEARCH,
      statusMessage: `${opts.statusPrefix ?? "Loaded"} ${blockCount} blocks${result.skipped > 0 ? ` (${result.skipped} lines skipped)` : ""}`,
      errorMessage: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...state, errorMessage: `Load failed: ${msg}` };
  }
}

export function openSelectedSession(state: AppState): AppState {
  const session = selectedSession(state);
  if (!session) return state;
  if (session.path === state.loadedSessionPath) {
    return { ...state, focus: "viewer" };
  }
  // Opening a new session clears any drill stack — we're starting fresh
  return loadPath({ ...state, sessionStack: [] }, session.path, {});
}

// --- Viewer movement ---

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

// --- Layout / mode toggles ---

export function toggleSidebar(state: AppState): AppState {
  return {
    ...state,
    sidebarVisible: !state.sidebarVisible,
    focus: state.sidebarVisible ? "viewer" : state.focus,
  };
}

export function toggleFocus(state: AppState): AppState {
  if (!state.sidebarVisible) return state;
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

export function toggleHidden(state: AppState): AppState {
  if (state.rawLines.length === 0) return state;
  const showHidden = !state.showHidden;
  const currentUuid = selectedBlock(state)?.uuid;
  const blocks = parseBlocks(state.rawLines, { showHidden });
  // Try to keep selection on the same block after the filter changes
  const nextIdx = currentUuid
    ? Math.max(0, blocks.findIndex((b) => b.uuid === currentUuid))
    : 0;
  return {
    ...state,
    showHidden,
    blocks,
    selectedBlockIndex: nextIdx,
    statusMessage: showHidden
      ? `Showing hidden blocks (${blocks.length} total)`
      : `Hidden blocks filtered (${blocks.length} shown)`,
  };
}

// --- Navigation ---

export function jumpToParent(state: AppState): AppState {
  const block = selectedBlock(state);
  if (!block || !block.parentUuid) return state;
  const idx = state.blocks.findIndex((b) => b.uuid === block.parentUuid);
  if (idx < 0) return state;
  return { ...state, selectedBlockIndex: idx };
}

// --- Drill-down ---

/** Compute the subagent file path for a SubagentBlock. Returns null if the
 *  current session path is unknown or the subagent file doesn't exist. */
function subagentPath(state: AppState, agentId: string): string | null {
  if (!state.loadedSessionPath) return null;
  const sessionUuid = basename(state.loadedSessionPath, ".jsonl");
  const projectDir = dirname(state.loadedSessionPath);
  const path = join(projectDir, sessionUuid, "subagents", `agent-${agentId}.jsonl`);
  if (!existsSync(path)) return null;
  return path;
}

export function drillIntoSelected(state: AppState): AppState {
  const block = selectedBlock(state);
  if (!block || block.kind !== "subagent") return state;
  if (!block.agentId) {
    return { ...state, errorMessage: "This subagent has no agentId — cannot drill in" };
  }
  const path = subagentPath(state, block.agentId);
  if (!path) {
    return {
      ...state,
      errorMessage: `Subagent file not found: agent-${block.agentId}.jsonl`,
    };
  }
  const frame: StackFrame = {
    path: state.loadedSessionPath!,
    selectedBlockIndex: state.selectedBlockIndex,
    showHidden: state.showHidden,
    viewMode: state.viewMode,
    expanded: state.expanded,
  };
  const nextStack = [...state.sessionStack, frame];
  return loadPath(
    { ...state, sessionStack: nextStack },
    path,
    { statusPrefix: "Drilled into subagent —" },
  );
}

export function popSession(state: AppState): AppState {
  if (state.sessionStack.length === 0) return state;
  const frame = state.sessionStack[state.sessionStack.length - 1]!;
  const nextStack = state.sessionStack.slice(0, -1);
  return loadPath(
    { ...state, sessionStack: nextStack },
    frame.path,
    {
      selectedBlockIndex: frame.selectedBlockIndex,
      showHidden: frame.showHidden,
      viewMode: frame.viewMode,
      expanded: frame.expanded,
      statusPrefix: "Returned to parent —",
    },
  );
}

// --- Local search ---

export function searchEnter(state: AppState): AppState {
  return {
    ...state,
    search: { ...EMPTY_SEARCH, mode: "typing-local" },
    focus: "viewer",
  };
}

export function searchType(state: AppState, ch: string): AppState {
  if (state.search.mode !== "typing-local" && state.search.mode !== "typing-global") {
    return state;
  }
  return { ...state, search: { ...state.search, query: state.search.query + ch } };
}

export function searchBackspace(state: AppState): AppState {
  if (state.search.mode !== "typing-local" && state.search.mode !== "typing-global") {
    return state;
  }
  return {
    ...state,
    search: { ...state.search, query: state.search.query.slice(0, -1) },
  };
}

export function searchSubmit(state: AppState): AppState {
  if (state.search.mode === "typing-local") {
    return submitLocal(state);
  }
  if (state.search.mode === "typing-global") {
    return submitGlobal(state);
  }
  return state;
}

function submitLocal(state: AppState): AppState {
  const matches = localSearch(state.blocks, state.search.query);
  if (matches.length === 0) {
    return {
      ...state,
      search: { ...state.search, mode: "results-local", matches: [], cursor: 0 },
      statusMessage: `No matches for "${state.search.query}"`,
    };
  }
  const first = matches[0]!;
  return {
    ...state,
    search: { ...state.search, mode: "results-local", matches, cursor: 0 },
    selectedBlockIndex: first,
    statusMessage: `${matches.length} matches for "${state.search.query}"`,
  };
}

export function searchNext(state: AppState, delta: number): AppState {
  if (state.search.mode === "results-local") {
    if (state.search.matches.length === 0) return state;
    const next = (state.search.cursor + delta + state.search.matches.length) % state.search.matches.length;
    const idx = state.search.matches[next]!;
    return {
      ...state,
      search: { ...state.search, cursor: next },
      selectedBlockIndex: idx,
    };
  }
  if (state.search.mode === "results-global") {
    if (state.search.globalHits.length === 0) return state;
    const next = (state.search.globalCursor + delta + state.search.globalHits.length) % state.search.globalHits.length;
    return { ...state, search: { ...state.search, globalCursor: next } };
  }
  return state;
}

export function searchExit(state: AppState): AppState {
  if (state.search.mode === "off") return state;
  return { ...state, search: EMPTY_SEARCH };
}

// --- Global search ---

export function globalSearchEnter(state: AppState): AppState {
  return {
    ...state,
    search: { ...EMPTY_SEARCH, mode: "typing-global" },
    focus: "viewer",
  };
}

function submitGlobal(state: AppState): AppState {
  const query = state.search.query;
  const hits = searchGlobal(state.projects, query, { maxHits: 200 });
  return {
    ...state,
    search: {
      ...state.search,
      mode: "results-global",
      globalHits: hits,
      globalCursor: 0,
    },
    statusMessage: hits.length === 0
      ? `No global matches for "${query}"`
      : `${hits.length} global matches for "${query}" (press ⏎ to open)`,
  };
}

export function openSelectedGlobalHit(state: AppState): AppState {
  const hit = selectedGlobalHit(state);
  if (!hit) return state;
  // Navigate sidebar to the containing project/session for context
  const withSidebar: AppState = {
    ...state,
    selectedProjectIndex: hit.projectIndex,
    selectedSessionIndex: hit.sessionIndex,
    sidebarLevel: "session",
    sessionStack: [],
    search: EMPTY_SEARCH,
  };
  const loaded = loadPath(withSidebar, hit.sessionPath, {
    statusPrefix: `Opened from search —`,
  });
  // Try to jump to the matching block by uuid
  if (hit.uuid) {
    const idx = loaded.blocks.findIndex((b) => b.uuid === hit.uuid || b.uuid.startsWith(`${hit.uuid}#`));
    if (idx >= 0) {
      return { ...loaded, selectedBlockIndex: idx };
    }
  }
  return loaded;
}
