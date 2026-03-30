// Core primitives
export { cellLen, setCellSize, splitText, chopCells } from "./core/cells.js";

export {
  ColorTriplet,
  Palette,
  ColorType,
  ColorSystem,
  Color,
  ColorParseError,
  TerminalTheme,
  parseRgbHex,
  blendRgb,
  STANDARD_PALETTE,
  EIGHT_BIT_PALETTE,
  WINDOWS_PALETTE,
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
  ANSI_COLOR_NAMES,
} from "./core/color.js";

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

// Emoji
export { EMOJI, emojiReplace, Emoji, NoEmoji } from "./core/emoji.js";

// Markup
export {
  Tag,
  MarkupError,
  escape as escapeMarkup,
  render as renderMarkup,
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
