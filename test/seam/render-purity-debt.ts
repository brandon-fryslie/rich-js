/*
 * Every writable location `./render-purity.ts` finds today, grouped by the
 * declaration that holds it, and where each is going: into a `State`
 * (`"state"`, state that changes after construction, often because Rich's API
 * mutates it — `Table.addRow`, `Tree.add`), into a `Memo` (`"memo"`, a cache
 * a render fills), or to a readonly type (`"readonly"`, a value nothing writes
 * once it is built). Draining it is rich-protocol-9xcs's work: caches first
 * (rich-protocol-9xcs.5ar), then the rest (rich-protocol-9xcs.g0k, .399,
 * .o76).
 *
 * Shrink-only. `test/seam/render-purity.test.ts` fails on a location no row
 * names, and on a name that no longer reports — so a row is deleted, never
 * left behind, when its location is fixed. A new location does not belong
 * here: write it as a `State`, a `Memo` or a readonly type instead.
 */

export interface DebtRow {
  /** `<file> <Owner>`: the file, and the class, interface or `module` that declares the locations. */
  readonly at: string;
  /** The locations under `at`, as the gate names them after `<Owner>.`. */
  readonly names: readonly string[];
  readonly becomes: "state" | "memo" | "readonly";
  readonly why: string;
}

const TABLE = "a lookup table built once at module scope and never written; typed readonly it says so";

export const RENDER_PURITY_DEBT: readonly DebtRow[] = [
  {
    at: "lib RegExp",
    names: ["lastIndex"],
    becomes: "readonly",
    why: "a held RegExp carries lastIndex, which a global regex's exec writes; hold the pattern so no shared regex keeps a cursor",
  },
  { at: "src/core/ansi.ts module", names: ["BLANK"], becomes: "readonly", why: TABLE },
  { at: "src/core/box.ts ContentChars", names: ["left", "right", "vertical"], becomes: "readonly", why: "a box's glyphs are fixed when the box is built" },
  { at: "src/core/box.ts EdgeChars", names: ["cross", "horizontal", "left", "right"], becomes: "readonly", why: "a box's glyphs are fixed when the box is built" },
  { at: "src/core/box.ts module", names: ["SAFE_SUBSTITUTIONS"], becomes: "readonly", why: TABLE },
  {
    at: "src/core/cells.ts module",
    names: ["lastSegmented", "lastSegmented.segments", "lastSegmented.text", "segmenter"],
    becomes: "memo",
    why: "the last string split into graphemes, and a lazily made Intl.Segmenter: caches a render fills",
  },
  { at: "src/core/color.ts ColorSpec", names: ["downgradeCache"], becomes: "memo", why: "each ColorSpec's downgrades, filled as renders encode it" },
  {
    at: "src/core/color.ts ColorTable",
    names: ["colors", "luminanceCache"],
    becomes: "memo",
    why: "luminanceCache is filled on first use; colors is the table's palette, fixed at construction, and becomes readonly with it",
  },
  {
    at: "src/core/color.ts module",
    names: ["ANSI_COLOR_NAMES", "indexedMemo"],
    becomes: "memo",
    why: "indexedMemo caches nearest-colour matches; ANSI_COLOR_NAMES is a name table, and becomes readonly",
  },
  {
    at: "src/core/console.ts Console",
    names: [
      "_capture", "_file", "_getSize", "_highlight", "_highlighter", "_isTerminal", "_lastLogTime", "_liveRegion",
      "_markup", "_onStyleError", "_record", "_recorded", "_stream", "_style", "_theme",
    ],
    becomes: "state",
    why: "reachable through Live; a Console's settings and its recording change as it is used, between renders",
  },
  { at: "src/core/easing.ts module", names: ["BITS", "DOUBLE"], becomes: "readonly", why: TABLE },
  { at: "src/core/emoji.ts module", names: ["EMOJI"], becomes: "readonly", why: TABLE },
  {
    at: "src/core/highlighter.ts ISO8601Highlighter",
    names: ["baseStyle", "highlights"],
    becomes: "readonly",
    why: "a highlighter class's patterns are its definition, written once",
  },
  { at: "src/core/highlighter.ts JSONHighlighter", names: ["baseStyle", "highlights"], becomes: "readonly", why: "a highlighter class's patterns are its definition, written once" },
  { at: "src/core/highlighter.ts RegexHighlighter", names: ["baseStyle", "highlights"], becomes: "readonly", why: "a highlighter class's patterns are its definition, written once" },
  { at: "src/core/highlighter.ts ReprHighlighter", names: ["baseStyle", "highlights"], becomes: "readonly", why: "a highlighter class's patterns are its definition, written once" },
  { at: "src/core/markup.ts MarkupRegistry", names: ["_handlers"], becomes: "state", why: "markup handlers are registered on the registry as it is configured, before anything is drawn" },
  { at: "src/core/noise.ts module", names: ["P"], becomes: "readonly", why: "Perlin's permutation table, built once" },
  { at: "src/core/oklch.ts Oklch", names: ["#lab"], becomes: "memo", why: "the OKLab form, computed on first read" },
  { at: "src/core/pretty.ts Pretty", names: ["cutStrings"], becomes: "memo", why: "a cache of cut strings a render fills" },
  {
    at: "src/core/segment.ts Segment",
    names: ["_line", "control", "splitRows.carriers", "splitRows.lines"],
    becomes: "readonly",
    why: "a segment's control codes and splitRows' result are values; _line is a lazily made shared line, and becomes a memo",
  },
  { at: "src/core/spinnerData.ts module", names: ["SPINNERS"], becomes: "readonly", why: TABLE },
  {
    at: "src/core/style.ts module",
    names: ["ATTRIBUTE_SET", "ATTRIBUTE_SHORT_ALIASES", "DEFAULT_STYLES", "FOREGROUND_WORDS"],
    becomes: "readonly",
    why: TABLE,
  },
  { at: "src/core/style.ts Style", names: ["meta"], becomes: "readonly", why: "a Style is immutable; its meta is fixed with it" },
  { at: "src/core/style.ts Theme", names: ["styles"], becomes: "readonly", why: "a Theme's styles are fixed when it is built" },
  {
    at: "src/core/text.ts RichText",
    names: ["_end", "_justify", "_noWrap", "_overflow", "_spans", "_style", "_tabSize", "_text"],
    becomes: "state",
    why: "Rich's Text API mutates a text in place (append, stylize, highlight)",
  },
  {
    at: "src/host/input.ts module",
    names: ["CSI_LETTER_KEYS", "CSI_TILDE_KEYS", "EMPTY_BYTES", "SINGLE_BYTE_KEYS", "SS3_KEYS"],
    becomes: "readonly",
    why: TABLE,
  },
  { at: "src/node/traceback.ts module", names: ["installed"], becomes: "state", why: "whether the process handler is installed, set once by installTraceback" },
  { at: "src/renderables/columns.ts Columns", names: ["padding", "renderables"], becomes: "state", why: "Rich's Columns.add appends a renderable after construction" },
  { at: "src/renderables/effect.ts module", names: ["MOVED"], becomes: "readonly", why: TABLE },
  {
    at: "src/renderables/effects.ts module",
    names: [
      "DISSOLVE_SHAPE.depth", "DISSOLVE_SHAPE.from", "DISSOLVE_SHAPE.late", "DISSOLVE_SHAPE.maskFrom",
      "DISSOLVE_SHAPE.maskTo", "DISSOLVE_SHAPE.to", "EFFECT_CURVES.ease", "EFFECT_CURVES.swing", "measuredMemo", "STRENGTHS",
    ],
    becomes: "readonly",
    why: "the effect catalogue's constants; measuredMemo is a cache a render fills, and becomes a memo",
  },
  { at: "src/renderables/embed.ts EmbeddedText", names: ["_readings"], becomes: "memo", why: "each reading of the embedded text, filled as it is drawn" },
  { at: "src/renderables/flexStrip.ts RenderedBlock", names: ["segments", "width"], becomes: "readonly", why: "a block drawn once and placed" },
  { at: "src/renderables/glyph-effects.ts module", names: ["SCRAMBLE_GLYPHS"], becomes: "readonly", why: TABLE },
  { at: "src/renderables/group.ts Group", names: ["renderables"], becomes: "readonly", why: "a Group's contents are fixed when it is built" },
  {
    at: "src/renderables/layout.ts Layout",
    names: ["_children", "_minimumSize", "_ratio", "_renderable", "_size", "_splitDirection", "name", "visible"],
    becomes: "state",
    why: "Rich's Layout API splits, updates and hides a layout after construction",
  },
  {
    at: "src/renderables/live.ts Live",
    names: ["_autoRefresh", "_console", "_held", "_timeline", "_transient", "_verticalOverflow", "_view", "_waking"],
    becomes: "state",
    why: "a Live is a host: update and its frame scheduling change it between frames",
  },
  {
    at: "src/renderables/markdown-parse.ts Inline",
    names: ["alt", "children", "code", "content", "kind", "src", "tag", "text", "url"],
    becomes: "readonly",
    why: "a parsed token, written only while parsing",
  },
  {
    at: "src/renderables/markdown-parse.ts MdToken",
    names: ["children", "code", "columns", "items", "level", "rows", "start", "text", "type"],
    becomes: "readonly",
    why: "a parsed token, written only while parsing",
  },
  { at: "src/renderables/markdown-parse.ts module", names: ["BLOCK_STARTS", "STEP_STOPS"], becomes: "readonly", why: TABLE },
  { at: "src/renderables/markdown-url.ts module", names: ["RECODE_HOSTNAME_FOR", "SLASHED_PROTOCOL"], becomes: "readonly", why: TABLE },
  { at: "src/renderables/markdown.ts Step", names: ["image", "kind", "newLine", "token"], becomes: "readonly", why: "one step of a parsed document, fixed once parsed" },
  { at: "src/renderables/progress.ts Progress", names: ["_columns", "_nextId", "_tasks"], becomes: "state", why: "Rich's Progress adds and updates tasks between frames" },
  { at: "src/renderables/progress.ts SpinnerColumn", names: ["_finishedText"], becomes: "state", why: "set through the column's API after construction" },
  {
    at: "src/renderables/progress.ts Task",
    names: ["completed", "description", "fill", "id", "startTime", "total", "visible"],
    becomes: "state",
    why: "a task advances as Progress.update and advance are called",
  },
  { at: "src/renderables/progress.ts TaskState", names: ["finishedAt", "samples"], becomes: "state", why: "a task's timing samples, recorded as it advances" },
  { at: "src/renderables/progressBar.ts module", names: ["PULSE_CURVE.seconds"], becomes: "readonly", why: TABLE },
  { at: "src/renderables/progressBar.ts ProgressBar", names: ["completed", "finished", "total"], becomes: "state", why: "Rich's ProgressBar.update sets them after construction" },
  { at: "src/renderables/spinner.ts Spinner", names: ["text"], becomes: "state", why: "Rich's Spinner.update sets the text after construction" },
  {
    at: "src/renderables/syntax.ts module",
    names: ["GRAMMARS.bash", "GRAMMARS.javascript", "GRAMMARS.python", "GRAMMARS.text", "GRAMMARS.typescript", "JAVASCRIPT"],
    becomes: "readonly",
    why: TABLE,
  },
  { at: "src/renderables/syntax.ts Syntax", names: ["_lines", "highlightLines", "lineRange"], becomes: "readonly", why: "fixed when the Syntax is built" },
  {
    at: "src/renderables/table.ts Column",
    names: [
      "_cells", "_footer", "_header", "footerStyle", "headerStyle", "highlight", "justify", "maxWidth", "minWidth",
      "noWrap", "overflow", "ratio", "style", "width",
    ],
    becomes: "state",
    why: "Rich's Table.addRow appends to every column's cells",
  },
  {
    at: "src/renderables/table.ts ColumnOptions",
    names: ["footer", "footerStyle", "header", "headerStyle", "highlight", "justify", "maxWidth", "minWidth", "noWrap", "overflow", "ratio", "style", "width"],
    becomes: "readonly",
    why: "options a caller hands in, never written",
  },
  {
    at: "src/renderables/table.ts Table",
    names: ["_columns", "_rows", "_rows.cells", "_rows.endSection", "padding", "rowStyles"],
    becomes: "state",
    why: "Rich's Table.addColumn and addRow grow it after construction",
  },
  { at: "src/renderables/traceback.ts Caught", names: ["frames", "message", "name"], becomes: "readonly", why: "an error as it was caught" },
  { at: "src/renderables/traceback.ts StackFrame", names: ["function", "line", "location"], becomes: "readonly", why: "one parsed frame" },
  { at: "src/renderables/traceback.ts Traceback", names: ["suppress"], becomes: "readonly", why: "fixed when the Traceback is built" },
  { at: "src/renderables/tree.ts Tree", names: ["children", "expanded"], becomes: "state", why: "Rich's Tree.add grows it after construction" },
  {
    at: "src/renderables/viewport.ts Viewport",
    names: ["_extent", "_followed", "_followed.end", "_followed.rows", "_followed.start", "_moves", "_offset", "content"],
    becomes: "state",
    why: "the scroll position, committed in render today; rich-protocol-9xcs.399 moves the commit between frames",
  },
  {
    at: "src/template-bindings/color-funcs.ts module",
    names: [
      "MIX_RANGE.max", "MIX_RANGE.min", "MIX_RANGE.note", "OKLCH_AXIS_FUNCS.chromaScale", "OKLCH_AXIS_FUNCS.hueShift",
      "OKLCH_AXIS_FUNCS.lightnessScale", "OKLCH_AXIS_FUNCS.lightnessShift", "RATIO_RANGE.max", "RATIO_RANGE.min", "RATIO_RANGE.note",
    ],
    becomes: "readonly",
    why: TABLE,
  },
  { at: "src/themes/registry.ts module", names: ["cache"], becomes: "memo", why: "themes built on first lookup" },
  { at: "src/widgets/slider.ts Slider", names: ["_dragging"], becomes: "state", why: "set by pointer events" },
  {
    at: "src/widgets/text-input.ts TextInput",
    names: ["_drawn", "_killBuffer", "_preferredColumn", "_scrollStart", "_singleLineViewportStart", "_visualRows"],
    becomes: "state",
    why: "edit and scroll state, part of it committed in render today; rich-protocol-9xcs.o76 moves that commit to the host",
  },
  { at: "src/widgets/widget-base.ts WidgetBase", names: ["changeHandlers", "submitHandlers"], becomes: "state", why: "subscriptions added by on…() between frames" },
];
