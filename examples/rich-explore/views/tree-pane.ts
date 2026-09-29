import { Tree, Panel, RichText } from "../../../src/index.js";
import type { Renderable, Viewport } from "../../../src/index.js";
import type { AppState, NodeData } from "../state.js";
import { visibleNodes } from "../state.js";
import type { FileKind } from "../fs/kinds.js";

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
    { end: "", noWrap: true, overflow: "ellipsis" },
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
  viewport: Viewport,
  focused: boolean,
): Renderable {
  const root = state.nodes.get(state.rootPath);
  const rootLabel = new RichText(root?.entry.path ?? state.rootPath, { end: "", noWrap: true, overflow: "ellipsis" });
  rootLabel.stylize("bold white");
  const tree = new Tree(rootLabel, { guide_style: "dim" });

  if (root?.expanded && root.children) {
    for (const childPath of root.children) {
      const child = state.nodes.get(childPath);
      if (child) addNodeToTree(tree, child, state);
    }
  }

  const visible = visibleNodes(state);
  // Tree rendered layout: line 0 = root label, line 1..N = visible nodes.
  // Every label ends at the pane's edge rather than wrapping, so each is one line.
  const idx = visible.findIndex((n) => n.entry.path === state.selectedPath);
  const selectedLine = 1 + (idx < 0 ? 0 : idx);
  viewport.content = tree;
  // A line either side of the selection stays in view too: the entry next
  // to it, and above the first entry the root, which names what is listed.
  viewport.ensureVisible(selectedLine - 1, selectedLine + 2);
  return new Panel(viewport, {
    title: focused ? `▸ Tree (${visible.length})` : `Tree (${visible.length})`,
    borderStyle: focused ? "bold cyan" : "dim cyan",
    padding: [0, 1],
  });
}
