import { Layout, RichText } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { buildSidebar } from "./sidebar.js";
import { buildViewer } from "./viewer.js";
import { buildSearchBar } from "./search-bar.js";
import { buildStatusBar } from "./status-bar.js";

export function buildShell(state: AppState, termHeight: number): Layout {
  const headerText = new RichText(" claude-sessions  ", { end: "" });
  headerText.stylize("bold white on blue");
  const sub = state.errorMessage
    ? state.errorMessage
    : (state.statusMessage ?? "");
  headerText.append(sub, state.errorMessage ? "white on red" : "white on blue");

  // Height budget: header(1) + body + searchBar(1) + footer(1)
  const headerH = 1;
  const searchH = 1;
  const footerH = 1;
  const bodyH = Math.max(3, termHeight - headerH - searchH - footerH);
  const paneInnerH = Math.max(1, bodyH - 2);

  const root = new Layout();
  const header = new Layout(headerText, { size: headerH, name: "header" });
  const body = new Layout(undefined, { name: "body", ratio: 1 });
  const searchBar = new Layout(buildSearchBar(state), { size: searchH, name: "search" });
  const footer = new Layout(buildStatusBar(state), { size: footerH, name: "footer" });

  const viewerPane = new Layout(
    buildViewer(state, paneInnerH, state.focus === "viewer"),
    { name: "viewer", ratio: 3 },
  );

  if (state.sidebarVisible) {
    const sidebarPane = new Layout(
      buildSidebar(state, paneInnerH, state.focus === "sidebar"),
      { name: "sidebar", ratio: 1 },
    );
    body.splitRow(sidebarPane, viewerPane);
  } else {
    body.splitRow(viewerPane);
  }

  root.splitColumn(header, body, searchBar, footer);
  return root;
}
