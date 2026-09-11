# Highlighting

Automatic highlighting recognizes patterns in text — numbers, strings, booleans, URLs, UUIDs — and applies styles to them without any markup from the caller.

## What automatic highlighting does

When you pass a string to `print()` or `log()`, rich-js scans it for common patterns and colors them automatically:

```typescript
console.print('name="api", count=42, ok=true, owner=null, id=a3f2c1d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d');
// "api", 42, true, null and the UUID are each styled
```

The patterns are numbers, quoted strings, `true`/`false`, `null`/`undefined`/`None`, URLs, and UUIDs.

## Enabling and disabling

Highlighting is on by default. Disable it per call:

```typescript
console.print("42 is just a number here", { highlight: false });
```

Or globally on the Console — can still be re-enabled per call:

```typescript
const console = new Console({ highlight: false });

// Still can enable for a specific call
console.print("42 and /usr/bin", { highlight: true });
```

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
| `ReprHighlighter` | Default. Numbers, quoted strings, booleans, null, URLs, UUIDs |
| `JSONHighlighter` | JSON-formatted strings — keys, values, brackets |
| `ISO8601Highlighter` | ISO 8601 date/time strings |

```typescript
import { JSONHighlighter, Console } from "@promptctl/rich-js";

const console = new Console({ highlighter: new JSONHighlighter() });
console.print('{"name": "Alice", "age": 30}');
```
