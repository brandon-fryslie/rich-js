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
  Alignment: { reason: "renderables: Alignment type alias" },
  Box: { reason: "renderables: Box class (instances are referenced; the class isn't named)" },
  BoxChars: { reason: "renderables: BoxChars interface" },
  Column: { reason: "renderables: Column class" },
  ColumnOptions: { reason: "renderables: ColumnOptions interface" },
  ColumnsOptions: { reason: "renderables: ColumnsOptions interface" },
  HEAVY_HEAD: { reason: "renderables: HEAVY_HEAD constant" },
  JSONOptions: { reason: "renderables: JSONOptions interface" },
  LayoutOptions: { reason: "renderables: LayoutOptions interface" },
  MarkdownOptions: { reason: "renderables: MarkdownOptions interface" },
  Measurable: { reason: "renderables: Measurable interface" },
  PaddingDimensions: { reason: "renderables: PaddingDimensions type alias" },
  PanelOptions: { reason: "renderables: PanelOptions interface" },
  PrettyOptions: { reason: "renderables: PrettyOptions interface" },
  RowLevel: { reason: "renderables: RowLevel type alias" },
  RuleAlign: { reason: "renderables: RuleAlign type alias" },
  RuleOptions: { reason: "renderables: RuleOptions interface" },
  SubstituteOptions: { reason: "renderables: SubstituteOptions interface" },
  SyntaxOptions: { reason: "renderables: SyntaxOptions interface" },
  TableOptions: { reason: "renderables: TableOptions interface" },
  TreeOptions: { reason: "renderables: TreeOptions interface" },

  // -- from src/widgets/ --
  ButtonOptions: { reason: "widgets: ButtonOptions interface" },
  ButtonVariant: { reason: "widgets: ButtonVariant type alias" },
  CheckboxOptions: { reason: "widgets: CheckboxOptions interface" },
  ColorSystemSpec: { reason: "widgets: ColorSystemSpec type alias" },
  DropdownOptions: { reason: "widgets: DropdownOptions interface" },
  EventRouterOptions: { reason: "widgets: EventRouterOptions interface" },
  FLOW: { reason: "widgets: FLOW constant" },
  FocusManager: { reason: "widgets: FocusManager interface" },
  KeyEvent: { reason: "widgets: KeyEvent class" },
  KeyEventInit: { reason: "widgets: KeyEventInit interface" },
  KeyHandlerOptions: { reason: "widgets: KeyHandlerOptions interface" },
  KeyHandlerPriority: { reason: "widgets: KeyHandlerPriority type alias" },
  OverlayRenderable: { reason: "widgets: OverlayRenderable interface" },
  Placement: { reason: "widgets: Placement type alias" },
  Screen: { reason: "widgets: Screen interface" },
  ScreenOptions: { reason: "widgets: ScreenOptions interface" },
  SliderOptions: { reason: "widgets: SliderOptions interface" },
  StaticItemOptions: { reason: "widgets: StaticItemOptions interface" },
  TextInputOptions: { reason: "widgets: TextInputOptions interface" },
  ToggleOptions: { reason: "widgets: ToggleOptions interface" },
  ToggleVariant: { reason: "widgets: ToggleVariant type alias" },
  Unsubscribe: { reason: "widgets: Unsubscribe type alias" },
  WidgetBase: { reason: "widgets: WidgetBase class" },
  WidgetBounds: { reason: "widgets: WidgetBounds interface" },
  WidgetFocusEvent: { reason: "widgets: WidgetFocusEvent interface" },
  WidgetMouseEvent: { reason: "widgets: WidgetMouseEvent interface" },
  hasOverlay: { reason: "widgets: hasOverlay function" },

  // -- from src/core/ text + markup + cells + segment + highlighter, plus src/template-bindings --
  CapsuleJoinerOptions: { reason: "strip: CapsuleJoinerOptions interface" },
  CellCol: { reason: "cells: CellCol type alias" },
  CodePoint: { reason: "cells: CodePoint type alias" },
  CodeUnit: { reason: "cells: CodeUnit type alias" },
  ControlCode: { reason: "segment: ControlCode type alias" },
  ControlType: { reason: "segment: ControlType enum" },
  FlexAlign: { reason: "flexStrip: FlexAlign type alias" },
  FlexStripOptions: { reason: "flexStrip: FlexStripOptions interface" },
  GradientJoinerOptions: { reason: "strip: GradientJoinerOptions interface" },
  Highlighter: { reason: "highlighter: Highlighter class" },
  JSONHighlighter: { reason: "highlighter: JSONHighlighter class (used transitively; not named at import sites)" },
  Joiner: { reason: "strip: Joiner interface" },
  MarkupTagContext: { reason: "markup: MarkupTagContext interface" },
  MarkupTagHandler: { reason: "markup: MarkupTagHandler type alias" },
  PlainJoinerOptions: { reason: "strip: PlainJoinerOptions interface" },
  PowerlineJoinerOptions: { reason: "strip: PowerlineJoinerOptions interface" },
  RenderMarkupOptions: { reason: "markup: RenderMarkupOptions interface" },
  RenderToStringOptions: { reason: "render: RenderToStringOptions interface" },
  ReprHighlighter: { reason: "highlighter: ReprHighlighter class (used transitively via Pretty)" },
  RichTextOptions: { reason: "text: RichTextOptions interface" },
  Span: { reason: "text: Span class" },
  StripCellPart: { reason: "strip: StripCellPart interface" },
  StyleOptions: { reason: "style: StyleOptions interface" },
  StyledRenderable: { reason: "strip: StyledRenderable interface" },
  Tag: { reason: "markup: Tag class" },
  asCodeUnit: { reason: "cells: asCodeUnit function" },
  cellColToCodeUnitOffset: { reason: "cells: cellColToCodeUnitOffset function" },
  cellFitFrom: { reason: "cells: cellFitFrom function" },
  createRichTextEngine: { reason: "template-bindings: createRichTextEngine function" },
  globalMarkupRegistry: { reason: "markup: globalMarkupRegistry constant" },
  nextCodePoint: { reason: "cells: nextCodePoint function" },
  prevCodePoint: { reason: "cells: prevCodePoint function" },
  registerMarkupTag: { reason: "markup: registerMarkupTag function" },
  renderToString: { reason: "render: renderToString function" },
  segmentToString: { reason: "render: segmentToString function" },
  segmentsToString: { reason: "render: segmentsToString function" },
  unregisterMarkupTag: { reason: "markup: unregisterMarkupTag function" },

  // -- from src/core/console.ts + live/progress/spinner/traceback renderables --
  ConsoleOptions: { reason: "console: ConsoleOptions interface" },
  LiveOptions: { reason: "live: LiveOptions interface" },
  PrintOptions: { reason: "console: PrintOptions interface" },
  ProgressBarOptions: { reason: "progressBar: ProgressBarOptions interface" },
  ProgressOptions: { reason: "progress: ProgressOptions interface" },
  Spinner: { reason: "spinner: Spinner class (used transitively via SpinnerColumn / Status)" },
  SpinnerData: { reason: "spinner: SpinnerData interface" },
  SpinnerOptions: { reason: "spinner: SpinnerOptions interface" },
  StatusOptions: { reason: "status: StatusOptions interface" },
  TaskOptions: { reason: "progress: TaskOptions interface" },
  TaskUpdateOptions: { reason: "progress: TaskUpdateOptions interface" },
  TracebackOptions: { reason: "traceback: TracebackOptions interface" },
};
