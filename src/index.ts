// Core primitives
export {
  cellLen,
  setCellSize,
  splitText,
  chopCells,
  cellFit,
  asCellCol,
  asCodePoint,
} from "./core/cells.js";
export type { CellCol, CodeUnit, CodePoint } from "./core/cells.js";

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
  ANSI_COLOR_NAMES,
} from "./core/color.js";
export type { DetectColorOptions } from "./core/color.js";

// Perceptually-uniform color space (manipulation, transposition).
export {
  Oklch,
  IDENTITY,
  INVERT_LIGHTNESS,
  isIdentityKey,
} from "./core/oklch.js";
export type { ThemeKey } from "./core/oklch.js";

// Themes — semantic palettes (distinct from ColorTable quantization LUTs)
export { Palette } from "./themes/palette.js";
// The one checkpoint turning an author-written colour string — a palette
// variable name or a `#RRGGBB` literal — into a colour. [LAW:parse-dont-validate]
export {
  resolveColorRef,
  parseHexColor,
  ColorRefError,
  HEX_COLOR_RE,
} from "./themes/colorRef.js";
export { buildPalette } from "./themes/buildPalette.js";
export type { BaseColors } from "./themes/buildPalette.js";
export {
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
  NORD,
  GRUVBOX,
  DRACULA,
  TOKYO_NIGHT,
  FLEXOKI,
  CYBERPUNK,
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
  TEXTUAL_DARK,
  TEXTUAL_LIGHT,
  TEXTUAL_ANSI,
} from "./themes/terminalThemes.js";
export { getThemePalette, listThemePalettes } from "./themes/registry.js";
export type { ThemeName } from "./themes/registry.js";
export {
  transposePalette,
  themeKeyForRoot,
  isAnchored,
  ANCHORED_ROOTS,
} from "./themes/transpose.js";
// WCAG contrast toolkit — accessibility-aware color for styled output.
// `ensureContrast` keeps a color's hue and only slides its OKLCH lightness to
// meet the ratio, so themed text stays themed; `contrastFor` picks black/white
// from scratch when there is no color to preserve.
// `lighten`/`darken` slide a color's HSL lightness by whole "levels" (each
// level ≈ 10%), returning a new ColorRgba — the relative transform a consumer
// reaches for to tint a resolved color against itself (e.g. a focused-while-open
// menu cell lightening its inherited background) without re-deriving from a
// palette name. Negative levels invert (lighten(c,-n) === darken(c,n)).
export {
  lighten,
  darken,
  relativeLuminance,
  contrastRatio,
  contrastFor,
  ensureContrast,
} from "./themes/colorMath.js";

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
  withCellWidth,
} from "./core/protocol.js";
export type {
  RenderOptions,
  Renderable,
  Measurable,
} from "./core/protocol.js";
export type { Unsubscribe } from "./core/subscription.js";

// Measurement
export { Measurement, measureRenderables } from "./core/measure.js";

// Text
export { Span, RichText } from "./core/text.js";
export type { RichTextOptions } from "./core/text.js";

// Strip + Joiner
export {
  Strip,
  PowerlineJoiner,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
} from "./core/strip.js";
export type {
  StyledRenderable,
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
export { MarkupError, escape as escapeMarkup } from "./core/markup.js";

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
export type {
  ConsoleOptions,
  ConsoleSink,
  ConsoleStream,
  ConsoleEnvironment,
  PrintOptions,
} from "./core/console.js";

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
export type { PromptInput, PromptOptions } from "./renderables/prompt.js";
export { Traceback } from "./renderables/traceback.js";
export type { TracebackOptions } from "./renderables/traceback.js";
export { Syntax } from "./renderables/syntax.js";
export type { SyntaxOptions } from "./renderables/syntax.js";
export { Markdown } from "./renderables/markdown.js";
export type { MarkdownOptions } from "./renderables/markdown.js";
export { Layout } from "./renderables/layout.js";
export type { LayoutOptions } from "./renderables/layout.js";

// The barrel stops at `renderables/`, and the two subsystems above it are reached
// through their own `package.json#exports` subpaths instead:
//
//   `@promptctl/rich-js/widgets`            — the interactive layer  (pulls in `mobx`)
//   `@promptctl/rich-js/template-bindings`  — the styling vocabulary (pulls in
//                                             `@promptctl/go-template-js`)
//
// `@promptctl/rich-js/host` is a third subpath but a different kind of thing: the
// terminal seam has no third-party dependency at all, and sits on its own subpath
// because it is what a *non*-interactive program reaches for. Folding it into either
// neighbour is what the split was undoing — inside `widgets/` it charged mobx to
// consumers who only wanted to write bytes; in this barrel it would put an I/O
// capability in front of consumers who never touch a terminal directly.
//
// `export … from` is a static edge, so anything named here is *evaluated* by every
// consumer, including one that only wanted a Table. Re-exporting the two subsystems
// therefore charged their dependencies to the whole package — mobx and, transitively,
// @noble/hashes. The subpaths make that cost something a consumer opts into, the same
// bargain `src/node/` strikes for Node built-ins.
//
// This is also why there is no widget list here to keep in sync: `src/widgets/index.ts`
// is that list, and a copy of it in this file would be a second one to drift from.
