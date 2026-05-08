# Doc Spec: Template Bindings

The template-bindings doc explains how rich-js exposes its styling vocabulary as template functions in the shared `@promptctl/go-template-js` engine, and how consumers consume that engine to author styled-text templates.

## Sections

### What the binding module is

One paragraph: rich-js does not ship its own markup grammar. Styled-text strings are authored in standard Go-template syntax (`{{ … }}`), and styling is expressed as ordinary template-function calls (`{{ bold .name }}`, `{{ red (bold "x") }}`, `{{ link .url .label }}`). The `template-bindings` module is rich-js's registration of those style functions into a `@promptctl/go-template-js` engine. One parser, one AST, one error-message dialect — provided by `@promptctl/go-template-js`; the styling vocabulary is provided here.

Cross-reference: the canonical Go-template syntax reference is [`text/template`](https://pkg.go.dev/text/template); the engine package is `@promptctl/go-template-js`. This doc covers only what the rich-js binding adds on top.

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

### Registered styling functions

This section enumerates the functions registered by `richTextFuncs()` at a contract level — names, argument shapes, return shape. Implementation details (which `Style` object is constructed, which lookup table is consulted) belong in the source.

#### Foreground colour

- **Named colours.** Every name accepted by the string-syntax style spec is registered as a one-argument function: `{{ red "x" }}`, `{{ bright_blue "x" }}`, `{{ deep_pink4 "x" }}`. The full inventory comes from the same name table that `Style.parse` consults — adding a new named colour to that table makes it available in templates without further work.
- **Palette index.** `{{ color N "x" }}` — `N` is an integer in `0..255`. Templating analogue of the string form `color(N)`.
- **Hex.** `{{ hex "#af00ff" "x" }}` — six-digit RGB or eight-digit RGBA, same syntax as the string form.
- **RGB triple.** `{{ rgb 175 0 255 "x" }}` — three integers in `0..255`.

Each foreground form takes the colour spec(s) followed by a final `liftable` slot — the child fragment. The child may be a string literal (lifted to `RichText` by the engine) or another `RichText` produced by a nested call.

#### Background

A single `on` function takes a colour-spec string and a child: `{{ on "white" "x" }}`, `{{ on "#112233" "x" }}`, `{{ on "rgb(10,20,30)" "x" }}`, `{{ on "color(42)" "x" }}`. The first argument is parsed by the same colour-spec parser used everywhere else in rich-js, so any string accepted as a foreground spec is also accepted as a background spec.

Reason for the single-function shape: backgrounding is an operation on a colour-spec value, not a colour itself. Mirroring the named-foreground set with a parallel named-background set (`on_red`, `on_bright_blue`, …) would double the inventory without adding expressiveness — `on "red"` is already concise and accepts the full colour-spec grammar.

#### Text attributes

The thirteen attributes documented in `spec/style.md` are each registered as a one-argument function:

`bold`, `dim`, `italic`, `underline`, `blink`, `blink2`, `reverse`, `conceal`, `strike`, `underline2`, `frame`, `encircle`, `overline`.

Short aliases from the same source are also registered, so authors can write either form: `b`/`bold`, `d`/`dim`, `i`/`italic`, `u`/`underline`, `s`/`strike`, `r`/`reverse`, `o`/`overline`, `uu`/`underline2`. Both forms produce the same fragment; the canonical name is used in the resulting `Style`.

#### Negated attributes

For each attribute, a `not_<name>` form turns the attribute off rather than on: `{{ not_bold "x" }}`, `{{ not_italic "x" }}`. This is the templating analogue of the string-form `not bold` / `not italic`. Negated forms are not aliased — the `not_*` family stays canonical-only to keep the inventory predictable.

The naming choice (`not_<attribute>` rather than `notBold` or a generic `not "bold" "x"`):
- The leading `not_` keeps the template author's eye on the operation, with the attribute name following — matches the string-form word order.
- Per-attribute registration parallels the positive set, so the engine's `FuncNotFoundError` suggestion list remains useful (typing `not_blod` suggests `not_bold` because both are registered names).
- A generic `not "bold" "x"` would collide with Go-template's built-in `not` (boolean negation).

### Composition

Nesting is plain function composition. `{{ red (bold "x") }}` evaluates the inner call to a `RichText` carrying `bold`, hands it to the outer call, which applies `red` on top.

When two styles meet on the same fragment, conflict resolution follows `Style.add` — the outer (most recently applied) style wins on any field that both populate:

- `{{ red (blue "x") }}` → fragment with `color = red`. The inner `blue` is overwritten.
- `{{ bold (red "x") }}` → fragment with `color = red, bold`. No conflict; both contribute.
- `{{ red (bold "x") }}` → same fragment as `{{ bold (red "x") }}`. Order doesn't matter when the contributing slots are disjoint.
- `{{ on "white" (red "x") }}` → fragment with `color = red, bgcolor = white`. Foreground and background are independent slots.

A fragment built by template composition is equivalent to the same styling expressed by directly constructing a `Style` chain — `Style.parse("red").add(Style.parse("bold"))` produces the same final `Style` as `red (bold …)`. This is the "round-trip through `Style` without semantic drift" property the binding's tests assert.

### Composition with other function sources

Explain that the rich-js binding is one piece of a wider templating environment. A consumer's engine typically merges:

1. Go-template runtime built-ins (`and`, `or`, `eq`, `index`, `printf`, …) — always present, contributed by `@promptctl/go-template-js` itself.
2. The sprig subset the consumer wants (`sprigDefaults()`, `sprigStrings()`, …) — pulled from `@promptctl/go-template-js`.
3. The rich-js styling vocabulary — `richTextFuncs()`.
4. The consumer's own domain functions.

Show the merge order convention (later wins on name collision); state that rich-js never registers a name that overlaps with a built-in or with sprig.

### Errors

Explain that template errors raised during parse or evaluate are instances of `TemplateError` (and its subclasses) from `@promptctl/go-template-js` — `ParseError`, `EvalError`, `FuncNotFoundError`, `TypeMismatchError`, `MissingFieldError`. Each carries a position and a source snippet. The rich-js binding does not introduce a separate error hierarchy; styling failures surface through the same channel.

## Constraints

- Do not document any specific style function (`bold`, `red`, `link`, palette, auto-contrast). Each ships in its own follow-up epic and extends this doc with a section describing its signature and the cell semantics it implies.
- Do not document Go-template syntax — link to the canonical reference instead. This doc is about the binding contract, not the language.
- Do not describe the parser, AST, or evaluator internals. Those live in `@promptctl/go-template-js`.
- The "no silent flattening" contract must be stated explicitly — it is the architectural commitment that makes function composition safe across the styled/plain boundary.
