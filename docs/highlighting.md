# Highlighting

Automatic highlighting recognizes patterns in text — numbers, strings, booleans, URLs, UUIDs — and applies styles to them without any markup from the caller.

## What automatic highlighting does

When you pass a string to `print()` or `log()`, rich-js scans it for common patterns and colors them automatically:

```typescript
console.print('name="api", count=42, ok=true, owner=null');
console.print("id=a3f2c1d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d docs=https://example.com/api");
```

The default highlighter is `ReprHighlighter`, and it finds what Rich's does, styled the way Rich styles it: numbers (complex ones too), quoted strings, `True`/`False`/`None`, `name=value` attributes, calls like `foo(`, brackets, `...`, `<tag>` reprs, file paths, URLs, UUIDs, IPv4 and IPv6 addresses, and MAC addresses. Each is drawn with a `repr.*` style — `repr.number`, `repr.bool_true`, `repr.call` and so on — that a [theme](./style#style-themes) can redefine.

It departs from Rich in two places. JavaScript's `true`, `false`, `null` and `undefined` are styled like `True`, `False` and `None`, because [`Pretty`](./pretty) draws JavaScript values through this highlighter. Rich leaves those words plain.

And a call name is styled only where it starts a word. Rich also styles one that starts where another match ends partway through a word, the `foo` of `aa-bb-cc-dd-ee-fffoo(` after its MAC address. Finding that `foo` means looking for a `(` again from each letter of a word, so a long word with no `(` after it took seconds to highlight. Without it, highlighting takes one pass over the text.

## Enabling and disabling

Highlighting is on by default. Disable it per call:

```typescript
console.print("42 is a number here");
console.print("42 is just text here", { highlight: false });
```

Or globally on the Console — can still be re-enabled per call:

```typescript
const console = new Console({ highlight: false });

console.print("42 and /usr/bin");

// Still can enable for a specific call
console.print("42 and /usr/bin", { highlight: true });
```

A string handed to a `Columns`, a `Layout` pane or a `Rule` title is highlighted the same way, with the console's highlighter and under the same settings. A `Panel`, a `Table` or a `Tree` draws everything inside it unhighlighted — its own strings, as Rich does, and a `Columns` or `Rule` nested in it too, where Rich would still highlight theirs. A table column built with `highlight: true`, or in a table built with it, is the exception: everything in its cells is drawn as if `highlight` were on — its strings, and a `Columns` or `Rule` nested there — with the console's highlighter even when the console's own `highlight` is off, as Rich's are.

## Custom highlighters

### Regex-based highlighter

The most common pattern: extend `RegexHighlighter` and set two static fields, `highlights` (a list of regular expressions) and `baseStyle`. Only named groups are styled, so a pattern with no `(?<name>…)` group highlights nothing.

```typescript
import { RegexHighlighter, Console } from "@promptctl/rich-js";

class RequestHighlighter extends RegexHighlighter {
  static override highlights = [
    /\b(?<method>GET|POST|PUT|DELETE|PATCH)\b/,
    /\b(?<status>[1-5]\d\d)\b/,
  ];
  // The style every named group's match gets
  static override baseStyle = "bold cyan";
}

// Use as a Console-level default
const console = new Console({ highlighter: new RequestHighlighter() });
console.print("GET /api/users 200");
console.print("DELETE /api/session 401");

// Or call it on one string to get a RichText
const hl = new RequestHighlighter();
const richText = hl.call("POST /api/login 200");
console.print(richText);
```

The fields must be `static`, because `RegexHighlighter` reads them from the class. Instance fields with the same names compile, but they are ignored and nothing is highlighted.

A `baseStyle` ending in `.` names a separate style for each group: `baseStyle` followed by the group name. That is how `ReprHighlighter` pairs `"repr."` with `(?<number>…)` to style numbers as `repr.number`. Names are looked up in the [theme](./style#style-themes) of the console that prints the text, so a highlighter of your own takes its per-group colors from a `Theme`:

```typescript
import { Console, RegexHighlighter, Theme } from "@promptctl/rich-js";

class HttpHighlighter extends RegexHighlighter {
  static override highlights = [
    /\b(?<method>GET|POST|PUT|DELETE|PATCH)\b/,
    /\b(?<status>[1-5]\d\d)\b/,
  ];
  // Groups are styled http.method and http.status
  static override baseStyle = "http.";
}

const console = new Console({
  highlighter: new HttpHighlighter(),
  theme: new Theme({
    "http.method": "bold cyan",
    "http.status": "magenta",
  }),
});
console.print("GET /api/users 200");
```

A group whose name the theme does not define prints plain.

### Custom highlighter from scratch

For complete control, extend the base `Highlighter` class and implement `highlight(text)`. It styles the `RichText` in place with `stylize(style, start, end)`:

```typescript
import { Console, Highlighter, RichText } from "@promptctl/rich-js";

const COLORS = ["red", "green", "yellow", "blue", "magenta", "cyan"];

class RainbowHighlighter extends Highlighter {
  highlight(text: RichText): void {
    for (let i = 0; i < text.length; i++) {
      text.stylize(COLORS[i % COLORS.length]!, i, i + 1);
    }
  }
}

const console = new Console({ highlighter: new RainbowHighlighter() });
console.print("Hello, World!");
```

## Built-in highlighters

| Class | What it highlights |
|---|---|
| `ReprHighlighter` | Default. Rich's repr patterns — numbers, strings, booleans, attributes, calls, paths, URLs, addresses |
| `JSONHighlighter` | JSON-formatted strings — keys, values, brackets |
| `ISO8601Highlighter` | A string that is one ISO 8601 date, time, date-time, week or timezone — not one inside other text. Colours `iso8601.date`, `iso8601.time` and `iso8601.timezone`; each part inside them (`iso8601.year`, `iso8601.month`, `iso8601.hour`, …) has its own style, unstyled until a theme sets it |

```typescript
import { JSONHighlighter, Console } from "@promptctl/rich-js";

const console = new Console({ highlighter: new JSONHighlighter() });
console.print('{"name": "Alice", "age": 30}');
```
