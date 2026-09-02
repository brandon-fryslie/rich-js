// [LAW:no-silent-failure] The allowlist is the only place a public export
// may be absent from `examples/` without breaking the build. Every entry is
// explicit and carries a written reason for the absence.
//
// [LAW:one-source-of-truth] Keys are canonical exposed names — see
// `canonicalNameFor()` in `extract.ts`. The verifier additionally rejects
// (a) entries pointing at no real export (dead), and (b) entries already
// covered by a demo (redundant) — both shapes of drift the allowlist
// itself would otherwise hide.
//
// This file is burndown debt with a justification field, not a mute button.
// The intended direction is emptier: reach for an entry only when the export
// genuinely cannot appear in a runtime demo, and otherwise reference it from
// a demo under `examples/`.

/** Why one public export is absent from `examples/` without failing the build. */
export interface AllowlistEntry {
  readonly reason: string;
}

/**
 * Shared by every entry whose absence has not been investigated
 * individually. `rich-coverage-0as.1` is the ticket that replaces these with
 * a per-export outcome — demo it, fold it into a demo, exempt it with a real
 * reason, or delete the export. Writing 96 distinct reasons before that
 * investigation would read as justification while being invented.
 */
const untriaged: AllowlistEntry = {
  reason: "No demo references this export; untriaged — see rich-coverage-0as.1.",
};

/**
 * Keyed by canonical exposed name (see `extract.ts: canonicalNameFor`).
 *
 * Grouped by the subsystem the export is *declared* in, alphabetical within
 * each group. Declaration site is what the verifier keys coverage on, so
 * grouping by it is the one ordering that matches how entries actually clear:
 * a demo that exercises a subsystem burns down a contiguous block here.
 */
export const ALLOWLIST: Readonly<Record<string, AllowlistEntry>> = {
  // -- from src/core/ (core primitives) -----------------------------
  asCodeUnit: untriaged,
  Box: untriaged,
  BoxChars: untriaged,
  CapsuleJoinerOptions: untriaged,
  CellCol: untriaged,
  cellColToCodeUnitOffset: untriaged,
  cellFitFrom: untriaged,
  CodePoint: untriaged,
  CodeUnit: untriaged,
  ConsoleOptions: untriaged,
  ConsoleSink: {
    reason:
      "Structural type for Console's `file:` option. Demos depend on the contract " +
      "structurally via `new Console({ file: hostStream(host) })`, which names no type.",
  },
  ControlCode: untriaged,
  ControlType: untriaged,
  globalMarkupRegistry: untriaged,
  GradientJoinerOptions: untriaged,
  HEAVY_HEAD: untriaged,
  Highlighter: untriaged,
  Joiner: untriaged,
  JSONHighlighter: untriaged,
  MarkupTagContext: untriaged,
  MarkupTagHandler: untriaged,
  Measurable: untriaged,
  nextCodePoint: untriaged,
  PlainJoinerOptions: untriaged,
  PowerlineJoinerOptions: untriaged,
  prevCodePoint: untriaged,
  PrintOptions: untriaged,
  registerMarkupTag: untriaged,
  RenderMarkupOptions: untriaged,
  renderToString: untriaged,
  RenderToStringOptions: untriaged,
  ReprHighlighter: untriaged,
  RichTextOptions: untriaged,
  RowLevel: untriaged,
  segmentsToString: untriaged,
  segmentToString: untriaged,
  Span: untriaged,
  SpinnerData: untriaged,
  StyledRenderable: untriaged,
  StyleOptions: untriaged,
  SubstituteOptions: untriaged,
  Tag: untriaged,
  unregisterMarkupTag: untriaged,

  // -- from src/node/ (the Node capability seam) --------------------
  nodeAsk: {
    reason:
      "readline-backed PromptInput implementation. Demonstrable only by a demo " +
      "that accepts interactive line input; every TUI demo here reads raw-mode stdin.",
  },
  saveText: {
    reason:
      "Node-only plain-text exporter. Its HTML sibling saveHtml is covered by " +
      "examples/themes-and-color-studio/index.ts, which wants HTML, not text.",
  },

  // -- from src/renderables/ (renderables) --------------------------
  Alignment: untriaged,
  Column: untriaged,
  ColumnOptions: untriaged,
  ColumnsOptions: untriaged,
  FlexAlign: untriaged,
  FlexStripOptions: untriaged,
  JSONOptions: untriaged,
  LayoutOptions: untriaged,
  LiveOptions: untriaged,
  MarkdownOptions: untriaged,
  PaddingDimensions: untriaged,
  PanelOptions: untriaged,
  PrettyOptions: untriaged,
  ProgressBarOptions: untriaged,
  ProgressOptions: untriaged,
  PromptInput: {
    reason:
      "Prompt's input-capability type. The Prompt classes are exercised by " +
      "examples/rich-explore/renderers/coverage.ts, but no demo wires a custom " +
      "input source and so no demo names this type.",
  },
  PromptOptions: {
    reason:
      "Prompt's companion options type; same cause as PromptInput — the demo " +
      "that constructs a Prompt does not pass options.",
  },
  RuleAlign: untriaged,
  RuleOptions: untriaged,
  Spinner: untriaged,
  SpinnerOptions: untriaged,
  StatusOptions: untriaged,
  SyntaxOptions: untriaged,
  TableOptions: untriaged,
  TaskOptions: untriaged,
  TaskUpdateOptions: untriaged,
  TracebackOptions: untriaged,
  TreeOptions: untriaged,

  // -- from src/template-bindings/ (template bindings) --------------
  createRichTextEngine: untriaged,

  // -- from src/widgets/ (widgets) ----------------------------------
  ButtonOptions: untriaged,
  ButtonVariant: untriaged,
  CheckboxOptions: untriaged,
  ColorSystemSpec: untriaged,
  DropdownOptions: untriaged,
  EventRouterOptions: untriaged,
  FLOW: untriaged,
  FocusManager: untriaged,
  hasOverlay: untriaged,
  KeyEvent: untriaged,
  KeyEventInit: untriaged,
  KeyHandlerOptions: untriaged,
  KeyHandlerPriority: untriaged,
  NodeTerminalHostOptions: {
    reason:
      "No demo constructs a NodeTerminalHost with explicit options. The rest of " +
      "the TerminalHost contract is covered by examples/browser-terminal-host-harness.",
  },
  OverlayRenderable: untriaged,
  Placement: untriaged,
  Screen: untriaged,
  ScreenOptions: untriaged,
  SliderOptions: untriaged,
  StaticItemOptions: untriaged,
  TextInputOptions: untriaged,
  ToggleOptions: untriaged,
  ToggleVariant: untriaged,
  Unsubscribe: untriaged,
  WidgetBase: untriaged,
  WidgetBounds: untriaged,
  WidgetFocusEvent: untriaged,
  WidgetMouseEvent: untriaged,
};
