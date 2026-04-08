import { Panel, Tree, RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { Window } from "../../shared/window.js";

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

export function buildSidebar(state: AppState, innerHeight: number, focused: boolean): Renderable {
  const project = state.projects[state.selectedProjectIndex];
  const rootLabel = new RichText(
    state.sidebarLevel === "project" ? "Projects" : (project?.displayName ?? "?"),
    { end: "" },
  );
  rootLabel.stylize("bold white");
  const tree = new Tree(rootLabel, { guide_style: "dim" });

  let selectedLine = 1;
  let totalLines = 1;

  if (state.sidebarLevel === "project") {
    state.projects.forEach((p, i) => {
      const isSel = i === state.selectedProjectIndex;
      const label = new RichText(
        `${p.displayName}  (${p.sessions.length})`,
        { end: "" },
      );
      if (isSel) label.stylize("reverse bold");
      else label.stylize("white");
      tree.add(label);
      totalLines++;
      if (isSel) selectedLine = totalLines;
    });
  } else {
    const sessions = project?.sessions ?? [];
    sessions.forEach((s, i) => {
      const isSel = i === state.selectedSessionIndex;
      const titleText = s.slug ?? s.fileName.slice(0, 8);
      const meta = `${fmtSize(s.size)} · ${fmtMtime(s.mtime)}`;
      const label = new RichText(`${titleText}  `, { end: "" });
      label.append(meta, "dim");
      if (isSel) label.stylize("reverse bold", 0, titleText.length);
      tree.add(label);
      totalLines++;
      if (isSel) selectedLine = totalLines;
    });
  }

  const maxOffset = Math.max(0, totalLines - innerHeight);
  const desired = selectedLine - Math.floor(innerHeight / 2);
  const offset = Math.max(0, Math.min(desired, maxOffset));

  const windowed = new Window(tree, innerHeight, offset);
  const titlePrefix = focused ? "▸ " : "";
  const title = state.sidebarLevel === "project"
    ? `${titlePrefix}Projects (${state.projects.length})`
    : `${titlePrefix}Sessions (${project?.sessions.length ?? 0})`;
  return new Panel(windowed, {
    title,
    borderStyle: focused ? "bold cyan" : "dim cyan",
    padding: [0, 1],
  });
}
