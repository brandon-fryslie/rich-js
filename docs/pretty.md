# Pretty Printing

`Pretty` formats a JavaScript value — an array, object, `Map`, or `Set` — across multiple lines with indentation, syntax highlighting, and indent guides. It is a renderable you construct around your data: print it on its own, or nest it inside a `Panel`, a table cell, or anything else that takes a renderable.

Every snippet below pins its console to a width of 43, and the output under it is that snippet's stdout. Width is not incidental here — it decides whether a container prints on one line or expands over several, so a `new Console()` left at the default 80 gives you different output than the page shows.

## Formatting a value

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });
const data = { name: "Alice", scores: [98, 87, 95], active: true };

console.print(new Pretty(data));
```

```
{
    name: "Alice",
    scores: [98, 87, 95],
    active: true
}
```

Keys are printed unquoted and strings in double quotes. Each value is coloured by type — `Pretty` runs `ReprHighlighter` over its output, so numbers, strings, booleans and `null` are visually distinct.

A class instance is formatted as a plain object, from its own enumerable properties. The class name does not appear, and there is no per-class formatting hook:

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });

class Bird {
  constructor(public name: string, public eats: string[] = []) {}
}

console.print(new Pretty(new Bird("penguin", ["fish", "squid"])));
```

```
{
    name: "penguin",
    eats: ["fish", "squid"]
}
```

## `print()` will not do this for you

`Pretty` is never applied automatically. `print()` renders anything that is not already a renderable by calling `String()` on it, and for a plain object that yields the literal text `[object Object]` — which the markup parser reads as a style tag and consumes. The line comes out blank:

```typescript
import { Console } from "@promptctl/rich-js";

const console = new Console({ width: 43 });

console.print({ name: "Alice" }); // a blank line, not an object
console.print("after");
```

```

after
```

Options behave the same way. They belong to `Pretty`'s constructor; `print()` has no pretty-printing options at all. Passing one is not configuration — it is a second value to print, and it vanishes for the same reason:

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });

// `{ expandAll: true }` is a second argument to print, not a setting.
// It compiles, prints nothing, and leaves the Pretty unchanged.
console.print(new Pretty([1, 2, 3]), { expandAll: true });
```

```
[1, 2, 3]
```

## Indentation and guides

`indent` is the number of spaces per level and defaults to 4. `indentGuides` defaults to `true` and styles the first space of each level `dim green`. The guide is a coloured space, not a line-drawing character — it reads as a faint column in a terminal and leaves no mark in plain text.

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });
const data = { name: "Alice", metadata: { active: true } };

console.print(new Pretty(data, { indent: 2, indentGuides: false, expandAll: true }));
```

```
{
  name: "Alice",
  metadata: {
    active: true
  }
}
```

## One line or many

An array or object prints on one line when that form fits the width, and expands over several lines when it does not. `expandAll` skips the test and expands everything, at every depth:

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });

console.print(new Pretty([1, 2, 3]));
console.print(new Pretty([1, 2, 3], { expandAll: true }));
```

```
[1, 2, 3]
[
    1,
    2,
    3
]
```

The fit test measures the container by itself, not the key it sits under, so a nested container can still overrun the width by the length of its key. Reach for `expandAll` when a nested structure wraps in a way you did not expect.

`Map` and `Set` have no one-line form and are always expanded:

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });

console.print(new Pretty(new Map([["a", 1], ["b", 2]])));
```

```
Map {
    "a" => 1,
    "b" => 2
}
```

## Truncating large values

`maxLength` caps how many entries are shown. For an array or object the ones it drops are counted in a trailing `... +N`; for a `Map` or `Set` they are dropped with no marker at all, so the output gives you no sign that anything is missing. `maxString` cuts strings to that many characters and appends the number dropped — inside the quotes, as part of the string:

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });
const bigArray = Array.from({ length: 1000 }, (_, i) => i + 1);

console.print(new Pretty(bigArray, { maxLength: 10 }));
console.print(new Pretty({ bio: "Field biologist. ".repeat(20) }, { maxString: 24 }));
```

```
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ... +990]
{ bio: "Field biologist. Field b+316" }
```

## Nesting inside another renderable

`Pretty` implements both `Renderable` and `Measurable`, so it goes anywhere a renderable goes — a `Panel`, a table cell, a `Group`:

```typescript
import { Console, Panel, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });
const data = { name: "Alice", scores: [98, 87, 95] };

console.print(new Panel(new Pretty(data, { expandAll: true }), { title: "User" }));
```

```
╭───────────────── User ──────────────────╮
│ {                                       │
│     name: "Alice",                      │
│     scores: [                           │
│         98,                             │
│         87,                             │
│         95                              │
│     ]                                   │
│ }                                       │
╰─────────────────────────────────────────╯
```
