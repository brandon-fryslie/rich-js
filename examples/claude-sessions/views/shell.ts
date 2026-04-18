import { Layout } from "../../../src/index.js";
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

export function buildShell(state: AppState, termHeight: number): Layout {
  const headerText = buildHeader(state);

  // Vertical budget: header(1) + body + searchBar(1) + footer(1)
  const headerH = 1;
  const searchH = 1;
  const footerH = 1;
  const bodyH = Math.max(3, termHeight - headerH - searchH - footerH);

  // Browser (top) occupies ~25% of body, viewer (bottom) takes the rest.
  // Both panes reserve 2 rows for Panel borders.
  const browserPaneH = state.sidebarVisible
    ? Math.max(5, Math.floor(bodyH / 4))
    : 0;
  const viewerPaneH = bodyH - browserPaneH;
  const browserInnerH = Math.max(1, browserPaneH - 2);
  const viewerInnerH = Math.max(1, viewerPaneH - 2);

  const root = new Layout();
  const header = new Layout(headerText, { size: headerH, name: "header" });
  const body = new Layout(undefined, { name: "body", ratio: 1 });
  const searchBar = new Layout(buildSearchBar(state), { size: searchH, name: "search" });
  const footer = new Layout(buildStatusBar(state), { size: footerH, name: "footer" });

  const viewerPane = new Layout(
    buildViewer(state, viewerInnerH, state.focus === "viewer"),
    { name: "viewer", ratio: 3 },
  );

  if (state.sidebarVisible) {
    const browserPane = new Layout(
      buildSidebar(state, browserInnerH, state.focus === "sidebar"),
      { name: "browser", size: browserPaneH },
    );
    body.splitColumn(browserPane, viewerPane);
  } else {
    body.splitColumn(viewerPane);
  }

  root.splitColumn(header, body, searchBar, footer);
  return root;
}
