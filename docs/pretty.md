# Pretty Printing

`Pretty` formats a JavaScript value — an array, object, `Map`, or `Set` — across multiple lines with indentation, syntax highlighting, and indent guides. It is a renderable you construct around your data: print it on its own, or nest it inside a `Panel`, a table cell, or anything else that takes a renderable.

The first snippet pins its console to a width of 43, and every snippet after it prints through that same console. Width is not incidental here — it decides whether a container prints on one line or expands over several, so a `new Console()` left at the terminal's width gives you different output than the page shows.

## Formatting a value

```typescript
import { Console, Pretty } from "@promptctl/rich-js";

const console = new Console({ width: 43 });
const data = { name: "Alice", scores: [98, 87, 95], active: true, manager: null };

console.print(new Pretty(data));
```

Keys are printed unquoted and strings in double quotes. Each value is coloured by type — `Pretty` runs `ReprHighlighter` over its output by default, so numbers, strings, booleans and `null` are visually distinct. Pass `highlighter` to substitute your own, or a `NullHighlighter` for none. `print()` passes the console's, so a console-wide `highlight: false` or a custom `highlighter` reaches formatted values exactly as it reaches printed strings.

A class instance is formatted as a plain object, from its own enumerable properties. The class name does not appear:

```typescript
class Bird {
  constructor(public name: string, public eats: string[] = []) {}
}

console.print(new Pretty(new Bird("penguin", ["fish", "squid"])));
```

Reflecting on properties is the fallback, not the rule. A value that defines its own `toString` — a `Date`, an `Error`, a `RegExp`, or a class of yours that declares one — keeps that string form instead, because reflection would throw the answer away: `Object.keys(new Date())` is empty, so a date reflected on renders `{}`. Give `Bird` a `toString` and the block above becomes whatever that method returns. Inheriting the default is the opposite signal — it yields `[object Object]`, which says nothing, leaving the properties as the only information there is.

Typed arrays are formatted as the sequences they are, `[1, 2, 3]`, rather than by either of those routes. Data that refers back to itself prints `[Circular]` at the point of return; an object reached twice through separate paths is not a cycle and is printed in full both times:

```typescript
class Parrot extends Bird {
  override toString() {
    return `Parrot(${this.name})`;
  }
}

const shared = { lat: 51.5, lon: -0.1 };
const aviary: Record<string, unknown> = {
  pattern: /par+ot/i,
  resident: new Parrot("polly", ["seeds"]),
  weights: new Uint8Array([1, 2, 3]),
  home: shared,
  feeder: shared,
};
aviary["self"] = aviary;

console.print(new Pretty(aviary));
```

Reading data you did not build is allowed to fail. A property whose getter throws — a lazy ORM relation, a reactive wrapper, a field computed on access — renders as `[Threw: <message>]` in that one position while its neighbours print normally, so everything that could be read is still shown:

```typescript
const row = {
  a: 1,
  get b(): number {
    throw new Error("not ready");
  },
  c: 3,
};

console.print(new Pretty(row));
```

When it is the container's *shape* that will not be read there is nothing left to enumerate, and the whole value degrades instead: an unenumerable `Proxy`, or an object whose `toString` throws, prints as `[Threw: …]` on its own. Either way the message travels into the output, so a field that cannot be read is visible and named rather than quietly missing — and looking at a value never takes down the program that wanted to look at it.

## `print()` does this for you

`print()` sorts each argument into one of three kinds: a renderable draws itself, a string is the only kind that can carry markup, and everything else is data formatted by `Pretty`. So a plain object needs no ceremony — and markup written inside it stays the literal string it is, while the same markup as a string argument is read:

```typescript
console.print({ name: "Alice", role: "[bold red]admin[/]" });
console.print("[bold red]admin[/]");
```

What that leaves `Pretty` for is its options. They belong to its constructor, and `print()` has none of its own — so passing one is not configuration. It is a second value to print, and now that `print` formats data, you can watch it land:

```typescript
// `{ expandAll: true }` is a second argument to print, not a setting.
// It compiles, and prints after the array it was meant to configure.
console.print(new Pretty([1, 2, 3]), { expandAll: true });
```

Put the options where they belong — `new Pretty([1, 2, 3], { expandAll: true })` — and the second argument goes away along with the mistake.

## Indentation and guides

`indent` is the number of spaces per level and defaults to 4. `indentGuides` defaults to `true` and styles the first space of each level `dim green`. The guide is a styled space, not a line-drawing character, and the style is a foreground colour, which a space does not draw — so the guide leaves no visible mark, in a terminal or in plain text.

```typescript
const user = { name: "Alice", metadata: { active: true } };

console.print(new Pretty(user, { indent: 2, indentGuides: false, expandAll: true }));
```

## One line or many

An array or object prints on one line when that form fits the width, and expands over several lines when it does not. `expandAll` skips the test and expands everything, at every depth:

```typescript
console.print(new Pretty([1, 2, 3]));
console.print(new Pretty([1, 2, 3], { expandAll: true }));
```

The fit test charges a nested container for the key it sits under, not just the container's own one-line form — `metadata: ` costs 10 cells that `metadata`'s own budget has to spend too, so it expands rather than overrunning the line:

```typescript
console.print(
  new Pretty({
    name: "Alice",
    scores: [98, 87, 95],
    metadata: { active: true, role: "admin" },
  }),
);
```

A long string, or a value whose own `toString` runs long or over several lines, cannot expand, so it wraps. It breaks between words, and each line after the first starts one indent in from its key rather than at the left edge. A word too long for the room left after its key moves down to that indented line, when it has more room there:

```typescript
console.print(
  new Pretty({
    quote: "the quick brown fox jumps over the lazy dog, then turns around and jumps back over it",
    attachment: "/home/alice/projects/reports/2026/q3/summary-final-v2.pdf",
    err: new Error("not ready\nretry in 30s"),
  }),
);
```

Every container has a one-line form, `Map` and `Set` included, and takes it when the line has room for it:

```typescript
console.print(new Pretty(new Map([["a", 1], ["b", 2]])));
console.print(new Pretty(new Map([["alpha", 1111], ["beta", 2222], ["gamma", 33333]])));
console.print(new Pretty(new Set(["red", "green", "blue"])));
```

## Truncating large values

`maxLength` caps how many entries are shown, and the ones it drops are counted in a trailing `... +N` whatever the container. `maxString` cuts strings to that many characters and counts the rest after the closing quote — outside the value, so the count is never mistaken for the string's own content:

```typescript
const bigArray = Array.from({ length: 1000 }, (_, i) => i + 1);

console.print(new Pretty(bigArray, { maxLength: 10 }));
console.print(new Pretty({ bio: "Field biologist. ".repeat(20) }, { maxString: 24 }));
```

## Nesting inside another renderable

`Pretty` implements both `Renderable` and `Measurable`, so it goes anywhere a renderable goes — a `Panel`, a table cell, a `Group`:

```typescript
const account = { name: "Alice", scores: [98, 87, 95], verified: true };

console.print(
  new Panel(new Pretty(account, { expandAll: true }), {
    title: "[bold]User[/]",
    borderStyle: "cyan",
  }),
);
```
