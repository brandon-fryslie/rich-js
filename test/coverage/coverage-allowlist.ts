// The allowlist is the only place a public export may be absent from
// `examples/` without breaking the build. Every entry has a real reason.
// [LAW:no-silent-fallbacks]
//
// The verifier rejects (a) entries pointing at no real export (dead) and
// (b) entries already covered by a demo (redundant) — both shapes of
// drift the allowlist itself would otherwise hide.
//
// Each entry today is "not yet referenced by any demo" — a unit of work,
// not a permanent omission. Adding a named import (or named type import)
// for the underlying symbol to any file under `examples/` lets you
// remove the entry; the verifier will reject it as redundant if you
// forget to.
//
// [LAW:one-source-of-truth] Keys are canonical exposed names — see
// `canonicalNameFor()` in `extract.ts`.

export interface AllowlistEntry {
  readonly reason: string;
}

/**
 * Public exports with no current demo reference. Grouped by source-module
 * location for readability; the order has no semantic meaning to the
 * verifier.
 */
export const ALLOWLIST: Readonly<Record<string, AllowlistEntry>> = {
  // -- from src/renderables/ --
  Alignment: { reason: "renderables: Alignment string-literal union" },
  Box: { reason: "renderables: Box class itself (instances are referenced; the class isn't named)" },
  BoxChars: { reason: "renderables: BoxChars interface" },
  Column: { reason: "renderables: Column class" },
  ColumnOptions: { reason: "renderables: ColumnOptions type" },
  ColumnsOptions: { reason: "renderables: ColumnsOptions type" },
  HEAVY_HEAD: { reason: "renderables: HEAVY_HEAD Box constant" },
  JSONOptions: { reason: "renderables: JSONOptions type" },
  LayoutOptions: { reason: "renderables: LayoutOptions type" },
  MarkdownOptions: { reason: "renderables: MarkdownOptions type" },
  Measurable: { reason: "renderables: Measurable interface" },
  PaddingDimensions: { reason: "renderables: PaddingDimensions type" },
  PanelOptions: { reason: "renderables: PanelOptions type" },
  PrettyOptions: { reason: "renderables: PrettyOptions type" },
  RowLevel: { reason: "renderables: RowLevel string-literal union" },
  RuleAlign: { reason: "renderables: RuleAlign string-literal union" },
  RuleOptions: { reason: "renderables: RuleOptions type" },
  SubstituteOptions: { reason: "renderables: SubstituteOptions type" },
  SyntaxOptions: { reason: "renderables: SyntaxOptions type" },
  TableOptions: { reason: "renderables: TableOptions type" },
  TreeOptions: { reason: "renderables: TreeOptions type" },

  // -- from src/widgets/ --
  ButtonOptions: { reason: "widgets: ButtonOptions type" },
  ButtonVariant: { reason: "widgets: ButtonVariant type" },
  CheckboxOptions: { reason: "widgets: CheckboxOptions type" },
  ColorSystemSpec: { reason: "widgets: ColorSystemSpec type" },
  DropdownOptions: { reason: "widgets: DropdownOptions type" },
  EventRouterOptions: { reason: "widgets: EventRouterOptions type" },
  FLOW: { reason: "widgets: FLOW sentinel" },
  FocusManager: { reason: "widgets: FocusManager interface" },
  KeyEvent: { reason: "widgets: KeyEvent type" },
  KeyEventInit: { reason: "widgets: KeyEventInit type" },
  KeyHandlerOptions: { reason: "widgets: KeyHandlerOptions type" },
  KeyHandlerPriority: { reason: "widgets: KeyHandlerPriority type" },
  OverlayRenderable: { reason: "widgets: OverlayRenderable type" },
  Placement: { reason: "widgets: Placement type" },
  Screen: { reason: "widgets: Screen interface" },
  ScreenOptions: { reason: "widgets: ScreenOptions type" },
  SliderOptions: { reason: "widgets: SliderOptions type" },
  StaticItemOptions: { reason: "widgets: StaticItemOptions type" },
  TextInputOptions: { reason: "widgets: TextInputOptions type" },
  ToggleOptions: { reason: "widgets: ToggleOptions type" },
  ToggleVariant: { reason: "widgets: ToggleVariant type" },
  Unsubscribe: { reason: "widgets: Unsubscribe type" },
  WidgetBase: { reason: "widgets: WidgetBase class" },
  WidgetBounds: { reason: "widgets: WidgetBounds type" },
  WidgetFocusEvent: { reason: "widgets: WidgetFocusEvent type" },
  WidgetMouseEvent: { reason: "widgets: WidgetMouseEvent type" },
  hasOverlay: { reason: "widgets: hasOverlay type-guard" },

  // -- from src/core/ text + markup + cells + segment + highlighter, plus src/template-bindings --
  CapsuleJoinerOptions: { reason: "strip: CapsuleJoinerOptions type" },
  CellCol: { reason: "cells: CellCol branded type" },
  CodePoint: { reason: "cells: CodePoint branded type" },
  CodeUnit: { reason: "cells: CodeUnit branded type" },
  ControlCode: { reason: "segment: ControlCode type" },
  ControlType: { reason: "segment: ControlType enum/type" },
  FlexAlign: { reason: "flexStrip: FlexAlign type" },
  FlexStripOptions: { reason: "flexStrip: FlexStripOptions type" },
  GradientJoinerOptions: { reason: "strip: GradientJoinerOptions type" },
  Highlighter: { reason: "highlighter: Highlighter base interface" },
  JSONHighlighter: { reason: "highlighter: JSONHighlighter class (used transitively; not named at import sites)" },
  Joiner: { reason: "strip: Joiner interface" },
  MarkupTagContext: { reason: "markup: MarkupTagContext type" },
  MarkupTagHandler: { reason: "markup: MarkupTagHandler type" },
  PlainJoinerOptions: { reason: "strip: PlainJoinerOptions type" },
  PowerlineJoinerOptions: { reason: "strip: PowerlineJoinerOptions type" },
  RenderMarkupOptions: { reason: "markup: RenderMarkupOptions type" },
  RenderToStringOptions: { reason: "render: RenderToStringOptions type" },
  ReprHighlighter: { reason: "highlighter: ReprHighlighter class (used transitively via Pretty)" },
  RichTextOptions: { reason: "text: RichTextOptions type" },
  Span: { reason: "text: Span class" },
  StripCellPart: { reason: "strip: StripCellPart type" },
  StyleOptions: { reason: "style: StyleOptions type" },
  StyledRenderable: { reason: "strip: StyledRenderable interface" },
  Tag: { reason: "markup: Tag type" },
  asCodeUnit: { reason: "cells: asCodeUnit branding helper" },
  cellColToCodeUnitOffset: { reason: "cells: column-to-offset conversion" },
  cellFitFrom: { reason: "cells: cellFitFrom helper" },
  createRichTextEngine: { reason: "template-bindings: createRichTextEngine factory" },
  globalMarkupRegistry: { reason: "markup: globalMarkupRegistry singleton" },
  nextCodePoint: { reason: "cells: nextCodePoint iterator helper" },
  prevCodePoint: { reason: "cells: prevCodePoint iterator helper" },
  registerMarkupTag: { reason: "markup: registerMarkupTag function" },
  renderToString: { reason: "render: renderToString helper" },
  segmentToString: { reason: "render: segmentToString helper" },
  segmentsToString: { reason: "render: segmentsToString helper" },
  unregisterMarkupTag: { reason: "markup: unregisterMarkupTag function" },

  // -- from src/core/console.ts + live/progress/spinner/traceback renderables --
  ConsoleOptions: { reason: "console: ConsoleOptions type" },
  LiveOptions: { reason: "live: LiveOptions type" },
  PrintOptions: { reason: "console: PrintOptions type" },
  ProgressBarOptions: { reason: "progressBar: ProgressBarOptions type" },
  ProgressOptions: { reason: "progress: ProgressOptions type" },
  Spinner: { reason: "spinner: Spinner class (used transitively via SpinnerColumn / Status)" },
  SpinnerData: { reason: "spinner: SpinnerData type" },
  SpinnerOptions: { reason: "spinner: SpinnerOptions type" },
  StatusOptions: { reason: "status: StatusOptions type" },
  TaskOptions: { reason: "progress: TaskOptions type" },
  TaskUpdateOptions: { reason: "progress: TaskUpdateOptions type" },
  TracebackOptions: { reason: "traceback: TracebackOptions type" },
};
