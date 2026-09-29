import { Layout, RichText, Viewport } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { selectedNode } from "../state.js";
import { ViewportPerSubject } from "../../shared/viewport-per-subject.js";
import { buildTreePane } from "./tree-pane.js";
import { buildPreviewPane } from "./preview-pane.js";
import { buildStatusBar } from "./status-bar.js";

/**
 * The viewports a frame is drawn through. They outlive the frame, which is
 * rebuilt on every key: a scroll position is a viewport's, and a fresh one
 * would start from the top.
 */
export class ExploreView {
  readonly tree = new Viewport(new RichText(""));
  private readonly preview = new ViewportPerSubject();

  /** The preview's viewport for what `state` shows in it. */
  previewOf(state: AppState): Viewport {
    return this.preview.of(`${state.mode}:${state.selectedPath}`);
  }
}

export function buildShell(state: AppState, view: ExploreView): Layout {
  const selected = selectedNode(state);
  const headerText = ` rich-explore  ${selected?.entry.path ?? state.rootPath}`;
  const header = new RichText(headerText, { end: "" });
  header.stylize("bold white on blue");

  const root = new Layout();
  const headerLayout = new Layout(header, { size: 1, name: "header" });
  const body = new Layout(undefined, { name: "body", ratio: 1 });
  const footer = new Layout(buildStatusBar(), { size: 1, name: "footer" });

  const treeLayout = new Layout(
    buildTreePane(state, view.tree, state.focus === "tree"),
    { name: "tree", ratio: 2 },
  );
  const previewLayout = new Layout(
    buildPreviewPane(state.fs, selected?.entry, view.previewOf(state), state.focus === "preview", state.mode),
    { name: "preview", ratio: 3 },
  );
  body.splitRow(treeLayout, previewLayout);

  root.splitColumn(headerLayout, body, footer);
  return root;
}
