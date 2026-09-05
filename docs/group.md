# Render Groups

Many renderables — `Panel`, `Layout`, and others — accept only a **single** renderable as their content. `Group` solves this: it combines multiple renderables into one unit.

## The problem

```typescript
import { Console, Group, Panel, RichText } from "@promptctl/rich-js";

const console = new Console();
const first = new RichText("First line\n");
const second = new RichText("Second line\n");

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
      renderMarkup("[bold cyan]Section Heading[/bold cyan]\n"),
      renderMarkup("[dim]───────────────────────[/dim]\n"),
      renderMarkup("Main body content goes here.\n"),
      renderMarkup("[dim]Footer note.[/dim]\n"),
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

Every item above ends in `\n`, and dropping it changes the output. A group emits its children's segments back to back and inserts nothing between them, so each child has to end its own line. `Panel`, `Rule`, and `Table` already do and stack without help; a `RichText` breaks the line only when its text ends in `\n`. The `end` newline a `RichText` carries by default will not do it — `console.print` appends that, and a group never calls `console.print`. Without the four `\n`s, the panel above collapses to one run-together line.

## Building a group from a generator

For a dynamic or large set of items, yield them from a generator and spread the result into the constructor:

```typescript
import { Console, Group, Panel, renderMarkup } from "@promptctl/rich-js";

const console = new Console();

function* buildContent(items: string[]) {
  yield renderMarkup("[bold cyan]Results[/bold cyan]\n");
  yield renderMarkup("[dim]─────────[/dim]\n");
  for (const item of items) {
    yield renderMarkup(`• ${item}\n`);
  }
  yield renderMarkup(`[dim]Total: ${items.length}[/dim]\n`);
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

The spread is the part to get right. `new Group(buildContent(items))` puts the generator object itself into the group, and it throws at render time because a generator is not a `Renderable`.
