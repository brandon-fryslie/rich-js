# Panel

`Panel` draws a Unicode border around any content.

## Basic usage

Pass a string (markup supported) to the constructor and print it:

```typescript
import { Console, Panel } from "@promptctl/rich-js";

const console = new Console();

console.print(new Panel("[bold orchid]Hello[/bold orchid], [italic dodger_blue1]World[/italic dodger_blue1]!"));
```

Any renderable works as panel content — tables, trees, other panels, styled text, etc.

## Sizing

By default a Panel expands to the full terminal width. Use `expand: false` to shrink it to fit the content:

```typescript
console.print(new Panel("[spring_green3]Short content[/spring_green3]", { expand: false }));
```

The `Panel.fit()` alternative constructor is equivalent:

```typescript
console.print(Panel.fit("[spring_green3]Short content[/spring_green3]"));
```

A `width` caps the panel: it fills that width when it expands and fits its content inside it when it does not. A title widens the panel to hold the title whole, even past `width`, up to the width the panel is given:

```typescript
console.print(Panel.fit("hi", { title: "[bold orchid]a long title[/bold orchid]" }));
```

### Narrow widths

A Panel never emits a line wider than the width it is given, however narrow that
gets — a one-column terminal, or a `Layout` split that squeezes the panel below
its natural size. It gives up its cells in a fixed order: the two frame columns
first, then a cell of content, then the padding, and only then does content grow
again. So content stays visible down to width 3, and the padding is what
disappears on the way there. Here the four widths sit side by side in [`Columns`](./columns):

```typescript
const narrow = [3, 4, 5, 6].map((width) =>
  new Panel("[bold dark_orange]hello[/bold dark_orange]", { width, borderStyle: "deep_sky_blue3" }),
);
console.print(new Columns(narrow));
```

Width 3 is the narrowest panel that can show anything: at width 2 the two frame
columns are the whole panel, and at width 1 only the left one fits, so the panel
renders as a bare frame with no content rows.

Content that renders wider than the space it was given is cropped to the frame
rather than allowed to burst it — a `Table` at its natural width inside a
too-narrow panel loses its right-hand columns instead of soft-wrapping and
destroying the frame.

## Title and subtitle

Add text to the top or bottom border:

```typescript
console.print(new Panel(
  "Panel content here",
  {
    title:    "[bold orchid]My Panel[/bold orchid]",
    subtitle: "[dim italic]footer text[/dim italic]",
  }
));
```

Both `title` and `subtitle` support markup. A newline in either reads as a space, so the border stays one row. A label too long for its border is cut, and marked with `…` only when it is a `RichText` whose `overflow` is `"ellipsis"`.

## Border style

Change the box-drawing characters by passing a box constant:

```typescript
import { ROUNDED, HEAVY, DOUBLE } from "@promptctl/rich-js";

console.print(new Panel("[dodger_blue1]ROUNDED[/dodger_blue1]", { box: ROUNDED, expand: false }));  // ╭──╮
console.print(new Panel("[orchid]HEAVY[/orchid]",           { box: HEAVY,   expand: false }));  // ┏━━┓
console.print(new Panel("[dark_orange]DOUBLE[/dark_orange]",  { box: DOUBLE,  expand: false }));  // ╔══╗
```

See [Appendix: Box Styles](./tables#border-styles) for the full list.

## Padding

Add whitespace between the border and the content:

```typescript
console.print(new Panel("[spring_green3]Content[/spring_green3]", { padding: 1, expand: false }));      // 1 on all sides
console.print(new Panel("[spring_green3]Content[/spring_green3]", { padding: [1, 2], expand: false })); // top/bottom=1, left/right=2
```

## Border colour

`borderStyle` colours the frame. The title and subtitle are drawn in it too, with `titleStyle` or `subtitleStyle` laid over it where given:

```typescript
console.print(new Panel("Disk usage is above [bold]90%[/bold]", {
  title:       "⚠ Alert",
  subtitle:    "/dev/sda1",
  borderStyle: "bold red1",
  titleStyle:  "bold dark_orange",
  expand:      false,
}));
```

## Style

`style` is the ground the whole panel is drawn on: the frame, the padding and the content all sit on it. `borderStyle` and the content's own markup are laid over it, so here the frame is `bold red1` and the text is white, both on dark blue:

```typescript
console.print(new Panel("Disk usage is above [bold]90%[/bold]", {
  title:       "⚠ Alert",
  style:       "white on dark_blue",
  borderStyle: "bold red1",
  padding:     1,
  expand:      false,
}));
```
