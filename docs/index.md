---
layout: home

hero:
  name: "rich-js"
  text: "Beautiful terminal output"
  tagline: "Color, styles, tables, progress bars, markdown, and syntax highlighting for TypeScript CLIs."
  actions:
    - theme: brand
      text: Get Started →
      link: /introduction
    - theme: alt
      text: Console API
      link: /console

features:
  - icon: 🎨
    title: Styles & Color
    details: Apply any combination of color, bold, italic, underline, links, and backgrounds with a simple string syntax. Supports truecolor, 256-color, 16-color, and auto-downgrades.
    link: /style
    linkText: Learn about styles

  - icon: 🏷️
    title: Inline Markup
    details: Embed bbcode-inspired tags directly in strings — [bold red]no extra objects needed[/bold red]. Works in print, log, table cells, panel titles, and anywhere else a string is accepted.
    link: /markup
    linkText: Learn about markup

  - icon: 📊
    title: Tables
    details: Unicode box-drawing tables with automatic column sizing, borders, zebra stripes, nested renderables, and a grid mode for flexible terminal layouts.
    link: /tables
    linkText: Learn about tables

  - icon: ⏳
    title: Progress Bars
    details: Flicker-free multi-task progress bars with percentages, time estimates, spinners, and custom columns. Wrap any iterable with track() for instant progress.
    link: /progress
    linkText: Learn about progress

  - icon: ✨
    title: Syntax Highlighting
    details: Render source code with language-specific highlighting, line numbers, and custom themes. Load directly from a file path with auto-detected language.
    link: /syntax
    linkText: Learn about syntax

  - icon: 🌲
    title: Tree View
    details: Display hierarchical data — file systems, dependency graphs, nested structures — with Unicode guide lines. Any renderable can be a tree node label.
    link: /tree
    linkText: Learn about tree

  - icon: 🖼️
    title: Panel
    details: Draw a border around any content with titles, subtitles, custom box styles, padding, and per-side styling. Fit to content or fill the terminal width.
    link: /panel
    linkText: Learn about panel

  - icon: 📝
    title: Markdown
    details: Render Markdown-formatted text in the terminal with styled headings, lists, code blocks with syntax highlighting, and emphasis.
    link: /markdown
    linkText: Learn about markdown

  - icon: 🔴
    title: Live Display
    details: Animate a region of the terminal with continuously refreshing content. Progress bars, status spinners, and custom dashboards are all built on top of this.
    link: /live
    linkText: Learn about live display

  - icon: 🔍
    title: Pretty Printing
    details: Automatically format arrays, objects, maps, and sets across multiple lines with indent guides and syntax highlighting. Control truncation for deeply nested data.
    link: /pretty
    linkText: Learn about pretty printing

  - icon: 🐛
    title: Tracebacks
    details: Render error stack traces with the surrounding source code highlighted and local variable tables per frame — dramatically easier to read than plain Node.js errors.
    link: /traceback
    linkText: Learn about tracebacks

  - icon: 🧩
    title: Renderable Protocol
    details: Any object can opt into rich formatting by implementing a simple interface. Compose custom renderables from tables, panels, text, and raw segments.
    link: /protocol
    linkText: Learn the protocol
---
