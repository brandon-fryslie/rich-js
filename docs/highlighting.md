# Highlighting

Automatic highlighting recognizes patterns in text — numbers, strings, booleans, file paths, URLs, UUIDs — and applies styles to them without any markup from the caller.

## What automatic highlighting does

When you pass a string to `print()` or `log()`, rich-js scans it for common patterns and colors them automatically:

```typescript
console.print('path="/usr/local/bin", count=42, ok=True, id="a3f2-..."');
// path is styled, 42 is styled, True is styled, the UUID is styled
```

The patterns include: numbers, quoted strings, booleans, `null`/`None`, file paths, URLs, and UUIDs.

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

The most common pattern: extend `RegexHighlighter` with a list of named-group regular expressions and a `baseStyle` prefix.

```typescript
import { RegexHighlighter, Theme, Console } from "rich-js";

class RequestHighlighter extends RegexHighlighter {
  highlights = [
    // Named groups become style names, prefixed with baseStyle
    /(?P<method>GET|POST|PUT|DELETE|PATCH)/,
    /(?P<status>[2]\d\d)/,   // 2xx — success
    /(?P<error>[4-5]\d\d)/,  // 4xx/5xx — errors
  ];
  baseStyle = "http.";
}

const theme = new Theme({
  "http.method": "bold cyan",
  "http.status": "bold green",
  "http.error":  "bold red",
});

// Use as a Console-level default
const console = new Console({ highlighter: new RequestHighlighter(), theme });
console.print("GET /api/users 200");
console.print("DELETE /api/session 401");

// Or as a one-off callable on a specific string
const hl = new RequestHighlighter();
const richText = hl("POST /api/login 200");
console.print(richText);
```

### Custom highlighter from scratch

For complete control, extend the base `Highlighter` class and implement `highlight(text)`:

```typescript
import { Highlighter, RichText } from "rich-js";

const COLORS = ["red", "green", "yellow", "blue", "magenta", "cyan"];

class RainbowHighlighter extends Highlighter {
  highlight(text: RichText): RichText {
    for (let i = 0; i < text.length; i++) {
      text.stylize(i, i + 1, COLORS[i % COLORS.length]);
    }
    return text;
  }
}

const console = new Console({ highlighter: new RainbowHighlighter() });
console.print("Hello, World!");
```

## Built-in highlighters

| Class | What it highlights |
|---|---|
| `ReprHighlighter` | Default. Numbers, strings, booleans, null, paths, URLs, UUIDs |
| `JSONHighlighter` | JSON-formatted strings — keys, values, brackets |
| `ISO8601Highlighter` | ISO 8601 date/time strings |

```typescript
import { JSONHighlighter, Console } from "rich-js";

const console = new Console({ highlighter: new JSONHighlighter() });
console.print('{"name": "Alice", "age": 30}');
```
