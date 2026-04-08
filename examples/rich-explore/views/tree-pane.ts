import { Tree, Panel, RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState, NodeData } from "../state.js";
import { visibleNodes } from "../state.js";
import type { FileKind } from "../fs/kinds.js";
import { Window } from "./window.js";

const KIND_STYLE: Record<FileKind, string> = {
  directory: "bold blue",
  markdown: "white",
  source: "cyan",
  json: "yellow",
  binary: "magenta",
  fallback: "dim",
};

function expansionIndicator(node: NodeData): string {
  if (node.entry.kind !== "directory") return "  ";
  return node.expanded ? "▾ " : "▸ ";
}

function buildLabel(node: NodeData, state: AppState): RichText {
  const label = new RichText(
    `${expansionIndicator(node)}${node.entry.name}`,
    { end: "" },
  );
  if (node.entry.path === state.selectedPath) {
    label.stylize("reverse bold");
  } else {
    label.stylize(KIND_STYLE[node.entry.kind]);
  }
  if (node.entry.error) label.append(" ✗", "red");
  return label;
}

function addNodeToTree(parentTree: Tree, node: NodeData, state: AppState): void {
  const childTree = parentTree.add(buildLabel(node, state));
  if (!node.expanded || !node.children) return;
  for (const childPath of node.children) {
    const child = state.nodes.get(childPath);
    if (child) addNodeToTree(childTree, child, state);
  }
}

export function buildTreePane(
  state: AppState,
  innerHeight: number,
  focused: boolean,
): Renderable {
  const root = state.nodes.get(state.rootPath);
  const rootLabel = new RichText(root?.entry.path ?? state.rootPath, { end: "" });
  rootLabel.stylize("bold white");
  const tree = new Tree(rootLabel, { guide_style: "dim" });

  if (root?.expanded && root.children) {
    for (const childPath of root.children) {
      const child = state.nodes.get(childPath);
      if (child) addNodeToTree(tree, child, state);
    }
  }

  const visible = visibleNodes(state);
  // Tree rendered layout: line 0 = root label, line 1..N = visible nodes
  const idx = visible.findIndex((n) => n.entry.path === state.selectedPath);
  const selectedLine = 1 + (idx < 0 ? 0 : idx);
  const totalLines = 1 + visible.length;
  const maxOffset = Math.max(0, totalLines - innerHeight);
  const desired = selectedLine - Math.floor(innerHeight / 2);
  const offset = Math.max(0, Math.min(desired, maxOffset));

  const windowed = new Window(tree, innerHeight, offset);
  return new Panel(windowed, {
    title: focused ? `▸ Tree (${visible.length})` : `Tree (${visible.length})`,
    borderStyle: focused ? "bold cyan" : "dim cyan",
    padding: [0, 1],
  });
}
