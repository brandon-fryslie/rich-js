# Doc Spec: Template Bindings

The template-bindings doc explains how rich-js exposes its styling vocabulary as template functions in the shared `go-template-js` engine, and how consumers consume that engine to author styled-text templates.

## Sections

### What the binding module is

One paragraph: rich-js does not ship its own markup grammar. Styled-text strings are authored in standard Go-template syntax (`{{ … }}`), and styling is expressed as ordinary template-function calls (`{{ bold .name }}`, `{{ red (bold "x") }}`, `{{ link .url .label }}`). The `template-bindings` module is rich-js's registration of those style functions into a `go-template-js` engine. One parser, one AST, one error-message dialect — provided by `go-template-js`; the styling vocabulary is provided here.

Cross-reference: the canonical Go-template syntax reference is [`text/template`](https://pkg.go.dev/text/template); the engine package is `go-template-js`. This doc covers only what the rich-js binding adds on top.

### The fragment type

Explain that the engine is generic over an output type `T`, and rich-js binds it to `RichText` — the library's primary styled-text type. A template's evaluation produces a `RichText[]`: each top-level expression in the template emits one fragment. Mention why this matters at the API surface: consumers iterate the result rather than receiving a single concatenated string, which is what makes downstream features like multi-cell links (one cell per top-level `link` call) representable without a special form.

### Constructing an engine

Show the two-call public surface of the bootstrap module:

- `createRichTextEngine()` — returns a ready-to-use `Engine<RichText>` with rich-js's style functions pre-registered. Use this when rich-js styling is the only vocabulary the templates need.
- `richTextFuncs()` — returns the rich-js `FuncMap<RichText>` alone, with no engine. Use this when the consumer manages its own engine and wants to merge rich-js's functions into a wider registry (sprig + the consumer's own domain functions + rich-js styling).

State that `richTextFuncs()` is the canonical way to compose rich-js styling with other function sources; `createRichTextEngine()` is sugar for the common case.

### The function-registration contract

Explain what every function rich-js registers shares — the contract that holds across the styling vocabulary:

- **Output is `RichText`.** Every style function returns a `RichText` fragment. Composition is plain function composition: `red (bold "x")` evaluates the inner call to a `RichText`, hands it to the outer call, which produces a re-styled `RichText`.
- **String inputs are accepted directly.** A function declared to take `RichText` also accepts plain strings; the engine lifts each string literal to a `RichText` via the configured `fromString` bridge before the call. Authors write `{{ red "x" }}`, not `{{ red (text "x") }}`.
- **No silent flattening.** A `RichText` value never silently coerces to a plain `string` parameter. Functions that genuinely want plain text (e.g. an upstream string transform) declare a `string` slot, and the engine raises a `TypeMismatchError` directing the author to an explicit unstyled flatten if a styled fragment reaches that slot.

State which slots are stringifiable for `printf`/`print*` — they use the engine's `toString` bridge, which for the rich-js binding flattens a `RichText` to its `.plain` text (drops styling). Authors who want styled output route through a style function, not through `print`.

Mention that the bootstrap registration set is empty by design — subsequent doc sections will document each style function's signature as it lands. The contract above is what callers can rely on across every future addition.

### Composition with other function sources

Explain that the rich-js binding is one piece of a wider templating environment. A consumer's engine typically merges:

1. Go-template runtime built-ins (`and`, `or`, `eq`, `index`, `printf`, …) — always present, contributed by `go-template-js` itself.
2. The sprig subset the consumer wants (`sprigDefaults()`, `sprigStrings()`, …) — pulled from `go-template-js`.
3. The rich-js styling vocabulary — `richTextFuncs()`.
4. The consumer's own domain functions.

Show the merge order convention (later wins on name collision); state that rich-js never registers a name that overlaps with a built-in or with sprig.

### Errors

Explain that template errors raised during parse or evaluate are instances of `TemplateError` (and its subclasses) from `go-template-js` — `ParseError`, `EvalError`, `FuncNotFoundError`, `TypeMismatchError`, `MissingFieldError`. Each carries a position and a source snippet. The rich-js binding does not introduce a separate error hierarchy; styling failures surface through the same channel.

## Constraints

- Do not document any specific style function (`bold`, `red`, `link`, palette, auto-contrast). Each ships in its own follow-up epic and extends this doc with a section describing its signature and the cell semantics it implies.
- Do not document Go-template syntax — link to the canonical reference instead. This doc is about the binding contract, not the language.
- Do not describe the parser, AST, or evaluator internals. Those live in `go-template-js`.
- The "no silent flattening" contract must be stated explicitly — it is the architectural commitment that makes function composition safe across the styled/plain boundary.
