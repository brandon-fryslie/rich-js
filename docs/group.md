# Render Groups

Many renderables — `Panel`, `Layout`, and others — accept only a **single** renderable as their content. `Group` solves this: it combines multiple renderables into one unit.

## The problem

```typescript
// ✗ Panel only accepts one renderable
console.print(new Panel(text1, text2)); // error

// ✓ Wrap them in a Group
import { Group } from "rich-js";

console.print(new Panel(new Group(text1, text2)));
```

## Group constructor

Pass multiple renderables as positional arguments:

```typescript
import { Console, Group, Panel } from "rich-js";

const console = new Console();

console.print(
  new Panel(
    new Group(
      "[bold cyan]Section Heading[/bold cyan]",
      "[dim]───────────────────────[/dim]",
      "Main body content goes here.",
      "[dim]Footer note.[/dim]",
    ),
    { title: "My Panel" }
  )
);
```

```
╭─ My Panel ──────────────────────────────╮
│ Section Heading                         │
│ ───────────────────────                 │
│ Main body content goes here.            │
│ Footer note.                            │
╰─────────────────────────────────────────╯
```

## Generator / decorator form

For a dynamic or large set of renderables, yield from a generator — more ergonomic than building a list:

```typescript
import { RenderGroup } from "rich-js";

function* buildContent(items: string[]) {
  yield "[bold cyan]Results[/bold cyan]";
  yield "[dim]─────────[/dim]";
  for (const item of items) {
    yield `• ${item}`;
  }
  yield `[dim]Total: ${items.length}[/dim]`;
}

console.print(
  new Panel(
    new RenderGroup(buildContent(["alpha", "beta", "gamma"])),
    { title: "Report" }
  )
);
```

The generator form is significantly more ergonomic for dynamic content — no intermediate array needed.
