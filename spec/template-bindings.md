# Doc Spec: Template Bindings

The template-bindings doc explains how rich-js exposes its styling vocabulary as template functions in the shared `@promptctl/go-template-js` engine, and how consumers consume that engine to author styled-text templates.

## Sections

### What the binding module is

Add a short "when to use template-bindings vs markup" note before the main paragraph: template-bindings is the right choice for programmatic composition, structured output (toolbar cells, multi-cell links), and toolchain templates; for human-authored strings where styling is embedded inline, the markup module (`[bold red]text[/]`) is simpler — cross-link to `spec/markup.md`.

One paragraph: rich-js does not ship its own markup grammar. Styled-text strings are authored in standard Go-template syntax (`{{ … }}`), and styling is expressed as ordinary template-function calls (`{{ bold .name }}`, `{{ red (bold "x") }}`, `{{ link .url .label }}`). The `template-bindings` module is rich-js's registration of those style functions into a `@promptctl/go-template-js` engine. One parser, one AST, one error-message dialect — provided by `@promptctl/go-template-js`; the styling vocabulary is provided here.

Cross-reference: the canonical Go-template syntax reference is [`text/template`](https://pkg.go.dev/text/template); the engine package is `@promptctl/go-template-js`. This doc covers only what the rich-js binding adds on top.

### The fragment type

Explain that the engine is generic over an output type `T`, and rich-js binds it to `RichText` — the library's primary styled-text type. A template's evaluation produces a `RichText[]`: each top-level expression in the template emits one fragment. Mention why this matters at the API surface: consumers iterate the result rather than receiving a single concatenated string, which is what makes downstream features like multi-cell links (one cell per top-level `link` call) representable without a special form.

### Constructing an engine

Show the two-call public surface of the bootstrap module:

- `createRichTextEngine()` — returns a ready-to-use `Engine<RichText>` with rich-js's style functions pre-registered. Use this when rich-js styling is the only vocabulary the templates need.
- `richTextFuncs()` — returns the rich-js `FuncMap` alone, with no engine. (`FuncMap` is `Record<string, TemplateFunc>` in `@promptctl/go-template-js`; the engine's fragment type lives on `Engine<T>` / `EngineConfig<T>`, not on `FuncMap` itself, so the map type-checks against any consumer's `EngineConfig<T>.funcs`. The registered functions are nevertheless only runtime-compatible with `Engine<RichText>`: every style function returns a `RichText` and requires its lifted child to be a `RichText`, so merging this map into an engine whose `T` is anything else type-checks but fails at evaluation time.) Use this when the consumer manages its own `Engine<RichText>` and wants to merge rich-js's functions into a wider registry (sprig + the consumer's own domain functions + rich-js styling).

State that `richTextFuncs()` is the canonical way to compose rich-js styling with other function sources; `createRichTextEngine()` is sugar for the common case.

### The function-registration contract

Explain what every function rich-js registers shares — the contract that holds across the styling vocabulary:

- **Output is `RichText`.** Every style function returns a `RichText` fragment. Composition is plain function composition: `red (bold "x")` evaluates the inner call to a `RichText`, hands it to the outer call, which produces a re-styled `RichText`.
- **String inputs are accepted directly.** A function declared to take `RichText` also accepts plain strings; the engine lifts each string literal to a `RichText` via the configured `fromString` bridge before the call. Authors write `{{ red "x" }}`, not `{{ red (text "x") }}`.
- **No silent flattening.** A `RichText` value never silently coerces to a plain `string` parameter. Functions that genuinely want plain text (e.g. an upstream string transform) declare a `string` slot, and the engine raises a `TypeMismatchError` directing the author to an explicit unstyled flatten if a styled fragment reaches that slot.

State which slots are stringifiable for `printf`/`print*` — they use the engine's `toString` bridge, which for the rich-js binding flattens a `RichText` to its `.plain` text (drops styling). Authors who want styled output route through a style function, not through `print`.

The contract above is what callers can rely on across every style function rich-js registers, present and future.

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

#### Multi-attribute style spec

A single `style` function takes a space-separated style spec and a child fragment: `{{ style "bold underline #ff6b6b" "alarm!" }}`, `{{ style "italic on white" .username }}`, `{{ style "not dim" .field }}`. The first argument is parsed by the same grammar `Style.parse` consults — the inside of `[...]` markup — so any spec accepted in markup is accepted here, and any spec rejected by markup raises the same `StyleSyntaxError` surface through `EvalError`. Tokens accepted: every named foreground colour, hex (`#RRGGBB` / `#RRGGBBAA`), `color(N)`, `rgb(r,g,b)`, every text attribute and its short alias, `not <attr>`, `on <bg-color>`, and `link <url>`.

Reason for the single-function shape: the per-attribute functions (`bold`, `underline`, `hex`, …) compose by nesting, which is awkward when the styling for a fragment is a fixed bundle of attributes or when the same bundle is applied in many places. `style` collapses that bundle into one call, and because the spec is a string it flows through ordinary Go-template `$var` assignment and through scope — naming a reusable style set requires no additional API:

```
{{ $alert := "bold underline #ff6b6b" }}
{{ style $alert "alarm!" }}
{{ style $alert .otherField }}
```

A spec passed through scope works the same way: `engine.evaluate(tpl, { styles: { alert: "bold #ff6b6b" } })` followed by `{{ style .styles.alert .field }}`. The same template source produces the same fragment as a directly-constructed `Style.parse(spec)` applied to the child — the "round-trip through `Style` without semantic drift" property the binding's tests assert.

`style` is the natural escape valve for "apply many styles at once"; for one-or-two-attribute cases the per-attribute functions (or the pipe form documented under **Composition**) are usually shorter.

#### Negated attributes

For each attribute, a `not_<name>` form turns the attribute off rather than on: `{{ not_bold "x" }}`, `{{ not_italic "x" }}`. This is the templating analogue of the string-form `not bold` / `not italic`. Negated forms are not aliased — the `not_*` family stays canonical-only to keep the inventory predictable.

The naming choice (`not_<attribute>` rather than `notBold` or a generic `not "bold" "x"`):
- The leading `not_` keeps the template author's eye on the operation, with the attribute name following — matches the string-form word order.
- Per-attribute registration parallels the positive set, so the engine's `FuncNotFoundError` suggestion list remains useful (typing `not_blod` suggests `not_bold` because both are registered names).
- A generic `not "bold" "x"` would collide with Go-template's built-in `not` (boolean negation).

#### Palette / theme / auto-contrast

The palette binding is loaded separately from the style-function set because it requires a runtime argument — a `PaletteResolver` bound to an active theme. Consumers call `paletteFuncs(resolver)` and merge the result alongside `richTextFuncs()`:

```ts
import { createEngine } from "@promptctl/go-template-js";
import { GRUVBOX, PaletteResolver, RichText } from "rich-js";
import { richTextFuncs, paletteFuncs } from "rich-js/template-bindings";

const engine = createEngine({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...paletteFuncs(new PaletteResolver(GRUVBOX.palette)) },
});
```

**Semantic-name functions.** For each palette variable whose name is a valid Go template identifier (letter or underscore start, alphanumeric/underscore body — no hyphens), `paletteFuncs` registers a one-argument function that resolves that variable and applies the result as foreground color:

```
{{ primary child }}     {{ accent child }}    {{ error child }}
{{ success child }}     {{ warning child }}   {{ secondary child }}
{{ background child }}  {{ foreground child }} {{ surface child }}
```

All themes built by `buildPalette` expose these nine identifier-safe names plus derived entries like `primary-muted` and `text-primary`. The hyphenated derived names cannot be Go template identifiers and are accessed via `palette`.

**`palette "spec" child`** — resolves any spec string that does not require a background context: bare names (`"primary"`, `"primary-muted"`), darken/lighten modifiers (`"primary-darken-3"`). The spec grammar is the same as `PaletteResolver.resolve` — see `spec/themes/`. If the spec requires a background (alpha or auto-contrast) but none is provided, evaluation throws with a message directing the author to `paletteOver`.

**`paletteOver "spec" "#bgHex" child`** — resolves any spec with an explicit background color. Covers alpha compositing (`"primary 50%"`) and auto-contrast (`"auto"`, `"auto 33%"`). The background is supplied as a `#RRGGBB` or `#RRGGBBAA` hex string — the same format accepted by the `hex` style function. The background is threaded as an explicit argument rather than via scope side-channels, keeping evaluation stateless.

**`auto "#bgHex" child`** — syntactic sugar for `{{ paletteOver "auto" "#bgHex" child }}`. Resolves the auto-contrast color (white against a dark background, black against a light background) and applies it as foreground:

```
{{ auto "#282828" "text" }}   → white text (dark gruvbox bg)
{{ auto "#ffffff" "text" }}   → black text (light bg)
```

**Theme switching.** `paletteFuncs(resolver)` captures `resolver` at construction time. Consumers that need runtime theme switching create a fresh `paletteFuncs()` from the new resolver and rebuild (or reconstruct) their engine. The same template *source string* produces different colors because the functions in the new engine resolve against the new palette — the template text is unchanged; the resolver differs.

**Resolution context for `paletteOver` / `auto`.** The background color (`against` in `PaletteResolver` terms) is threaded as an explicit hex argument rather than via a scope variable, an evaluation-time hook, or a deferred-resolution fragment. This design was chosen because `go-template-js`'s functions do not have access to the evaluation scope at call time — each function receives only its declared arguments. Explicit threading is therefore the only stateless option and keeps the contract auditable from the template source alone.

### Composition

Nesting is plain function composition. `{{ red (bold "x") }}` evaluates the inner call to a `RichText` carrying `bold`, hands it to the outer call, which applies `red` on top.

When two styles meet on the same fragment, conflict resolution follows `Style.add` — the outer (most recently applied) style wins on any field that both populate:

- `{{ red (blue "x") }}` → fragment with `color = red`. The inner `blue` is overwritten.
- `{{ bold (red "x") }}` → fragment with `color = red, bold`. No conflict; both contribute.
- `{{ red (bold "x") }}` → same fragment as `{{ bold (red "x") }}`. Order doesn't matter when the contributing slots are disjoint.
- `{{ on "white" (red "x") }}` → fragment with `color = red, bgcolor = white`. Foreground and background are independent slots.

A fragment built by template composition is equivalent to the same styling expressed by directly constructing a `Style` chain — `Style.parse("red").add(Style.parse("bold"))` produces the same final `Style` as `red (bold …)`. This is the "round-trip through `Style` without semantic drift" property the binding's tests assert.

**Pipe form.** Go template's last-arg piping (`x | f a b` ≡ `f a b x`) gives a flat alternative to nested composition. Because every style function takes its child in the trailing `liftable` slot, the pipe form composes uniformly across the entire vocabulary:

- `{{ "alarm!" | bold | underline | red }}` is equivalent to `{{ red (underline (bold "alarm!")) }}` — read left-to-right ("take 'alarm!', make it bold, then underline it, then red").
- Parameterised styles work the same way: `{{ "alarm!" | hex "#ff6b6b" | bold }}` is equivalent to `{{ bold (hex "#ff6b6b" "alarm!") }}` — the colour spec stays positional, the child arrives at the trailing slot via the pipe.
- The pipe form composes with `style`: `{{ "alarm!" | style "bold underline #ff6b6b" }}` and `{{ style $alert .field }}` are the two canonical "many styles at once" forms; pick whichever reads more naturally for the surrounding template.

The pipe form is plain Go template syntax — it is documented here only because it changes the typical reading order. Nested and piped templates produce byte-identical fragments; choose by readability.

### The `link` function and the multi-cell contract

`link` is the templating analogue of the existing string-form `link URL` and of `Style({ link })`. Its signature is `{{ link URL child }}` — `URL` is a string, `child` is the styled-text fragment to wrap (string literal lifted to `RichText` by the engine, or another `RichText` from a nested call).

Hyperlinks are special at the rendering layer: terminal hyperlinks (OSC 8) attach at the cell boundary, not at the rune boundary. Consumers that want to render template output as a sequence of independently-addressable cells (cc-candybar's toolbar shape, for instance) need to recognise which fragments are cell boundaries vs which are inter-cell content. The binding exposes this through one signal: a fragment's `style.link` slot.

The contract:

- **Top-level `link` is a cell boundary.** Each top-level expression in the template (`{{ … }}`) emits one fragment. A fragment whose wrapper `style.link` is truthy IS a cell. A fragment whose `style.link` is undefined / empty is inter-cell content (a "joiner").
- **Nested `link` collapses outer-wins.** `{{ link "u1" (link "u2" "x") }}` produces a fragment with `style.link = "u1"`. This is `Style.add`'s right-wins-on-conflict rule applied to the link slot.
- **A `link` wrapped by a non-`link` style still qualifies as a cell.** `{{ red (link "u" "x") }}` produces a fragment with `style.color = red, style.link = "u"`. `Style.add` propagates `link` from the inner call to the outer fragment, so the cell-boundary signal survives any wrapping.
- **A non-`link` style wrapped by `link` carries both styles.** `{{ link "u" (bold "x") }}` produces a fragment with `style.bold = true, style.link = "u"`. One cell, with the inner styling preserved.
- **Existing `Style({ link })` semantics are unchanged.** This binding adds a function-call surface that produces fragments equivalent to those built by `new RichText("x", { style: Style.parse("link u") })`. Renderers, OSC 8 emission, and `Style.add` link-slot mechanics all continue to work as they did before this binding existed.

#### Cell-splitting algorithm (consumer side)

A consumer renderer that builds cells from the binding's `RichText[]` output applies the following walk — described here as a contract so a consumer can implement it from this spec alone, without reading rich-js's source:

1. Iterate the fragment list left-to-right.
2. For each fragment:
   - If `fragment.style.link` is truthy, emit it as a cell.
   - Otherwise, accumulate it as joiner content.
3. Joiner content between two cells is rendered between them; joiner content before the first cell or after the last cell is rendered as leading/trailing inter-cell content (or as the entire output if there are no cells).

Consequence: `{{ link "u1" "a" }} {{ link "u2" "b" }}` evaluates to three fragments — `[link=u1 "a"]`, `[" "]`, `[link=u2 "b"]` — and the renderer splits them into two cells with `" "` as the joiner. `{{ red "hello" }}` evaluates to one fragment with no link, and the renderer treats it as a single non-cell run.

### Composition with other function sources

Explain that the rich-js binding is one piece of a wider templating environment. A consumer's engine typically merges:

1. Go-template runtime built-ins (`and`, `or`, `eq`, `index`, `printf`, …) — always present, contributed by `@promptctl/go-template-js` itself.
2. The sprig subset the consumer wants (`sprigDefaults()`, `sprigStrings()`, …) — pulled from `@promptctl/go-template-js`.
3. The rich-js styling vocabulary — `richTextFuncs()`.
4. The consumer's own domain functions.

Show the merge order convention (later wins on name collision); state that rich-js never registers a name that overlaps with a built-in or with sprig. Note that `paletteFuncs(resolver)` is merged separately from `richTextFuncs()` because it requires a resolver argument; both should appear in the consumer's merge.

### Errors

Explain that template errors raised during parse or evaluate are instances of `TemplateError` (and its subclasses) from `@promptctl/go-template-js` — `ParseError`, `EvalError`, `FuncNotFoundError`, `TypeMismatchError`, `MissingFieldError`. Each carries a position and a source snippet. The rich-js binding does not introduce a separate error hierarchy; styling failures surface through the same channel.

## Constraints

- Each new family of style functions documents itself in its own subsection under **Registered styling functions** rather than as a standalone top-level section. The subsection names its functions at the contract level (names, argument shapes, return shape) without describing how they are implemented.
- Do not document Go-template syntax — link to the canonical reference instead. This doc is about the binding contract, not the language.
- Do not describe the parser, AST, or evaluator internals. Those live in `@promptctl/go-template-js`.
- The "no silent flattening" contract must be stated explicitly — it is the architectural commitment that makes function composition safe across the styled/plain boundary.
- Function inventories (named colours, attribute names, short aliases) are documented at the contract level — names and shapes — and derive from the canonical tables in `src/core/color.ts` and `src/core/style.ts`. Do not restate the literal list; reference the source. [LAW:one-source-of-truth]
