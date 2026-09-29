# Markup Plugin Tags

Plugin tags are tags you add to [console markup](./markup) yourself. Register a
name on a `MarkupRegistry` with a handler function. When `renderMarkup` finds
that tag with its closing tag, it calls the handler with the text between them,
and the `RichText` the handler returns takes the pair's place:

```typescript
import { MarkupRegistry, RichText, renderMarkup } from "@promptctl/rich-js";

const tags = new MarkupRegistry();
tags.register("kbd", ({ children }) => {
  const key = new RichText(" ").append(children).append(" ");
  key.stylize("reverse");
  return key;
});

console.print(renderMarkup("Press [kbd]Ctrl+C[/kbd] to stop.", { registry: tags }));
```

A registered tag works alongside the built-in style tags, and `[/]` closes it
the way it closes any other tag.

## Writing a handler

A handler is a `MarkupTagHandler`. It takes one `MarkupTagContext` and returns
a `RichText`. The context has three fields:

- `attrs` holds the attributes written in the opening tag, as strings.
- `children` is the markup between the two tags, already parsed into a
  `RichText`. Style tags inside it are spans on it, and registered tags inside
  it have already been through their own handlers.
- `raw` is that same markup as it was written, tags and all.

Attributes follow the tag name as `key=value` pairs separated by spaces. A value
may be bare, or quoted with `"` or `'` when it contains a space. It cannot
contain `[` or `]`, quoted or not: the first `]` ends the tag. This tag reads
one attribute to pick its colours:

```typescript
const badgeStyles: Record<string, string> = {
  ok: "white on green",
  warning: "black on yellow",
  error: "white on red",
};

tags.register("badge", ({ attrs, children }) => {
  const badge = new RichText(" ").append(children).append(" ");
  badge.stylize(badgeStyles[attrs["kind"] ?? "ok"] ?? "white on blue");
  return badge;
});

console.print(
  renderMarkup(
    "Build [badge kind=ok]passing[/badge]  Deploy [badge kind='warning']paused[/badge]",
    { registry: tags },
  ),
);
```

Use `raw` when the tag should show its contents as written rather than styled.
This one prints markup source, so its brackets reach the output. The contents
are still parsed into `children` first, so they must be valid markup on their
own, and a `[/]` that closes nothing opened inside it closes the tag itself:

```typescript
tags.register("source", ({ raw }) => new RichText(raw, { style: "cyan" }));

console.print(renderMarkup("Write [source][bold]hi[/bold][/source] for bold.", { registry: tags }));
```

## Choosing a tag name

A tag name is a lowercase ASCII letter followed by letters, digits, `_` or `-`.
A name that already parses as a style, such as `red`, `bold` or `link`, cannot
be registered, because the tag would stop meaning that style. `register` throws
a `MarkupError` for a malformed name and for one of these:

```typescript throws
tags.register("red", ({ children }) => children);
```

A theme's style names, such as `prompt`, are not reserved. Registering one
makes that tag call your handler instead of applying the theme's style.

## Your own registry, or the global one

`renderMarkup` uses the registry you pass as `registry`. If you pass none, it
uses `globalMarkupRegistry`, and so does every place the library parses a
string as markup for you: `console.print`, and the strings you give a `Table`,
`Panel`, `Tree` and the other renderables. A tag registered there works in all
of them:

```typescript
globalMarkupRegistry.register("shout", ({ children }) =>
  new RichText(children.plain.toUpperCase(), { style: "bold yellow" }),
);

console.print("No registry passed, and [shout]it still resolves[/shout].");
```

The global registry is shared by everything in the process, so an application
is the right owner of it and a library is not. A library that wants its own
tags should keep them in a registry of its own and pass it in. `unregister`
removes a tag, and to parse a string with the built-in tags only, pass an empty
`new MarkupRegistry()`.

## Plugin tags must nest

A plugin tag pair cannot overlap another plugin tag pair. Style tags may overlap
each other (see [Multiple and overlapping tags](./markup#multiple-and-overlapping-tags)),
because a style only marks a stretch of text. A plugin tag replaces its stretch
with what its handler returns, and a handler receives one unbroken stretch as
`children`, so an overlapping pair has no single stretch to hand it.
`renderMarkup` throws a `MarkupSyntaxError` naming both tags instead:

```typescript throws
renderMarkup("[kbd]Ctrl+[badge]C[/kbd][/badge]", { registry: tags });
```

Nested pairs are fine; the inner one is resolved first:

```typescript
console.print(renderMarkup("[badge kind=error]Press [kbd]Q[/kbd][/badge]", { registry: tags }));
```

An opening plugin tag with no closing tag is not resolved at all: its handler is
not called, and the tag is dropped from the output like a misspelled style name.
