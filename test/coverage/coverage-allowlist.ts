// [LAW:no-silent-fallbacks] The allowlist is the only place a public
// export may be absent from `examples/` without breaking the build. Every
// entry is explicit and justified: either *burndown* (a flagship demo
// will cover it; tagged with the flagship that owns the coverage) or
// *permanent* (genuinely undemonstrable in a runtime demo; justified).
//
// [LAW:one-source-of-truth] Keys are canonical exposed names — see
// `canonicalNameFor()` in `extract.ts`. The verifier additionally
// rejects (a) entries pointing at no real export (dead), and (b)
// entries already covered by a demo (redundant) — both shapes of
// drift the allowlist itself would otherwise hide.
//
// Until the flagship demos land (epic rich-demos-l2x.3 through .7), this
// file is mostly burndown debt. Each flagship-build ticket removes its
// own entries as it lands real coverage. Final state: only `permanent`
// entries remain, and they are rare.

/**
 * The five flagship demos described in the epic. Adding a new value
 * here is a deliberate scope change and requires updating the epic.
 */
export type Flagship =
  | "themes-and-color-studio"
  | "renderables-gallery"
  | "widgets-playground"
  | "markup-and-text-lab"
  | "live-progress-console";

export type AllowlistEntry =
  | { readonly kind: "burndown"; readonly flagship: Flagship; readonly note?: string }
  | { readonly kind: "permanent"; readonly reason: string };

const burndown = (flagship: Flagship, note?: string): AllowlistEntry =>
  note === undefined ? { kind: "burndown", flagship } : { kind: "burndown", flagship, note };

/**
 * Keyed by canonical exposed name (see `extract.ts: canonicalNameFor`).
 *
 * Order: grouped by flagship (themes-and-color-studio,
 * renderables-gallery, widgets-playground, markup-and-text-lab,
 * live-progress-console), alphabetical within each group. The
 * flagship grouping makes the burn-down ergonomic — when ticket
 * rich-demos-l2x.N lands its flagship's demos, the diff to this file
 * is a single contiguous block deletion, not entries scattered across
 * the file.
 */
export const ALLOWLIST: Readonly<Record<string, AllowlistEntry>> = {
  // -- Themes & Color Studio ----------------------------------------------
  // All entries burned down by examples/themes-and-color-studio
  // (rich-demos-l2x.3). [LAW:no-silent-fallbacks] — removing an entry
  // without a real demo reference fails the verifier loudly.

  // -- Renderables Gallery ------------------------------------------------
  Alignment: burndown("renderables-gallery"),
  Box: burndown("renderables-gallery"),
  BoxChars: burndown("renderables-gallery"),
  Column: burndown("renderables-gallery"),
  ColumnOptions: burndown("renderables-gallery"),
  ColumnsOptions: burndown("renderables-gallery"),
  HEAVY_HEAD: burndown("renderables-gallery"),
  JSONOptions: burndown("renderables-gallery"),
  LayoutOptions: burndown("renderables-gallery"),
  MarkdownOptions: burndown("renderables-gallery"),
  Measurable: burndown("renderables-gallery"),
  PaddingDimensions: burndown("renderables-gallery"),
  PanelOptions: burndown("renderables-gallery"),
  PrettyOptions: burndown("renderables-gallery"),
  RowLevel: burndown("renderables-gallery"),
  RuleAlign: burndown("renderables-gallery"),
  RuleOptions: burndown("renderables-gallery"),
  SubstituteOptions: burndown("renderables-gallery"),
  SyntaxOptions: burndown("renderables-gallery"),
  TableOptions: burndown("renderables-gallery"),
  TreeOptions: burndown("renderables-gallery"),

  // -- Widgets Playground -------------------------------------------------
  ButtonOptions: burndown("widgets-playground"),
  ButtonVariant: burndown("widgets-playground"),
  CheckboxOptions: burndown("widgets-playground"),
  ColorSystemSpec: burndown("widgets-playground"),
  DropdownOptions: burndown("widgets-playground"),
  EventRouterOptions: burndown("widgets-playground"),
  FLOW: burndown("widgets-playground"),
  FocusManager: burndown("widgets-playground"),
  KeyEvent: burndown("widgets-playground"),
  KeyEventInit: burndown("widgets-playground"),
  KeyHandlerOptions: burndown("widgets-playground"),
  KeyHandlerPriority: burndown("widgets-playground"),
  OverlayRenderable: burndown("widgets-playground"),
  Placement: burndown("widgets-playground"),
  Screen: burndown("widgets-playground"),
  ScreenOptions: burndown("widgets-playground"),
  SliderOptions: burndown("widgets-playground"),
  StaticItemOptions: burndown("widgets-playground"),
  // TerminalHost contract types — the runtime value (NodeTerminalHost)
  // is exercised by the interactive demos today; the type annotations
  // are exercised directly by the browser adapter (rich-demo-site-pek.2)
  // and by demo pages that surface size/resize (rich-demo-site-pek.4).
  DataHandler: burndown("widgets-playground"),
  NodeTerminalHostOptions: burndown("widgets-playground"),
  ResizeHandler: burndown("widgets-playground"),
  TerminalHost: burndown("widgets-playground"),
  TerminalSize: burndown("widgets-playground"),
  TextInputOptions: burndown("widgets-playground"),
  ToggleOptions: burndown("widgets-playground"),
  ToggleVariant: burndown("widgets-playground"),
  Unsubscribe: burndown("widgets-playground"),
  WidgetBase: burndown("widgets-playground"),
  WidgetBounds: burndown("widgets-playground"),
  WidgetFocusEvent: burndown("widgets-playground"),
  WidgetMouseEvent: burndown("widgets-playground"),
  hasOverlay: burndown("widgets-playground"),

  // -- Markup & Text Lab --------------------------------------------------
  CapsuleJoinerOptions: burndown("markup-and-text-lab"),
  CellCol: burndown("markup-and-text-lab"),
  CodePoint: burndown("markup-and-text-lab"),
  CodeUnit: burndown("markup-and-text-lab"),
  ControlCode: burndown("markup-and-text-lab"),
  ControlType: burndown("markup-and-text-lab"),
  FlexAlign: burndown("markup-and-text-lab"),
  FlexStripOptions: burndown("markup-and-text-lab"),
  GradientJoinerOptions: burndown("markup-and-text-lab"),
  Highlighter: burndown("markup-and-text-lab"),
  JSONHighlighter: burndown("markup-and-text-lab"),
  Joiner: burndown("markup-and-text-lab"),
  MarkupTagContext: burndown("markup-and-text-lab"),
  MarkupTagHandler: burndown("markup-and-text-lab"),
  PlainJoinerOptions: burndown("markup-and-text-lab"),
  PowerlineJoinerOptions: burndown("markup-and-text-lab"),
  RenderMarkupOptions: burndown("markup-and-text-lab"),
  RenderToStringOptions: burndown("markup-and-text-lab"),
  ReprHighlighter: burndown("markup-and-text-lab"),
  RichTextOptions: burndown("markup-and-text-lab"),
  Span: burndown("markup-and-text-lab"),
  StripCellPart: burndown("markup-and-text-lab"),
  StyleOptions: burndown("markup-and-text-lab"),
  StyledRenderable: burndown("markup-and-text-lab"),
  Tag: burndown("markup-and-text-lab"),
  asCodeUnit: burndown("markup-and-text-lab"),
  cellColToCodeUnitOffset: burndown("markup-and-text-lab"),
  cellFitFrom: burndown("markup-and-text-lab"),
  createRichTextEngine: burndown("markup-and-text-lab"),
  globalMarkupRegistry: burndown("markup-and-text-lab"),
  nextCodePoint: burndown("markup-and-text-lab"),
  prevCodePoint: burndown("markup-and-text-lab"),
  registerMarkupTag: burndown("markup-and-text-lab"),
  renderToString: burndown("markup-and-text-lab"),
  segmentToString: burndown("markup-and-text-lab"),
  segmentsToString: burndown("markup-and-text-lab"),
  unregisterMarkupTag: burndown("markup-and-text-lab"),

  // -- Live, Progress & Console -------------------------------------------
  ConsoleOptions: burndown("live-progress-console"),
  LiveOptions: burndown("live-progress-console"),
  PrintOptions: burndown("live-progress-console"),
  ProgressBarOptions: burndown("live-progress-console"),
  ProgressOptions: burndown("live-progress-console"),
  Spinner: burndown("live-progress-console"),
  SpinnerData: burndown("live-progress-console"),
  SpinnerOptions: burndown("live-progress-console"),
  StatusOptions: burndown("live-progress-console"),
  TaskOptions: burndown("live-progress-console"),
  TaskUpdateOptions: burndown("live-progress-console"),
  TracebackOptions: burndown("live-progress-console"),
};
