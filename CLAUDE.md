# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

A TypeScript port of Python's [Rich](https://github.com/Textualize/rich) library — rich text and beautiful formatting in the terminal. ESM-only, targeting Node.js >= 20 (transitively required by `@promptctl/go-template-js`).

## Commands

```bash
npm run build          # tsc → dist/
npm run test           # vitest run (all tests)
npx vitest run test/core/color.test.ts   # single test file
npx vitest run -t "test name"            # single test by name
npm run lint           # tsc --noEmit (type-check only)
```

## Architecture

### Spec-driven development

The `spec/` directory is the source of truth. Each module has an API spec (`*-api.md`) defining the public interface and a behavior spec (`*-behavior.md`) defining semantics. Tests must validate behavior described in the spec. Many spec files describe modules not yet implemented — they are the roadmap.

### Two-layer structure

- **`src/core/`** — primitives. No upward calls, no renderable-specific logic.
- **`src/renderables/`** — composed renderables (Table, Panel, Tree, etc.) built on core. Each implements the `Renderable` interface.

### Core primitives (src/core/)

Dependency order (no back-edges):

```
cells → color → style → segment → box
                       ↘
                        protocol → measure
                       ↗
          markup → text → highlighter
                       ↘
                        console (orchestrator)
```

- **cells** — terminal cell-width (wraps `string-width`). Provides `cellLen`, `setCellSize`, `splitText`, `chopCells`.
- **color** — `Color` class: parsing, ANSI code generation, downgrading across color systems. Includes palette data and terminal themes.
- **style** — immutable `Style` descriptors (colors + text attributes + links). `Style.parse`, `Style.add`. Includes `StyleStack`, `Theme`, `DEFAULT_STYLES`.
- **segment** — atomic render unit `(text, style?, control?)`. All static methods (`applyStyle`, `splitLines`, `adjustLineLength`, `simplify`, `divide`) operate on `Segment[]` / `Segment[][]`.
- **box** — box-drawing character sets. One `Box` type, many pre-built instances (ASCII, SQUARE, ROUNDED, HEAVY, DOUBLE, etc.).
- **protocol** — `Renderable` and `Measurable` interfaces. `Renderable.render(options) → Iterable<Segment>`. `Measurable.measure(options) → {minimum, maximum}`. Single authority for the rendering contract.
- **measure** — `Measurement` value type (min/max cell width). `Measurement.get()` is the single enforcer for measuring a `Measurable`.
- **markup** — parses Rich markup strings (`[bold red]text[/]`) into `RichText`.
- **text** — `RichText`: styled text with `Span[]` annotations. Primary text type for the library; implements `Renderable` and `Measurable`.
- **highlighter** — `Highlighter` base + built-ins (`RegexHighlighter`, `ReprHighlighter`, `JSONHighlighter`, `ISO8601Highlighter`). Mutates a `RichText` by adding style spans.
- **emoji** — emoji shortcode substitution (`emojiReplace`).
- **console** — `Console` class: central orchestrator. Detects color support, owns the render loop, converts items → `RichText`/`Renderable` → `Segment[]` → ANSI strings → stdout/stderr. Supports recording and HTML/text export.

### Key patterns

- **Immutable + cached**: `Color`, `Style`, and `Segment` are immutable. `Color.parse` and `Style.parse` are cached.
- **Data-driven instances**: Box styles are instances of one `Box` type differing only by character data, not separate types.
- **Segment pipelines**: Rendering is a pipeline of `Segment[]` transformations (`applyStyle`, `splitLines`, `adjustLineLength`, `simplify`, etc.).
- **Protocol-first renderables**: Every renderable in `src/renderables/` implements `Renderable` (and often `Measurable`) from `protocol.ts`. Console calls `render(options)` uniformly.
