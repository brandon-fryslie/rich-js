/**
 * Immutable AppState built around a path-keyed node map. Expansion state
 * lives on NodeData; the visible list is derived by walking the root and
 * respecting `expanded` flags. Reducers produce new Maps — we never mutate
 * in place — so views are pure functions of state.
 *
 * Extension points: add a new Mode variant for search/debug/diff without
 * touching existing reducers.
 */

import { basename } from "node:path";
import { listDir, type Entry } from "./fs/walk.js";

export type Mode = "browse"; // extension: | "search" | "debug" | "diff"
export type Focus = "tree" | "preview";

export interface NodeData {
  readonly entry: Entry;
  readonly depth: number;
  readonly expanded: boolean;
  /** null = children not yet loaded; [] = loaded, empty or non-directory */
  readonly children: ReadonlyArray<string> | null;
}

export interface AppState {
  readonly rootPath: string;
  readonly nodes: ReadonlyMap<string, NodeData>;
  readonly selectedPath: string;
  readonly focus: Focus;
  readonly previewOffset: number;
  readonly mode: Mode;
}

function rootEntry(path: string): Entry {
  return {
    name: basename(path) || path,
    path,
    kind: "directory",
    size: 0,
    mtime: new Date(0),
    error: null,
  };
}

export function initialState(rootPath: string): AppState {
  const root: NodeData = {
    entry: rootEntry(rootPath),
    depth: 0,
    expanded: true,
    children: null,
  };
  const base: AppState = {
    rootPath,
    nodes: new Map([[rootPath, root]]),
    selectedPath: rootPath,
    focus: "tree",
    previewOffset: 0,
    mode: "browse",
  };
  const loaded = loadChildren(base, rootPath);
  const visible = visibleNodes(loaded);
  const firstPath = visible[0]?.entry.path ?? rootPath;
  return { ...loaded, selectedPath: firstPath };
}

/**
 * Ensure children of `path` are loaded. Idempotent: if already loaded,
 * returns state unchanged.
 */
export function loadChildren(state: AppState, path: string): AppState {
  const existing = state.nodes.get(path);
  if (!existing) return state;
  if (existing.children !== null) return state;
  if (existing.entry.kind !== "directory" || existing.entry.error) {
    const nodes = new Map(state.nodes);
    nodes.set(path, { ...existing, children: [] });
    return { ...state, nodes };
  }

  try {
    const entries = listDir(path);
    const nodes = new Map(state.nodes);
    const childPaths: string[] = [];
    for (const e of entries) {
      childPaths.push(e.path);
      if (!nodes.has(e.path)) {
        nodes.set(e.path, {
          entry: e,
          depth: existing.depth + 1,
          expanded: false,
          children: null,
        });
      }
    }
    nodes.set(path, { ...existing, children: childPaths });
    return { ...state, nodes };
  } catch (err) {
    const nodes = new Map(state.nodes);
    const msg = err instanceof Error ? err.message : String(err);
    nodes.set(path, {
      ...existing,
      children: [],
      entry: { ...existing.entry, error: msg },
    });
    return { ...state, nodes };
  }
}

export function toggleExpand(state: AppState, path: string): AppState {
  const node = state.nodes.get(path);
  if (!node || node.entry.kind !== "directory" || node.entry.error) return state;
  const loaded = loadChildren(state, path);
  const current = loaded.nodes.get(path)!;
  const nodes = new Map(loaded.nodes);
  nodes.set(path, { ...current, expanded: !current.expanded });
  return { ...loaded, nodes };
}

export function collapse(state: AppState, path: string): AppState {
  const node = state.nodes.get(path);
  if (!node || !node.expanded) return state;
  const nodes = new Map(state.nodes);
  nodes.set(path, { ...node, expanded: false });
  return { ...state, nodes };
}

export function visibleNodes(state: AppState): NodeData[] {
  const out: NodeData[] = [];
  const root = state.nodes.get(state.rootPath);
  if (!root) return out;

  const walk = (node: NodeData): void => {
    if (node.entry.path !== state.rootPath) out.push(node);
    if (node.expanded && node.children) {
      for (const childPath of node.children) {
        const child = state.nodes.get(childPath);
        if (child) walk(child);
      }
    }
  };
  walk(root);
  return out;
}

export function selectedNode(state: AppState): NodeData | undefined {
  return state.nodes.get(state.selectedPath);
}

export function parentPath(state: AppState, path: string): string | undefined {
  for (const [parent, node] of state.nodes) {
    if (node.children?.includes(path)) return parent;
  }
  return undefined;
}
