# Doc Spec: Introduction

The introduction page is the entry point for new users. It must answer "what is this, why should I use it, and how do I start" in under five minutes of reading.

## Sections

### What is it

A one-paragraph description: a library for rich text and beautiful formatting in the terminal. Name the headline features (color, styles, tables, progress bars, markdown, syntax highlighting, tracebacks). Describe the two use cases: making CLI output visually appealing, and debugging aid via pretty-printing and highlighting.

### Compatibility

- Supported platforms: Linux, macOS, Windows
- Minimum runtime version
- Notes on color support differences across terminals/platforms

### Installation

The `npm install` command. Nothing else needed here.

### Quick start

Show the fastest path to useful output — a single import and a `print` call with markup and a plain object. Show the output (as a code block, since we have no screenshots). The reader must be able to copy-paste and run this in under 30 seconds.

### Using the console

Brief intro to the `Console` class as the main entry point for more control. One or two sentence description, then point to the full Console doc page.

### What comes next

A short sentence directing the reader to continue through the docs. No bullet list of every feature.

## Constraints

- Do not enumerate every feature — the README covers that
- Do not explain options or configuration — those belong in the Console doc
- The quick-start example must work without any setup beyond installation
