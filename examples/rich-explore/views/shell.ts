import { Layout, RichText } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { selectedNode } from "../state.js";
import { buildTreePane } from "./tree-pane.js";
import { buildPreviewPane } from "./preview-pane.js";
import { buildStatusBar } from "./status-bar.js";

export function buildShell(state: AppState, termHeight: number): Layout {
  const selected = selectedNode(state);
  const headerText = ` rich-explore  ${selected?.entry.path ?? state.rootPath}`;
  const header = new RichText(headerText, { end: "" });
  header.stylize("bold white on blue");

  // Height budget: header(1) + body + footer(1) = termHeight
  // Pane inner = bodyHeight - 2 (top+bottom borders), padding [0,1] → no v-padding
  const headerHeight = 1;
  const footerHeight = 1;
  const bodyHeight = Math.max(3, termHeight - headerHeight - footerHeight);
  const paneInnerHeight = Math.max(1, bodyHeight - 2);

  const root = new Layout();
  const headerLayout = new Layout(header, { size: headerHeight, name: "header" });
  const body = new Layout(undefined, { name: "body", ratio: 1 });
  const footer = new Layout(buildStatusBar(), { size: footerHeight, name: "footer" });

  const treeLayout = new Layout(
    buildTreePane(state, paneInnerHeight, state.focus === "tree"),
    { name: "tree", ratio: 2 },
  );
  const previewLayout = new Layout(
    buildPreviewPane(selected?.entry, paneInnerHeight, state.previewOffset, state.focus === "preview"),
    { name: "preview", ratio: 3 },
  );
  body.splitRow(treeLayout, previewLayout);

  root.splitColumn(headerLayout, body, footer);
  return root;
}
