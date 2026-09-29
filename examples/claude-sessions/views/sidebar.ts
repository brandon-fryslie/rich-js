import { Panel, Tree, RichText } from "../../../src/index.js";
import type { Renderable, Viewport } from "../../../src/index.js";
import type { AppState } from "../state.js";

function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}

function fmtMtime(d: Date): string {
  const now = Date.now();
  const ms = now - d.getTime();
  const min = ms / 1000 / 60;
  if (min < 60) return `${Math.round(min)}m ago`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  const days = h / 24;
  if (days < 30) return `${Math.round(days)}d ago`;
  return d.toISOString().slice(0, 10);
}

export function buildSidebar(state: AppState, viewport: Viewport, focused: boolean): Renderable {
  const project = state.projects[state.selectedProjectIndex];
  const rootLabel = new RichText(
    state.sidebarLevel === "project" ? "Projects" : (project?.displayName ?? "?"),
    { end: "", noWrap: true, overflow: "ellipsis" },
  );
  rootLabel.stylize("bold white");
  const tree = new Tree(rootLabel, { guide_style: "dim" });

  if (state.sidebarLevel === "project") {
    state.projects.forEach((p, i) => {
      const isSel = i === state.selectedProjectIndex;
      const label = new RichText(
        `${p.displayName}  (${p.sessions.length})`,
        { end: "", noWrap: true, overflow: "ellipsis" },
      );
      if (isSel) label.stylize("reverse bold");
      else label.stylize("white");
      tree.add(label);
    });
  } else {
    const sessions = project?.sessions ?? [];
    sessions.forEach((s, i) => {
      const isSel = i === state.selectedSessionIndex;
      const titleText = s.slug ?? s.fileName.slice(0, 8);
      const meta = `${fmtSize(s.size)} · ${fmtMtime(s.mtime)}`;
      const label = new RichText(`${titleText}  `, { end: "", noWrap: true, overflow: "ellipsis" });
      label.append(meta, "dim");
      if (isSel) label.stylize("reverse bold", 0, titleText.length);
      tree.add(label);
    });
  }

  // The tree's first line is its root, and each entry is one line under it:
  // labels end at the pane's edge rather than wrapping, so an entry's index
  // fixes its line.
  const selectedLine = 1 + (state.sidebarLevel === "project" ? state.selectedProjectIndex : state.selectedSessionIndex);
  viewport.content = tree;
  viewport.ensureVisible(selectedLine, selectedLine + 1);
  const titlePrefix = focused ? "▸ " : "";
  const title = state.sidebarLevel === "project"
    ? `${titlePrefix}Projects (${state.projects.length})`
    : `${titlePrefix}Sessions (${project?.sessions.length ?? 0})`;
  return new Panel(viewport, {
    title,
    borderStyle: focused ? "bold cyan" : "dim cyan",
    padding: [0, 1],
  });
}
