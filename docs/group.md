# Render Groups

Many renderables — `Panel`, `Layout`, and others — accept only a **single** renderable as their content. `Group` solves this: it combines multiple renderables into one unit.

## The problem

```typescript
import { Console, Group, Panel, RichText } from "@promptctl/rich-js";

const console = new Console();
const first = new RichText("First line");
const second = new RichText("Second line");

// ✗ Panel's second parameter is its options object, not more content.
//   This compiles and runs — it just silently drops `second`.
console.print(new Panel(first, second));

// ✓ Wrap them in a Group
console.print(new Panel(new Group(first, second)));
```

```
╭─────────────────────────────────────────╮
│ First line                              │
╰─────────────────────────────────────────╯
╭─────────────────────────────────────────╮
│ First line                              │
│ Second line                             │
╰─────────────────────────────────────────╯
```

## Group items must be renderables

The constructor is variadic and takes `Renderable` values only. Unlike `Panel`, `Group` will not accept a bare string — pass markup through `renderMarkup`, which parses it into a `RichText`:

```typescript
import { Console, Group, Panel, renderMarkup } from "@promptctl/rich-js";

const console = new Console();

console.print(
  new Panel(
    new Group(
      renderMarkup("[bold cyan]Section Heading[/bold cyan]"),
      renderMarkup("[dim]───────────────────────[/dim]"),
      renderMarkup("Main body content goes here."),
      renderMarkup("[dim]Footer note.[/dim]"),
    ),
    { title: "My Panel" }
  )
);
```

```
╭─────────────── My Panel ────────────────╮
│ Section Heading                         │
│ ───────────────────────                 │
│ Main body content goes here.            │
│ Footer note.                            │
╰─────────────────────────────────────────╯
```

A group emits its children's segments back to back and inserts nothing between them, so each child has to end its own line. `Panel`, `Rule`, `Table`, [`Strip`](./strip), and `FlexStrip` already do and stack without help. A `RichText` — and `renderMarkup`'s result, which is one — does it too, through its `end` option: every `RichText` draws a trailing `end` (default `"\n"`) itself, regardless of what its own text contains. That's why none of the calls above put a `\n` inside the markup: the text is the content, `end` is the line break, and writing both stacks two newlines into one row. Drop `end` to `""` — as [`Strip`](./strip) does for its own cells — for a `RichText` that should *not* end its own line, such as one meant to run straight into whatever the group renders next.

## Building a group from a generator

For a dynamic or large set of items, yield them from a generator and spread the result into the constructor:

```typescript
import { Console, Group, Panel, renderMarkup } from "@promptctl/rich-js";

const console = new Console();

function* buildContent(items: string[]) {
  yield renderMarkup("[bold cyan]Results[/bold cyan]");
  yield renderMarkup("[dim]─────────[/dim]");
  for (const item of items) {
    yield renderMarkup(`• ${item}`);
  }
  yield renderMarkup(`[dim]Total: ${items.length}[/dim]`);
}

console.print(
  new Panel(
    new Group(...buildContent(["alpha", "beta", "gamma"])),
    { title: "Report" }
  )
);
```

```
╭──────────────── Report ─────────────────╮
│ Results                                 │
│ ─────────                               │
│ • alpha                                 │
│ • beta                                  │
│ • gamma                                 │
│ Total: 3                                │
╰─────────────────────────────────────────╯
```

The spread is the part to get right. `new Group(buildContent(items))` passes the generator object itself, and the compiler rejects it:

```
error TS2345: Argument of type 'Generator<RichText, void, unknown>' is not
assignable to parameter of type 'Renderable'.
  Property 'render' is missing in type 'Generator<RichText, void, unknown>'
  but required in type 'Renderable'.
```
