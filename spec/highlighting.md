# Doc Spec: Highlighting

The highlighting doc explains automatic pattern detection that applies styles to text without the author explicitly marking it up.

## Sections

### What automatic highlighting does

Explain that by default, when printing strings the library recognizes patterns (numbers, strings, booleans, null/None, file paths, URLs, UUIDs) and applies styles to them automatically. No markup needed from the caller.

### Enabling and disabling

Explain that highlighting is on by default. Show how to disable it:
- Per call: `highlight: false` on `print()` / `log()`
- Globally: `highlight: false` on the Console constructor (can still be re-enabled per-call)

### Custom highlighters

Explain that if the built-in highlighting doesn't fit, a custom highlighter can be created.

#### Regex-based highlighter

Show extending the `RegexHighlighter` base class by providing:
- A list of regular expressions with named groups
- A `baseStyle` prefix

Explain that named capture groups become style names (prefixed with `baseStyle`). Show wiring the highlighter to a Theme and to the Console. Show using the highlighter both as a Console-level default and as a one-off callable on a specific string.

#### Custom highlighter from scratch

For complete control, show extending the base `Highlighter` class by implementing a `highlight(text)` method that applies styles directly. Use a simple "rainbow" example (different color per character) to illustrate the method signature.

### Built-in highlighters

List the available built-in highlighter classes beyond the default:
- `ISO8601Highlighter` — highlights ISO 8601 date/time strings
- `JSONHighlighter` — highlights JSON-formatted strings
- `ReprHighlighter` — default; highlights common repr patterns

## Constraints

- Do not describe how styles are applied internally to Text spans
- The regex highlighter example should show both: setting it on Console (global) and using it as a callable (per-value) — both patterns are common
