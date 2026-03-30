# Doc Spec: Console

The Console doc is the central reference for how output is produced. It covers construction, all print-path options, and the output targets. Everything else (styles, renderables) links back here.

## Sections

### Construction and sharing

Explain that most applications need one Console instance and show the pattern of creating it once and importing it elsewhere. State that Console auto-detects terminal capabilities.

### Auto-detected attributes

Document the properties that Console exposes automatically:
- Terminal dimensions (width × height), noting they reflect live terminal size
- Output encoding
- Whether output is going to a real terminal
- Detected color system name

### Color systems

Enumerate the supported color systems with the number of colors each supports:
- None (no color)
- Standard (16 colors: 8 + bright variants)
- 256 (standard + 240-color palette)
- Truecolor (16.7 million)
- Windows legacy (8 colors)

Explain auto-detection and the warning: setting a higher color system than the terminal supports can produce unreadable output. Colors are automatically downgraded when needed.

### Printing

Describe `print()` as the primary output method. Cover:
- Accepts strings, renderable objects, and arbitrary values (converted via string coercion)
- Strings are processed for markup and auto-highlighted by default
- Renderable objects have their render method called
- Word-wraps to terminal width

#### Style argument
Show applying a style to an entire print call.

#### Markup in strings
Show inline markup in the string itself. Cross-reference the Markup doc.

#### Justify
Explain the five modes: `default`, `left`, `center`, `right`, `full`. Distinguish `default` from `left` (default does not pad with trailing spaces; the difference is visible when a background color is set).

#### Overflow
Explain what overflow is (text too wide for available space). Enumerate the four modes:
- `fold` — wrap to next line (default)
- `crop` — truncate at line end
- `ellipsis` — truncate with `…`
- `ignore` — allow overflow (only visibly different from crop when `crop=false`)

Show a code example that demonstrates all three visible modes side by side.

#### Soft wrapping
Explain `softWrap: true` disables word-wrapping, mirroring built-in print behavior. Note that it also disables cropping automatically.

#### Cropping
Explain the `crop` argument. Default is true. Mention it is disabled automatically when `softWrap` is set.

### Logging

Describe `log()` as `print()` plus:
- Timestamp column on the left
- File and line location column on the right

Show a minimal example. Mention the `logLocals` option which displays a table of local variables.

### JSON output

Show `printJson()` for pretty-printing a JSON string with syntax highlighting. Mention passing an object directly as an alternative.

### Low-level output

Describe `out()` as a lower-level method: converts to strings, no pretty printing, no word wrap, no markup — but can apply a style and optionally highlight.

### Rules

Describe `rule()` for drawing a horizontal dividing line with an optional title. Show the `style` and `align` options.

### Status

Describe `status()` displaying a spinner animation with a message that doesn't interfere with other output. Show usage as a handle (start/stop) and mention the `spinner` option.

### Console style

Explain the base `style` option on the constructor that applies to all output.

### Input

Describe `input()` for reading a line from the user, where the prompt can contain markup and emoji.

### Exporting

Explain the `record: true` constructor option that captures output for later export. Document:
- `exportText()` — plain text
- `exportHtml()` — HTML with inline styles
- `exportSvg()` — SVG image (width matches terminal width; height scales to content)
- `saveText()`, `saveHtml()`, `saveSvg()` — write directly to file

For SVG: note that the theme can be customized, and explain the `clear` option that controls whether the buffer is flushed after export.

### Error / stderr output

Show `stderr: true` on the constructor for writing to stderr. Suggest combining with a red style for visual distinction.

### File output

Show the `file` option for writing to any writable stream. Note that when writing to files, explicitly setting `width` is recommended to avoid wrapping to the current terminal width.

### Capturing output

Show two patterns for capturing what would have been printed:
1. A capture context object with a `get()` method
2. Passing a string buffer as the `file` option (recommended for tests)

### Paging

Describe `pager()` for sending long output to the system pager. Note that most pagers don't support color (Rich strips it by default), but `styles: true` can be passed if the pager is known to support it. Mention the `MANPAGER`/`PAGER` environment variables.

### Alternate screen

Describe `screen()` for entering fullscreen mode. Show `screen.update(renderable)` for replacing content. Note the screen restores on exit. Cross-reference Live for more powerful full-screen use.

### Terminal detection

Explain that Rich strips control codes when not writing to a terminal. Describe `forceTerminal: true` to override. Explain `forceInteractive` to control animations independently of terminal detection.

### Environment variables

Document:
- `TERM=dumb` or `TERM=unknown` — disable color/style
- `FORCE_COLOR` — enable color regardless of TERM
- `NO_COLOR` — disable all color (takes precedence over FORCE_COLOR; note: removes color only, text attributes like bold/italic are preserved)
- `COLUMNS` / `LINES` — override terminal dimensions

## Constraints

- All examples must be self-contained snippets
- Do not describe internal rendering mechanics (Segment, Style internals)
- The justify example must visually show the difference between `default` and `left` — this is a common source of confusion
