import { Layout, RichText, Viewport } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { buildSidebar } from "./sidebar.js";
import { buildViewer } from "./viewer.js";
import { buildSearchBar } from "./search-bar.js";
import { buildStatusBar } from "./status-bar.js";
import { markup } from "./block-renderers/_common.js";
import { escapeMarkup } from "../../../src/index.js";

function buildHeader(state: AppState): Renderable {
  let src = "[bold white on blue] claude-sessions [/bold white on blue]";
  // Breadcrumb when drilled into subagents
  if (state.sessionStack.length > 0) {
    const parts: string[] = [];
    for (const frame of state.sessionStack) {
      parts.push(frame.path.split("/").pop() ?? frame.path);
    }
    if (state.loadedSessionPath) {
      parts.push(state.loadedSessionPath.split("/").pop() ?? state.loadedSessionPath);
    }
    src += `[white on blue] ${escapeMarkup(parts.join("  →  "))} [/white on blue]`;
    src += `[yellow on blue] (depth ${state.sessionStack.length}) [/yellow on blue]`;
  }
  const sub = state.errorMessage ?? state.statusMessage ?? "";
  const subStyle = state.errorMessage ? "white on red" : "white on blue";
  src += `[${subStyle}]${escapeMarkup(sub)}[/${subStyle}]`;
  return markup(src);
}

/**
 * The viewports a frame is drawn through. They outlive the frame, which is
 * rebuilt on every key: a scroll position is a viewport's, and a fresh one
 * would start from the top.
 */
export interface SessionsView {
  readonly sidebar: Viewport;
  readonly viewer: Viewport;
  readonly results: Viewport;
}

export function sessionsView(): SessionsView {
  const blank = (): Viewport => new Viewport(new RichText(""));
  return { sidebar: blank(), viewer: blank(), results: blank() };
}

export function buildShell(state: AppState, view: SessionsView): Layout {
  const root = new Layout();
  const header = new Layout(buildHeader(state), { size: 1, name: "header" });
  const body = new Layout(undefined, { name: "body", ratio: 1 });
  const searchBar = new Layout(buildSearchBar(state), { size: 1, name: "search" });
  const footer = new Layout(buildStatusBar(state), { size: 1, name: "footer" });

  // The browser (top) takes a quarter of the body and the viewer the rest;
  // each pane's viewport shows the rows its panel leaves inside the border.
  const viewerPane = new Layout(
    buildViewer(state, view, state.focus === "viewer"),
    { name: "viewer", ratio: 3 },
  );

  if (state.sidebarVisible) {
    const browserPane = new Layout(
      buildSidebar(state, view.sidebar, state.focus === "sidebar"),
      { name: "browser", ratio: 1, minimumSize: 5 },
    );
    body.splitColumn(browserPane, viewerPane);
  } else {
    body.splitColumn(viewerPane);
  }

  root.splitColumn(header, body, searchBar, footer);
  return root;
}
