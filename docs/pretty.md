# Pretty Printing

`print()` and `log()` automatically format containers — arrays, objects, maps, sets — across multiple lines with indentation and syntax highlighting. The output adapts to fit the terminal width.

## What pretty printing does

Pass any JavaScript value to `print()` and it is rendered in a human-readable form:

```typescript
console.print({
  name: "Alice",
  scores: [98, 87, 95],
  metadata: { active: true, role: "admin" },
});
```

```
{
│  'name': 'Alice',
│  'scores': [98, 87, 95],
│  'metadata': {
│  │  'active': True,
│  │  'role': 'admin'
│  }
}
```

Nested structures are indented with vertical guide lines showing depth.

## Indent guides

Indent guides are shown by default. Disable them:

```typescript
console.print(data, { indentGuides: false });
```

## Expand all

By default, the formatter tries to fit items on one line when they're short enough. Force everything to expand:

```typescript
console.print([1, 2, 3], { expandAll: true });
// Always:
// [
//   1,
//   2,
//   3,
// ]
```

## Truncating long output

Two options control truncation for deeply nested or large data:

```typescript
// Truncate containers with more than N elements
console.print(bigArray, { maxLength: 10 });
// [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ... +990]

// Truncate strings longer than N characters
console.print(longStringObject, { maxString: 80 });
// 'This is a very long string...' +240 chars
```

## Pretty as a renderable

Use the `Pretty` class to embed pretty-printed data inside another renderable:

```typescript
import { Pretty, Panel } from "rich-js";

const data = { name: "Alice", scores: [98, 87, 95] };

console.print(new Panel(new Pretty(data), { title: "User" }));
```

```
╭─ User ──────────────────────╮
│ {                           │
│ │  'name': 'Alice',         │
│ │  'scores': [98, 87, 95]   │
│ }                           │
╰─────────────────────────────╯
```

## Custom object representation

Built-in containers and common types are handled automatically. For your own classes, implement a `richRepr` method.

### The rich repr protocol

Without a custom repr, a class shows its default string form:

```typescript
class Bird {
  constructor(public name: string, public eats: string[] = [], public fly = true) {}
}

console.print(new Bird("penguin", ["fish", "squid"], false));
// Bird { name: 'penguin', eats: [ 'fish', 'squid' ], fly: false }
```

With `richRepr`, you control exactly what's shown. Yield each field as a positional value, a `[name, value]` keyword, or a `[name, value, default]` to omit when unchanged:

```typescript
class Bird {
  constructor(public name: string, public eats: string[] = [], public fly = true) {}

  *richRepr() {
    yield this.name;                    // positional
    yield ["eats", this.eats, []];      // keyword — omitted when empty
    yield ["fly", this.fly, true];      // keyword — omitted when true
  }
}

console.print(new Bird("penguin", ["fish"], false));
// Bird('penguin', eats=['fish'], fly=False)

console.print(new Bird("parrot"));
// Bird('parrot')         ← eats and fly omitted (they're at defaults)
```

Omitting default-valued arguments is the key readability improvement — the before/after difference is dramatic for objects with many fields.

### Angular bracket style

Produce `<ClassName field=value>` output instead of constructor-call style:

```typescript
class Point {
  constructor(public x: number, public y: number) {}

  *richRepr() {
    yield ["x", this.x];
    yield ["y", this.y];
  }

  get [Symbol.for("rich.angular")]() { return true; }
}

console.print(new Point(10, 20));
// <Point x=10 y=20>
```

### Automatic repr generation

A decorator that generates the rich repr automatically when constructor parameter names match attribute names:

```typescript
import { richReprAuto } from "rich-js";

@richReprAuto
class Color {
  constructor(public red: number, public green: number, public blue: number) {}
}

console.print(new Color(100, 200, 50));
// Color(red=100, green=200, blue=50)
```
