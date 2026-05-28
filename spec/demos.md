# Spec: Flagship Demos

This spec is the single source of truth for which demos live under
`examples/`, what each demonstrates, and which public exports each owns.
Tickets `rich-demos-l2x.3` through `rich-demos-l2x.7` read this doc directly
and **must not infer scope from elsewhere**. [LAW:one-source-of-truth]

## Why this exists

`examples/` grew organically to twelve demos with overlapping scope: four
theme-ish demos all touched palettes/color, two demos both exercised
widgets, two more were full TUI applications that drifted from "API
demo" toward "general app." Coverage of the public surface was implicit
and unverifiable. The epic `rich-demos-l2x` collapses that sprawl into a
small set of flagship demos with verified full API coverage.

Two constraints shape the design:

1. **Verifier-driven coverage** — the API→demo verifier in
   `test/coverage/coverage.test.ts` derives the public-export set from
   `package.json#exports` and asserts every export is referenced under
   `examples/` (or explicitly allowlisted). "All functionality is
   demoed" is a build, not a vibe. [LAW:verifiable-goals]
2. **One canonical home per capability** — every public export is
   demonstrated in exactly one flagship, the one that owns its domain.
   No capability appears in two demos; folded demos are deleted, not
   shimmed. [LAW:one-source-of-truth] [feedback:no-legacy-code]

## The ownership rule

A public export is owned by the flagship that owns its **source
module**. Source-module ownership is the cleanest theorem the type
system can carry here — it makes every assignment mechanical, removes
case-by-case judgement, and matches the existing tagging in
`test/coverage/coverage-allowlist.ts` exactly (verified at the time of
writing; the build tickets must keep this in sync as they burn the
allowlist down).

```
Flagship                       Owns source modules
─────────────────────────────  ────────────────────────────────────────────
themes-and-color-studio        src/core/color.ts, src/core/oklch.ts,
                               src/themes/**
renderables-gallery            src/core/box.ts, src/core/protocol.ts,
                               src/core/measure.ts,
                               src/renderables/{constrain,align,padding,
                                 rule,panel,group,table,tree,json,pretty,
                                 columns,markdown,syntax,layout}.ts
widgets-playground             src/widgets/**
markup-and-text-lab            src/core/cells.ts, src/core/style.ts,
                               src/core/segment.ts, src/core/text.ts,
                               src/core/strip.ts, src/core/render.ts,
                               src/core/markup.ts, src/core/emoji.ts,
                               src/core/highlighter.ts,
                               src/renderables/flexStrip.ts,
                               src/template-bindings/**
live-progress-console          src/core/console.ts,
                               src/core/spinnerData.ts,
                               src/renderables/{spinner,progress,
                                 progressBar,live,status,prompt,
                                 traceback}.ts
```

Every `src/` module that produces a public export appears above. The
mapping is total and disjoint — every export gets a flagship; no export
gets two. [LAW:types-are-the-program]

## The five flagships

The kebab-case names below are the canonical names; they match the
`Flagship` type in `test/coverage/coverage-allowlist.ts` and must not
drift from it. Adding or renaming a flagship is a scope change to the
parent epic and to that type, atomically.

### themes-and-color-studio

**Domain.** Color spaces (sRGB, OKLCH), the quantization tables that
take true-color down to 256 / 16 / monochrome, terminal themes
(`TerminalTheme` constants), authored palettes (`Palette`,
`PaletteResolver`, spec forms: bare / modifier / alpha / `auto`),
WCAG contrast tooling (`contrastRatio`, `contrastFor`,
`ensureContrast`), perceptual transposition (`transposePalette` +
`themeKeyForRoot` + `ANCHORED_ROOTS`), and the bundled theme registry
(`getThemePalette`, `listThemePalettes`, `THEMES`, `ThemeName`).

**Folds in** (existing demos this flagship absorbs and replaces):
- `rich-themes` — palette walk, semantic var swatches, spec-form
  exerciser.
- `rich-themes-transposed` — light↔dark transposition over OKLCH.
- `rich-theme-designer` — interactive (category × theme × key) picker.
- `rich-colors` — color-math exploration (Oklch, parseRgbaHex,
  relativeLuminance, etc.).

**Owned exports — re-exposed from the main barrel** (`src/index.ts`):
`ColorRgba`, `ColorTable`, `ColorDepth`, `ColorSpec`, `ColorParseError`,
`TerminalTheme`, `parseRgbHex`, `parseRgbaHex`, `blendRgb`,
`resolveColorSystem`, `detectColorSystem`, `STANDARD_TABLE`,
`EIGHT_BIT_TABLE`, `WINDOWS_TABLE`, `ANSI_COLOR_NAMES`,
`DetectColorOptions`,
`Oklch`, `IDENTITY`, `INVERT_LIGHTNESS`, `isIdentityKey`, `ThemeKey`,
`Palette`, `PaletteResolver`, `ResolveContext`, `buildPalette`,
`BaseColors`,
`DEFAULT_TERMINAL_THEME`, `MONOKAI`, `SVG_EXPORT_THEME`, `NORD`,
`GRUVBOX`, `DRACULA`, `TOKYO_NIGHT`, `FLEXOKI`, `CYBERPUNK`,
`CATPPUCCIN_MOCHA`, `CATPPUCCIN_LATTE`, `CATPPUCCIN_FRAPPE`,
`CATPPUCCIN_MACCHIATO`, `SOLARIZED_DARK`, `SOLARIZED_LIGHT`,
`ROSE_PINE`, `ROSE_PINE_MOON`, `ROSE_PINE_DAWN`, `ATOM_ONE_DARK`,
`ATOM_ONE_LIGHT`, `TEXTUAL_DARK`, `TEXTUAL_LIGHT`, `TEXTUAL_ANSI`,
`getThemePalette`, `listThemePalettes`, `ThemeName`,
`transposePalette`, `themeKeyForRoot`, `isAnchored`, `ANCHORED_ROOTS`,
`relativeLuminance`, `contrastRatio`, `contrastFor`, `ensureContrast`.

**Owned exports — re-exposed from the subpath entries** (`./themes/data`,
`./themes/registry`):
`THEMES`, `ThemeName`, `ThemePaletteData`, `getThemePalette`,
`listThemePalettes`, `ThemeBaseColors`, `getThemeBaseColors`.
`ThemeBaseColors` + `getThemeBaseColors` are reachable only via the
`./themes/registry` subpath — they are *not* re-exported from the main
barrel. The verifier deduplicates by origin, so referencing them
through either entry counts once.

**npm script.** `npm run themes-and-color-studio` →
`tsc -p tsconfig.demo.json && node dist-demo/examples/themes-and-color-studio/index.js`.

**Allowlist burn-down.** Build ticket removes every burndown entry
tagged `themes-and-color-studio` from
`test/coverage/coverage-allowlist.ts` — i.e. the block under the
`// -- Themes & Color Studio --` header — as real references land.

### renderables-gallery

**Domain.** Static / one-shot renderables — anything that draws a shape
but does not own a render loop or input. Boxes, the `Renderable` /
`Measurable` protocol, measurement, and every renderable in
`src/renderables/` except those owned by `live-progress-console` or
`markup-and-text-lab`.

**Folds in.**
- The split-layout / tree-sidebar / markdown-and-syntax-preview
  *patterns* from the deleted `claude-sessions` and `rich-explore`
  applications are reused inside this gallery to demonstrate `Layout`,
  `Tree`, `Markdown`, and `Syntax` composed together. The standalone
  apps themselves are deleted (see §Deletions).
- This flagship has no other existing demo to fold in — it is the home
  for the currently-uncovered renderables.

**Owned exports** (from `src/index.ts`):
`Box`, `BoxChars`, `RowLevel`, `SubstituteOptions`, `ASCII`, `ASCII2`,
`ASCII_DOUBLE_HEAD`, `SQUARE`, `SQUARE_DOUBLE_HEAD`, `MINIMAL`,
`MINIMAL_HEAVY_HEAD`, `MINIMAL_DOUBLE_HEAD`, `SIMPLE`, `SIMPLE_HEAD`,
`SIMPLE_HEAVY`, `HORIZONTALS`, `ROUNDED`, `HEAVY`, `HEAVY_EDGE`,
`HEAVY_HEAD`, `DOUBLE`, `DOUBLE_EDGE`, `MARKDOWN`,
`isRenderable`, `isMeasurable`, `RenderOptions`, `Renderable`,
`Measurable`,
`Measurement`, `measureRenderables`,
`Constrain`, `Align`, `Alignment`, `Padding`, `PaddingDimensions`,
`Rule`, `RuleAlign`, `RuleOptions`, `Panel`, `PanelOptions`, `Group`,
`Table`, `Column`, `TableOptions`, `ColumnOptions`, `Tree`,
`TreeOptions`, `JSONRenderable`, `JSONOptions`, `Pretty`,
`PrettyOptions`, `Columns`, `ColumnsOptions`, `Markdown`,
`MarkdownOptions`, `Syntax`, `SyntaxOptions`, `Layout`, `LayoutOptions`.

**npm script.** `npm run renderables-gallery`.

**Allowlist burn-down.** Build ticket removes every burndown entry
tagged `renderables-gallery` from `test/coverage/coverage-allowlist.ts`
— i.e. the block under the `// -- Renderables Gallery --` header.

### widgets-playground

**Domain.** Everything in `src/widgets/`: focusable interactive
controls (Button, Checkbox, Toggle, TextInput, Dropdown, Slider),
static decoration (`StaticItem`, `WidgetBase`), the focus manager, the
screen render loop, the event router that turns stdin into typed
widget events, and every type the host integration needs to wire up
(`Placement`, `WidgetBounds`, `WidgetMouseEvent`, `WidgetFocusEvent`,
`KeyEvent`, `KeyEventInit`, `KeyHandlerPriority`, `KeyHandlerOptions`,
`OverlayRenderable`, `Unsubscribe`, `FLOW`, `hasOverlay`,
`ColorSystemSpec`).

**Folds in.**
- `rich-config` — the canonical interactive widget showcase. Becomes
  the spine of this flagship.
- `dropdown-demo` — three-axis dropdown coverage (short list, long
  list with filter, mutating list). Folds in as a section of the
  playground.

**Owned exports** (from `src/index.ts`):
`KeyEventInit`, `KeyHandlerPriority`, `KeyHandlerOptions`,
`WidgetMouseEvent`, `WidgetFocusEvent`, `WidgetBounds`,
`InteractiveWidget`, `FocusManager`, `Screen`, `MountEntry`,
`Placement`, `Unsubscribe`, `OverlayRenderable`,
`FLOW`, `KeyEvent`, `hasOverlay`,
`StaticItem`, `StaticItemOptions`, `WidgetBase`,
`DefaultFocusManager`, `DefaultScreen`, `ScreenOptions`,
`ColorSystemSpec`,
`Button`, `ButtonVariant`, `ButtonOptions`,
`Checkbox`, `CheckboxOptions`,
`Toggle`, `ToggleVariant`, `ToggleOptions`,
`TextInput`, `TextInputOptions`,
`Dropdown`, `DropdownOptions`,
`Slider`, `SliderOptions`,
`EventRouter`, `EventRouterOptions`.

**npm script.** `npm run widgets-playground`.

**Allowlist burn-down.** Build ticket removes every burndown entry
tagged `widgets-playground` from `test/coverage/coverage-allowlist.ts`
— i.e. the block under the `// -- Widgets Playground --` header.

### markup-and-text-lab

**Domain.** Text primitives end to end: cell-width arithmetic, the
`Style` descriptor, segments, `RichText` + `Span`, the markup parser
and registerable tag plugins, emoji, highlighters, `Strip` cells
joined by `PowerlineJoiner` / `CapsuleJoiner` / `PlainJoiner` /
`GradientJoiner`, the `FlexStrip` flex container, `renderToString`,
and the `@promptctl/go-template-js` template bindings.

**Folds in.**
- `rich-markup-plugins` — `MarkupRegistry` tag-plugin demo (`[click]`,
  `[badge]`).
- `rich-strip` — side-by-side joiner showcase.
- `rich-template-bindings` — interactive template editor + live
  rendered output via `createRichTextEngine`.

**Owned exports — main barrel** (`src/index.ts`):
`cellLen`, `setCellSize`, `splitText`, `chopCells`, `cellFit`,
`cellFitFrom`, `cellColToCodeUnitOffset`, `asCellCol`, `asCodeUnit`,
`asCodePoint`, `nextCodePoint`, `prevCodePoint`,
`CellCol`, `CodeUnit`, `CodePoint`,
`Style`, `StyleSyntaxError`, `StyleStack`, `Theme`, `NULL_STYLE`,
`DEFAULT_STYLES`, `StyleOptions`,
`Segment`, `ControlType`, `ControlCode`,
`Span`, `RichText`, `RichTextOptions`,
`Strip`, `PowerlineJoiner`, `CapsuleJoiner`,
`PlainJoiner`, `GradientJoiner`,
`StyledRenderable`, `Joiner`,
`PowerlineJoinerOptions`, `CapsuleJoinerOptions`,
`PlainJoinerOptions`, `GradientJoinerOptions`,
`renderToString`, `segmentToString`, `segmentsToString`,
`RenderToStringOptions`,
`MarkupRegistry`, `globalMarkupRegistry`, `registerMarkupTag`,
`unregisterMarkupTag`, `renderMarkup`,
`MarkupTagContext`, `MarkupTagHandler`, `RenderMarkupOptions`,
`EMOJI`, `emojiReplace`, `Emoji`, `NoEmoji`,
`Tag`, `MarkupError`, `escapeMarkup` (the public name of `escape`
from `core/markup`),
`Highlighter`, `NullHighlighter`, `RegexHighlighter`, `ReprHighlighter`,
`JSONHighlighter`, `ISO8601Highlighter`,
`FlexStrip`, `FlexStripOptions`, `FlexAlign`.

**Owned exports — subpath entry** (`./template-bindings`):
`createRichTextEngine`, `richTextFuncs`, `paletteFuncs`,
`renderTemplate`.

**npm script.** `npm run markup-and-text-lab`.

**Allowlist burn-down.** Build ticket removes every burndown entry
tagged `markup-and-text-lab` from `test/coverage/coverage-allowlist.ts`
— i.e. the block under the `// -- Markup & Text Lab --` header.

### live-progress-console

**Domain.** The `Console` orchestrator and every renderable that owns
a render loop, a tick, or a transient region of the terminal:
`Live`, `Status`, `Spinner` + `SPINNERS` + `DEFAULT_SPINNER`,
`Progress` (with every column type and `track`), `ProgressBar`,
`Prompt` family, and `Traceback`. Console-only surfaces also live
here: recording (`record` option), `exportText` / `exportHtml`,
`saveText` / `saveHtml`, the logging entry points (`log`, `print`),
and file-stream output via `ConsoleOptions.file`.

**Folds in.**
- `rich-dash` — pluggable dashboard with Live updates. Becomes a
  section of this flagship that exercises `Live`, `Status`, `Progress`,
  and console logging together.

**Owned exports** (`src/index.ts`):
`Console`, `ConsoleOptions`, `PrintOptions`,
`SPINNERS`, `DEFAULT_SPINNER`, `SpinnerData`,
`Spinner`, `SpinnerOptions`,
`ProgressBar`, `ProgressBarOptions`,
`Live`, `LiveOptions`,
`Status`, `StatusOptions`,
`Progress`, `TextColumn`, `BarColumn`, `TaskProgressColumn`,
`TimeRemainingColumn`, `TimeElapsedColumn`, `SpinnerColumn`,
`MofNCompleteColumn`, `track`,
`ProgressOptions`, `TaskOptions`, `TaskUpdateOptions`,
`Prompt`, `IntPrompt`, `FloatPrompt`, `Confirm`,
`Traceback`, `TracebackOptions`.

**npm script.** `npm run live-progress-console`.

**Allowlist burn-down.** Build ticket removes every burndown entry
tagged `live-progress-console` from
`test/coverage/coverage-allowlist.ts` — i.e. the block under the
`// -- Live, Progress & Console --` header.

## Deletions

The following demos are removed when their owning flagship lands.
Their `package.json` scripts are deleted at the same time — no shims,
no aliases. [feedback:no-legacy-code]

```
Existing demo                Fate                                  Owning ticket
───────────────────────────  ────────────────────────────────────  ────────────────────
rich-themes                  folded → themes-and-color-studio      rich-demos-l2x.3
rich-themes-transposed       folded → themes-and-color-studio      rich-demos-l2x.3
rich-theme-designer          folded → themes-and-color-studio      rich-demos-l2x.3
rich-colors                  folded → themes-and-color-studio      rich-demos-l2x.3
rich-config                  folded → widgets-playground           rich-demos-l2x.5
dropdown-demo                folded → widgets-playground           rich-demos-l2x.5
rich-markup-plugins          folded → markup-and-text-lab          rich-demos-l2x.6
rich-strip                   folded → markup-and-text-lab          rich-demos-l2x.6
rich-template-bindings       folded → markup-and-text-lab          rich-demos-l2x.6
rich-dash                    folded → live-progress-console        rich-demos-l2x.7
claude-sessions              deleted (see below)                   rich-demos-l2x.4
rich-explore                 deleted (see below)                   rich-demos-l2x.4
```

`claude-sessions` and `rich-explore` are deleted rather than folded as
applications because they are TUIs whose value lives in the *patterns*
they exercise (split-pane layout, tree-of-files navigation,
markdown/syntax preview) rather than in any specific API surface that
isn't otherwise covered. Those patterns are reused inside the
`renderables-gallery` flagship — same shapes, focused on the
renderables instead of being applications in their own right. Keeping
the standalone apps would push us past the "~5–6 flagships" cap the
epic mandates and would duplicate Layout/Tree/Markdown/Syntax coverage
between the gallery and the apps. [LAW:no-mode-explosion]

`examples/shared/` is a non-demo helper module several flagships use;
the verifier walks all files under `examples/` for references, so
`shared/` survives unchanged.

## How the build tickets consume this spec

Each of `rich-demos-l2x.3` … `rich-demos-l2x.7` is responsible for
exactly one flagship. The ticket carries no scope detail; it points
here. The build cycle for each ticket is:

1. Create `examples/<flagship>/` and an entry that wires the demo
   together. Pick the npm script name from this spec.
2. Demonstrate every export the spec assigns to the flagship. Use the
   declarations from `src/` directly; renamed imports are fine (the
   verifier resolves to the originating symbol). Namespace imports
   (`import * as`) do **not** count as coverage — see
   `collectReferencedOrigins` in `test/coverage/extract.ts`.
3. Delete the folded demos, their directories, and their entries in
   `package.json#scripts`. No shims. [feedback:no-legacy-code]
4. Remove the corresponding flagship block from
   `test/coverage/coverage-allowlist.ts`. The verifier will fail if any
   entry is dead (declaration removed) or redundant (now covered) — so
   you cannot leave stale entries by accident.
5. `npm run lint` clean. Full suite (incl. `coverage.test.ts`) green.

## How coverage stays honest

The verifier (`test/coverage/`) is the mechanical enforcer that this
spec stays true:

- The export set is derived from `package.json#exports` at test-load
  time — never a hand-maintained list. [LAW:one-source-of-truth]
- Coverage is computed per *symbol origin* (declaration file +
  declaration name), so two re-exports of the same declaration count
  as one coverage requirement.
- Allowlist entries are validated three ways: every entry must point at
  a real export (no dead entries); no entry may correspond to an
  export already covered by a demo (no redundant entries); every
  uncovered export must have an entry (no silent gaps).
  [LAW:no-silent-fallbacks]

The `Flagship` type in `test/coverage/coverage-allowlist.ts` is the
typed source of truth for the flagship name set. Adding or renaming a
flagship requires updating that type, this spec, and the parent epic
together — atomically.

## Open notes for build tickets

- The npm script names above are the canonical ones; the build tickets
  should use them verbatim so the demo-site epic (`rich-demo-site-pek`)
  can map them 1:1 without translation.
- Each build ticket is run in a fresh `/next` session
  ([feedback:fresh-session-tickets]). All cross-ticket design is in
  this doc, not in chat history; if you need information that isn't
  here, the doc is incomplete — fix the doc first.
- The verifier's failure modes are exercised end-to-end in
  `test/coverage/coverage.test.ts`: a build ticket that removes an
  allowlist entry without adding a real reference will fail the
  "every uncovered public export is allowlisted" test loudly.
