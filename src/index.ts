// Core primitives
export { cellLen, setCellSize, splitText, chopCells } from "./core/cells.js";

export {
  ColorRgba,
  ColorTable,
  ColorDepth,
  ColorSpec,
  ColorParseError,
  TerminalTheme,
  parseRgbHex,
  parseRgbaHex,
  blendRgb,
  resolveColorSystem,
  detectColorSystem,
  STANDARD_TABLE,
  EIGHT_BIT_TABLE,
  WINDOWS_TABLE,
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
  NORD,
  GRUVBOX,
  DRACULA,
  TOKYO_NIGHT,
  FLEXOKI,
  CATPPUCCIN_MOCHA,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_FRAPPE,
  CATPPUCCIN_MACCHIATO,
  SOLARIZED_DARK,
  SOLARIZED_LIGHT,
  ROSE_PINE,
  ROSE_PINE_MOON,
  ROSE_PINE_DAWN,
  ATOM_ONE_DARK,
  ATOM_ONE_LIGHT,
  ANSI_COLOR_NAMES,
} from "./core/color.js";
export type { DetectColorOptions } from "./core/color.js";

// Themes — semantic palettes (distinct from ColorTable quantization LUTs)
export { Palette } from "./themes/palette.js";
export { PaletteResolver } from "./themes/paletteResolver.js";
export type { ResolveContext } from "./themes/paletteResolver.js";
export { buildPalette } from "./themes/buildPalette.js";
export type { BaseColors } from "./themes/buildPalette.js";

export {
  Style,
  StyleSyntaxError,
  StyleStack,
  Theme,
  NULL_STYLE,
  DEFAULT_STYLES,
} from "./core/style.js";
export type { StyleOptions } from "./core/style.js";

export {
  Segment,
  ControlType,
} from "./core/segment.js";
export type { ControlCode } from "./core/segment.js";

export { Box } from "./core/box.js";
export type { BoxChars, RowLevel, SubstituteOptions } from "./core/box.js";
export {
  ASCII,
  ASCII2,
  ASCII_DOUBLE_HEAD,
  SQUARE,
  SQUARE_DOUBLE_HEAD,
  MINIMAL,
  MINIMAL_HEAVY_HEAD,
  MINIMAL_DOUBLE_HEAD,
  SIMPLE,
  SIMPLE_HEAD,
  SIMPLE_HEAVY,
  HORIZONTALS,
  ROUNDED,
  HEAVY,
  HEAVY_EDGE,
  HEAVY_HEAD,
  DOUBLE,
  DOUBLE_EDGE,
  MARKDOWN,
} from "./core/box.js";

// Protocol
export {
  isRenderable,
  isMeasurable,
} from "./core/protocol.js";
export type {
  RenderOptions,
  Renderable,
  Measurable,
} from "./core/protocol.js";

// Measurement
export { Measurement, measureRenderables } from "./core/measure.js";

// Text
export { Span, RichText } from "./core/text.js";
export type { RichTextOptions } from "./core/text.js";

// Strip + Joiner
export {
  Strip,
  StripCell,
  PowerlineJoiner,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
} from "./core/strip.js";
export type {
  StyledRenderable,
  StripCellPart,
  Joiner,
  PowerlineJoinerOptions,
  CapsuleJoinerOptions,
  PlainJoinerOptions,
  GradientJoinerOptions,
} from "./core/strip.js";

// renderToString — stateless one-shot emission
export {
  renderToString,
  segmentToString,
  segmentsToString,
} from "./core/render.js";
export type { RenderToStringOptions } from "./core/render.js";

// Markup plugin tags
export {
  MarkupRegistry,
  globalMarkupRegistry,
  registerMarkupTag,
  unregisterMarkupTag,
  renderMarkup,
} from "./core/markup.js";
export type {
  MarkupTagContext,
  MarkupTagHandler,
  RenderMarkupOptions,
} from "./core/markup.js";

// Emoji
export { EMOJI, emojiReplace, Emoji, NoEmoji } from "./core/emoji.js";

// Markup
export {
  Tag,
  MarkupError,
  escape as escapeMarkup,
} from "./core/markup.js";

// Highlighter
export {
  Highlighter,
  NullHighlighter,
  RegexHighlighter,
  ReprHighlighter,
  JSONHighlighter,
  ISO8601Highlighter,
} from "./core/highlighter.js";

// Spinner data
export { SPINNERS, DEFAULT_SPINNER } from "./core/spinnerData.js";
export type { SpinnerData } from "./core/spinnerData.js";

// Console
export { Console } from "./core/console.js";
export type { ConsoleOptions, PrintOptions } from "./core/console.js";

// Renderables
export { Constrain } from "./renderables/constrain.js";
export { Align } from "./renderables/align.js";
export type { Alignment } from "./renderables/align.js";
export { Padding } from "./renderables/padding.js";
export type { PaddingDimensions } from "./renderables/padding.js";
export { Rule } from "./renderables/rule.js";
export type { RuleAlign, RuleOptions } from "./renderables/rule.js";
export { Panel } from "./renderables/panel.js";
export type { PanelOptions } from "./renderables/panel.js";
export { Group } from "./renderables/group.js";
export { ProgressBar } from "./renderables/progressBar.js";
export type { ProgressBarOptions } from "./renderables/progressBar.js";
export { Spinner } from "./renderables/spinner.js";
export type { SpinnerOptions } from "./renderables/spinner.js";
export { Table, Column } from "./renderables/table.js";
export type { TableOptions, ColumnOptions } from "./renderables/table.js";
export { Tree } from "./renderables/tree.js";
export type { TreeOptions } from "./renderables/tree.js";
export { JSONRenderable } from "./renderables/json.js";
export type { JSONOptions } from "./renderables/json.js";
export { Pretty } from "./renderables/pretty.js";
export type { PrettyOptions } from "./renderables/pretty.js";
export { Columns } from "./renderables/columns.js";
export type { ColumnsOptions } from "./renderables/columns.js";
export { FlexStrip } from "./renderables/flexStrip.js";
export type { FlexStripOptions, FlexAlign } from "./renderables/flexStrip.js";
export { Live } from "./renderables/live.js";
export type { LiveOptions } from "./renderables/live.js";
export { Status } from "./renderables/status.js";
export type { StatusOptions } from "./renderables/status.js";
export {
  Progress,
  TextColumn,
  BarColumn,
  TaskProgressColumn,
  TimeRemainingColumn,
  TimeElapsedColumn,
  SpinnerColumn,
  MofNCompleteColumn,
  track,
} from "./renderables/progress.js";
export type { ProgressOptions, TaskOptions, TaskUpdateOptions } from "./renderables/progress.js";
export { Prompt, IntPrompt, FloatPrompt, Confirm } from "./renderables/prompt.js";
export { Traceback } from "./renderables/traceback.js";
export type { TracebackOptions } from "./renderables/traceback.js";
export { Syntax } from "./renderables/syntax.js";
export type { SyntaxOptions } from "./renderables/syntax.js";
export { Markdown } from "./renderables/markdown.js";
export type { MarkdownOptions } from "./renderables/markdown.js";
export { Layout } from "./renderables/layout.js";
export type { LayoutOptions } from "./renderables/layout.js";

// Interactive widgets
export type {
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
  WidgetBounds,
  InteractiveWidget,
  FocusManager,
  Screen,
  Unsubscribe,
} from "./widgets/types.js";
export { WidgetBase } from "./widgets/widget-base.js";
export { DefaultFocusManager } from "./widgets/focus-manager.js";
export { DefaultScreen } from "./widgets/screen.js";
export type { ScreenOptions, ColorSystemSpec } from "./widgets/screen.js";
export { Button } from "./widgets/button.js";
export type { ButtonVariant, ButtonOptions } from "./widgets/button.js";
